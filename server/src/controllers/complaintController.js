import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { config } from '../config/env.js';
import { createComplaintSchema, verifyComplaintSchema } from '../validators/complaintValidators.js';
import {
  verifyImageSignature,
  saveVerifiedImageToDisk,
  cleanupFiles,
} from '../middleware/uploadMiddleware.js';

/**
 * Complaint Controller — Phase 2C
 * Handles full citizen complaint lifecycle:
 * - Authenticated complaint submission with multipart evidence photos
 * - MIME validation & magic byte file signature verification
 * - Protected image storage outside public web roots
 * - Duplicate & recurring civic problem memory detection
 * - Atomic database transaction with rollback & disk cleanup
 * - Complaint querying, role-scoped queue inspection & detail inspection
 * - Citizen resolution verification & audit history tracking
 */

const CATEGORY_DEPARTMENT_MAP = {
  'Roads and Infrastructure': 'dept-roads',
  'Sanitation and Waste Management': 'dept-sanitation',
  'Water Supply': 'dept-water',
  'Drainage and Sewerage': 'dept-drainage',
  'Street Lighting': 'dept-lighting',
};

/**
 * Calculates distance in meters between two geographical coordinates (Haversine Formula)
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's mean radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generates an auditable, cryptographically safe unique ticket number: CM-YYYY-XXXXX
 */
export function generateTicketNumber() {
  const year = new Date().getFullYear();
  let ticketNumber;
  let exists = true;
  while (exists) {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    ticketNumber = `CM-${year}-${randomSuffix}`;
    const row = db.prepare('SELECT id FROM complaints WHERE ticket_number = ?').get(ticketNumber);
    if (!row) exists = false;
  }
  return ticketNumber;
}

/**
 * POST /api/complaints
 * Submits a new citizen civic complaint with optional evidence images.
 * Strict ownership enforcement: citizen_id is bound strictly to req.user.id.
 */
export async function createComplaint(req, res) {
  const writtenFilePaths = [];
  try {
    const user = req.user;

    // 1. Role Check: Public citizen complaints can only be filed by citizens
    if (user.role !== 'citizen') {
      return res.status(403).json({
        error: 'Access denied: Only citizens can submit civic problem reports.',
      });
    }

    // 2. Server-side Zod validation
    const parseResult = createComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      title,
      description,
      category,
      ward_id,
      latitude,
      longitude,
      address,
      landmark,
      severity,
    } = parseResult.data;

    // 3. Verify Ward existence
    const ward = db.prepare('SELECT id, name, zone FROM wards WHERE id = ?').get(ward_id);
    if (!ward) {
      return res.status(400).json({ error: 'Invalid ward: Selected ward does not exist.' });
    }

    // 4. Determine Assigned Department
    let departmentId = CATEGORY_DEPARTMENT_MAP[category] || null;
    if (!departmentId) {
      const deptRow = db.prepare('SELECT id FROM departments WHERE name = ?').get(category);
      if (deptRow) departmentId = deptRow.id;
    }

    // 5. Photo Validation & Storage (MIME + Magic Byte File Signature Verification)
    const uploadedFiles = req.files || [];
    const processedImages = [];

    for (const file of uploadedFiles) {
      const detectedMime = verifyImageSignature(file.buffer);
      if (!detectedMime || !config.allowedMimeTypes.includes(detectedMime)) {
        // Cleanup already written files and reject
        cleanupFiles(writtenFilePaths);
        return res.status(400).json({
          error: 'Invalid file signature: Only genuine JPEG, PNG, or WebP images are permitted as evidence.',
        });
      }

      // Persist to protected storage outside public directory with random UUID filename
      const saved = await saveVerifiedImageToDisk(file.buffer, detectedMime);
      writtenFilePaths.push(saved.filePath);

      const imageId = `img-${uuidv4()}`;
      processedImages.push({
        id: imageId,
        fileName: saved.fileName,
        filePath: saved.filePath,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        caption: file.originalname ? file.originalname.slice(0, 100) : 'Citizen report evidence photo',
      });
    }

    // 6. Civic Memory Intelligence: Duplicate & Recurrence Detection
    // Checks existing complaints in the same category within 100 meters
    const candidateComplaints = db.prepare(`
      SELECT id, ticket_number, status, latitude, longitude, category,
             root_incident_id, recurrence_count, is_recurring
      FROM complaints
      WHERE category = ?
    `).all(category);

    let duplicateMatch = null;
    let recurringMatch = null;

    for (const cand of candidateComplaints) {
      const dist = calculateDistanceMeters(latitude, longitude, cand.latitude, cand.longitude);
      if (dist <= 100) { // within 100 meters
        if (cand.status !== 'Resolved') {
          if (!duplicateMatch) duplicateMatch = cand;
        } else {
          if (!recurringMatch) recurringMatch = cand;
        }
      }
    }

    const complaintId = `cmp-${uuidv4()}`;
    const ticketNumber = generateTicketNumber();

    let relationType = 'standalone';
    let duplicateOfId = null;
    let rootIncidentId = complaintId;
    let isRecurring = 0;
    let recurrenceCount = 0;

    if (duplicateMatch) {
      relationType = 'duplicate';
      duplicateOfId = duplicateMatch.id;
      rootIncidentId = duplicateMatch.root_incident_id || duplicateMatch.id;
      isRecurring = duplicateMatch.is_recurring || 0;
      recurrenceCount = duplicateMatch.recurrence_count || 0;
    } else if (recurringMatch) {
      relationType = 'recurring';
      isRecurring = 1;
      rootIncidentId = recurringMatch.root_incident_id || recurringMatch.id;
      recurrenceCount = (recurringMatch.recurrence_count || 0) + 1;
    }

    // 7. Atomic Database Transaction
    db.exec('BEGIN TRANSACTION;');
    try {
      // A. Insert Complaint Record
      db.prepare(`
        INSERT INTO complaints (
          id, ticket_number, citizen_id, department_id, title, description, category,
          severity, status, latitude, longitude, address, landmark, ward_zone, ward_id,
          duplicate_of_id, relation_type, root_incident_id, is_recurring, recurrence_count,
          support_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        complaintId,
        ticketNumber,
        user.id,
        departmentId,
        title,
        description,
        category,
        severity || 'medium',
        latitude,
        longitude,
        address,
        landmark || null,
        ward.zone,
        ward.id,
        duplicateOfId,
        relationType,
        rootIncidentId,
        isRecurring,
        recurrenceCount
      );

      // B. Insert Initial Status History Record
      const historyId = `hist-${uuidv4()}`;
      const initialNotes = duplicateOfId
        ? `Complaint submitted and automatically linked as duplicate to active ticket ${duplicateMatch.ticket_number}.`
        : isRecurring
        ? `Complaint submitted. Historical memory detected recurring failure at this location (Prior incident: ${recurringMatch.ticket_number}).`
        : 'Complaint submitted by citizen.';

      db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes)
        VALUES (?, ?, ?, NULL, 'Submitted', ?)
      `).run(historyId, complaintId, user.id, initialNotes);

      // C. Insert Evidence Images with Protected Relative URLs and Disk Metadata
      for (const img of processedImages) {
        const imageUrl = `/api/complaints/${complaintId}/images/${img.id}`;
        db.prepare(`
          INSERT INTO complaint_images (
            id, complaint_id, uploader_id, image_url, image_type, caption,
            file_name, file_path, mime_type, file_size
          ) VALUES (?, ?, ?, ?, 'before_report', ?, ?, ?, ?, ?)
        `).run(
          img.id,
          complaintId,
          user.id,
          imageUrl,
          img.caption,
          img.fileName,
          img.filePath,
          img.mimeType,
          img.fileSize
        );
      }

      // If duplicate, also increment support_count on primary complaint
      if (duplicateMatch) {
        db.prepare(`
          UPDATE complaints
          SET support_count = support_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(duplicateMatch.id);

        db.prepare(`
          INSERT OR IGNORE INTO complaint_supporters (id, complaint_id, citizen_id, comment)
          VALUES (?, ?, ?, ?)
        `).run(`sup-${uuidv4()}`, duplicateMatch.id, user.id, `Reported as duplicate incident: ${ticketNumber}`);
      }

      db.exec('COMMIT;');
    } catch (txError) {
      try {
        db.exec('ROLLBACK;');
      } catch (_) {}
      cleanupFiles(writtenFilePaths);
      throw txError;
    }

    // Retrieve fresh complaint record
    const createdComplaint = db.prepare(`
      SELECT c.*, d.name as department_name, w.name as ward_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN wards w ON c.ward_id = w.id
      WHERE c.id = ?
    `).get(complaintId);

    const savedImages = db.prepare(`
      SELECT id, complaint_id, image_url, image_type, caption, created_at
      FROM complaint_images
      WHERE complaint_id = ?
    `).all(complaintId);

    return res.status(201).json({
      message: 'Complaint submitted successfully.',
      complaint: createdComplaint,
      images: savedImages,
      memory_insights: {
        relation_type: relationType,
        is_recurring: isRecurring === 1,
        recurrence_count: recurrenceCount,
        is_duplicate: relationType === 'duplicate',
        linked_ticket: duplicateMatch ? duplicateMatch.ticket_number : (recurringMatch ? recurringMatch.ticket_number : null),
      },
    });
  } catch (error) {
    cleanupFiles(writtenFilePaths);
    console.error('[Create Complaint Error]:', error);
    return res.status(500).json({ error: 'Internal server error while processing complaint submission.' });
  }
}

/**
 * GET /api/complaints
 * Returns list of complaints scoped by user role:
 * - Public / Unauthenticated: Public summary feed (no private citizen contact details)
 * - Citizen (?scope=my): List of complaints submitted by the authenticated citizen
 * - Official: Queue filtered strictly to official's assigned department
 * - Admin: Full cross-departmental access
 */
export async function getComplaints(req, res) {
  try {
    const user = req.user;
    const scope = req.query.scope;
    const departmentFilter = req.query.department_id;

    // 1. Citizen querying their own submitted complaints
    if (scope === 'my') {
      if (!user) {
        return res.status(401).json({ error: 'Authentication required to view your personal complaints.' });
      }
      const myComplaints = db.prepare(`
        SELECT c.*, d.name as department_name, w.name as ward_name
        FROM complaints c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN wards w ON c.ward_id = w.id
        WHERE c.citizen_id = ?
        ORDER BY c.created_at DESC
      `).all(user.id);

      // Attach image thumbnails to my complaints
      const enriched = myComplaints.map((comp) => {
        const imgs = db.prepare(`
          SELECT id, image_url, image_type, caption FROM complaint_images WHERE complaint_id = ?
        `).all(comp.id);
        return { ...comp, images: imgs };
      });

      return res.status(200).json({ complaints: enriched });
    }

    // 2. Official queue inspection: STRICT departmental isolation
    if (user && user.role === 'official') {
      if (departmentFilter && departmentFilter !== user.department_id) {
        return res.status(403).json({
          error: 'Access denied: Officials may only query complaints for their assigned department.',
        });
      }

      const officialQueue = db.prepare(`
        SELECT c.*, d.name as department_name, w.name as ward_name, u.full_name as citizen_name
        FROM complaints c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN wards w ON c.ward_id = w.id
        LEFT JOIN users u ON c.citizen_id = u.id
        WHERE c.department_id = ?
        ORDER BY c.created_at DESC
      `).all(user.department_id);
      return res.status(200).json({ complaints: officialQueue, department_id: user.department_id });
    }

    // 3. Admin: full cross-departmental view
    if (user && user.role === 'admin') {
      let query = `
        SELECT c.*, d.name as department_name, w.name as ward_name, u.full_name as citizen_name
        FROM complaints c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN wards w ON c.ward_id = w.id
        LEFT JOIN users u ON c.citizen_id = u.id
      `;
      const params = [];
      if (departmentFilter) {
        query += ' WHERE c.department_id = ?';
        params.push(departmentFilter);
      }
      query += ' ORDER BY c.created_at DESC';
      const allComplaints = db.prepare(query).all(...params);
      return res.status(200).json({ complaints: allComplaints });
    }

    // 4. Public / Citizen general feed: non-sensitive public data only (no citizen phone/email)
    const publicComplaints = db.prepare(`
      SELECT c.id, c.ticket_number, c.title, c.description, c.category, c.severity, c.status,
             c.latitude, c.longitude, c.address, c.landmark, c.ward_zone, c.ward_id,
             c.root_incident_id, c.is_recurring, c.recurrence_count, c.support_count, c.created_at,
             d.name as department_name, w.name as ward_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN wards w ON c.ward_id = w.id
      ORDER BY c.created_at DESC
    `).all();

    return res.status(200).json({ complaints: publicComplaints });
  } catch (error) {
    console.error('[Get Complaints Error]:', error);
    return res.status(500).json({ error: 'Internal server error fetching complaints.' });
  }
}

/**
 * GET /api/complaints/:id
 * Server-side authorization check before returning complaint details:
 * - Citizen: Can access their own complaint with full details. Accessing another citizen's private record is blocked.
 * - Official: Can access complaints assigned to their department. Accessing complaints of other departments is blocked.
 * - Admin: Unrestricted access.
 */
export async function getComplaintById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const complaint = db.prepare(`
      SELECT c.*, d.name as department_name, d.code as department_code,
             w.name as ward_name, u.full_name as citizen_name, u.email as citizen_email, u.phone as citizen_phone
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN wards w ON c.ward_id = w.id
      LEFT JOIN users u ON c.citizen_id = u.id
      WHERE c.id = ?
    `).get(id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint record not found.' });
    }

    // Authorization Check:
    if (user.role === 'admin') {
      // Allowed
    } else if (user.role === 'official') {
      if (user.department_id && complaint.department_id !== user.department_id) {
        return res.status(403).json({
          error: 'Access denied: Officials cannot view complaints outside their assigned department.',
        });
      }
    } else if (user.role === 'citizen') {
      if (complaint.citizen_id !== user.id) {
        return res.status(403).json({
          error: 'Access denied: Citizens cannot access private complaint details submitted by other citizens.',
        });
      }
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Associated evidence images
    const images = db.prepare(`
      SELECT id, complaint_id, image_url, image_type, caption, file_name, mime_type, file_size, created_at
      FROM complaint_images
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `).all(id);

    // Associated status history timeline
    const history = db.prepare(`
      SELECT h.*, u.full_name as changed_by_name, u.role as changed_by_role
      FROM complaint_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.complaint_id = ?
      ORDER BY h.created_at ASC
    `).all(id);

    // Associated citizen resolution verifications
    const verifications = db.prepare(`
      SELECT v.*, u.full_name as citizen_name
      FROM citizen_verifications v
      LEFT JOIN users u ON v.citizen_id = u.id
      WHERE v.complaint_id = ?
      ORDER BY v.created_at DESC
    `).all(id);

    // Linked duplicate ticket info if applicable
    let duplicateOf = null;
    if (complaint.duplicate_of_id) {
      duplicateOf = db.prepare(`
        SELECT id, ticket_number, title, status FROM complaints WHERE id = ?
      `).get(complaint.duplicate_of_id);
    }

    // Linked root incident info if applicable
    let rootIncident = null;
    if (complaint.root_incident_id && complaint.root_incident_id !== complaint.id) {
      rootIncident = db.prepare(`
        SELECT id, ticket_number, title, status, created_at FROM complaints WHERE id = ?
      `).get(complaint.root_incident_id);
    }

    return res.status(200).json({
      complaint,
      images,
      history,
      verifications,
      duplicate_of: duplicateOf,
      root_incident: rootIncident,
    });
  } catch (error) {
    console.error('[Get Complaint By ID Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving complaint details.' });
  }
}

/**
 * GET /api/complaints/:id/images/:imageId
 * Protected image retrieval with authentication & authorization.
 * Streams image file from protected disk storage.
 */
export async function getComplaintImage(req, res) {
  try {
    const { id, imageId } = req.params;
    const user = req.user;

    const img = db.prepare('SELECT * FROM complaint_images WHERE id = ? AND complaint_id = ?').get(imageId, id);
    if (!img) {
      return res.status(404).json({ error: 'Evidence image record not found.' });
    }

    const complaint = db.prepare('SELECT id, citizen_id, department_id FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Associated complaint not found.' });
    }

    // Authorization:
    // Admin: allowed
    // Official: allowed if assigned department matches complaint
    // Citizen: allowed if citizen is the owner
    if (user.role === 'citizen') {
      if (complaint.citizen_id !== user.id) {
        return res.status(403).json({
          error: 'Access denied: You are not authorized to view evidence for another citizen\'s complaint.',
        });
      }
    } else if (user.role === 'official') {
      if (user.department_id && complaint.department_id !== user.department_id) {
        return res.status(403).json({
          error: 'Access denied: Officials cannot view evidence outside their assigned department.',
        });
      }
    }

    // If uploaded through verified pipeline (file_path is populated)
    if (img.file_path && fs.existsSync(img.file_path)) {
      res.setHeader('Content-Type', img.mime_type || 'image/jpeg');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.sendFile(path.resolve(img.file_path));
    }

    // If seeded demo SVG image (fallback)
    if (img.image_url && img.image_url.startsWith('/uploads/')) {
      const rel = img.image_url.replace(/^\/uploads\//, '');
      const demoPath = path.resolve(config.uploadDir, rel);
      if (fs.existsSync(demoPath)) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.sendFile(demoPath);
      }
    }

    return res.status(404).json({ error: 'Image file not found on disk.' });
  } catch (error) {
    console.error('[Get Complaint Image Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving evidence image.' });
  }
}

/**
 * PATCH /api/complaints/:id/status
 * Updates complaint status with auditable transitions:
 * - Citizens: REJECTED (403 Forbidden). Status updates are official-driven.
 * - Officials: Permitted ONLY if complaint matches their assigned department.
 * - Admin: Permitted.
 */
export async function updateComplaintStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const user = req.user;

    const validStatuses = [
      'Submitted', 'Under Review', 'Verified', 'Assigned',
      'In Progress', 'Work Completed', 'Awaiting Citizen Verification',
      'Resolved', 'Reopened'
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid or missing target complaint status.' });
    }

    const complaint = db.prepare('SELECT id, status, department_id, citizen_id FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint record not found.' });
    }

    // 1. Citizens cannot directly mutate complaint status
    if (user.role === 'citizen') {
      return res.status(403).json({
        error: 'Access denied: Citizens cannot update complaint status directly. Please submit resolution verification.',
      });
    }

    // 2. Officials can ONLY update complaints assigned to their department
    if (user.role === 'official') {
      if (user.department_id && complaint.department_id !== user.department_id) {
        return res.status(403).json({
          error: 'Access denied: Officials cannot modify complaints outside their assigned department.',
        });
      }
    }

    // Record status transition in audit history table
    const historyId = `hist-${uuidv4()}`;
    db.prepare(`
      INSERT INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(historyId, id, user.id, complaint.status, status, notes || `Status updated to ${status} by ${user.full_name}`);

    // Update complaint record
    db.prepare(`
      UPDATE complaints
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);

    const updated = db.prepare('SELECT id, ticket_number, status, updated_at FROM complaints WHERE id = ?').get(id);

    return res.status(200).json({
      message: `Complaint status successfully updated to ${status}.`,
      complaint: updated,
    });
  } catch (error) {
    console.error('[Update Complaint Status Error]:', error);
    return res.status(500).json({ error: 'Internal server error updating complaint status.' });
  }
}

/**
 * POST /api/complaints/:id/support
 * Allows authenticated citizens to support/upvote an existing public community complaint
 */
export async function supportComplaint(req, res) {
  try {
    const { id } = req.params;
    const { comment } = req.body || {};
    const user = req.user;

    // Only citizens can express community support/upvotes
    if (user.role !== 'citizen') {
      return res.status(403).json({ error: 'Access denied: Only citizens can support community complaints.' });
    }

    const complaint = db.prepare('SELECT id, support_count FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint record not found.' });
    }

    // Check if already supported
    const existingSupport = db.prepare('SELECT id FROM complaint_supporters WHERE complaint_id = ? AND citizen_id = ?').get(id, user.id);
    if (existingSupport) {
      return res.status(409).json({ error: 'You have already supported this community complaint.' });
    }

    const supportId = `sup-${uuidv4()}`;
    db.prepare(`
      INSERT INTO complaint_supporters (id, complaint_id, citizen_id, comment)
      VALUES (?, ?, ?, ?)
    `).run(supportId, id, user.id, comment || null);

    db.prepare(`
      UPDATE complaints
      SET support_count = support_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    const updatedCount = db.prepare('SELECT support_count FROM complaints WHERE id = ?').get(id);

    return res.status(200).json({
      message: 'Complaint supported successfully.',
      support_count: updatedCount.support_count,
    });
  } catch (error) {
    console.error('[Support Complaint Error]:', error);
    return res.status(500).json({ error: 'Internal server error supporting complaint.' });
  }
}

/**
 * POST /api/complaints/:id/verify
 * Allows the reporting citizen to sign off on municipal repair work:
 * - is_satisfactory = true  -> Status moves to 'Resolved'
 * - is_satisfactory = false -> Status moves to 'Reopened' with citizen feedback
 */
export async function verifyComplaint(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user.role !== 'citizen') {
      return res.status(403).json({
        error: 'Access denied: Only citizens can verify resolution of civic complaints.',
      });
    }

    const complaint = db.prepare('SELECT id, citizen_id, status, ticket_number FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint record not found.' });
    }

    if (complaint.citizen_id !== user.id) {
      return res.status(403).json({
        error: 'Access denied: You can only verify complaints that you personally submitted.',
      });
    }

    const verifiableStatuses = ['Work Completed', 'Awaiting Citizen Verification', 'Resolved'];
    if (!verifiableStatuses.includes(complaint.status)) {
      return res.status(400).json({
        error: `Complaint cannot be verified while in '${complaint.status}' status. Repair work must be completed before verification.`,
      });
    }

    const parseResult = verifyComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { is_satisfactory, feedback } = parseResult.data;
    const targetStatus = is_satisfactory ? 'Resolved' : 'Reopened';
    const notes = is_satisfactory
      ? `Citizen confirmed resolution: ${feedback || 'Work inspected and verified fixed by citizen.'}`
      : `Citizen rejected resolution (Issue reopened): ${feedback || 'Citizen reported the issue remains unresolved or sub-standard.'}`;

    const verificationId = `verif-${uuidv4()}`;
    const historyId = `hist-${uuidv4()}`;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO citizen_verifications (id, complaint_id, citizen_id, is_satisfactory, feedback)
        VALUES (?, ?, ?, ?, ?)
      `).run(verificationId, id, user.id, is_satisfactory ? 1 : 0, feedback || null);

      db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(historyId, id, user.id, complaint.status, targetStatus, notes);

      db.prepare(`
        UPDATE complaints
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(targetStatus, id);

      // If resolving the primary complaint, also resolve all linked duplicate tickets
      if (targetStatus === 'Resolved') {
        db.prepare(`
          UPDATE complaints
          SET status = 'Resolved', updated_at = CURRENT_TIMESTAMP
          WHERE duplicate_of_id = ? AND status != 'Resolved'
        `).run(id);
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      try {
        db.exec('ROLLBACK;');
      } catch (_) {}
      throw txErr;
    }

    const updated = db.prepare('SELECT id, ticket_number, status, updated_at FROM complaints WHERE id = ?').get(id);

    return res.status(200).json({
      message: is_satisfactory
        ? 'Resolution confirmed. Complaint status updated to Resolved.'
        : 'Feedback recorded. Complaint reopened for municipal work revision.',
      complaint: updated,
      verification_id: verificationId,
    });
  } catch (error) {
    console.error('[Verify Complaint Error]:', error);
    return res.status(500).json({ error: 'Internal server error verifying complaint resolution.' });
  }
}

/**
 * GET /api/complaints/meta/wards
 * Returns list of administrative wards for dropdown selection
 */
export async function getWards(req, res) {
  try {
    const wards = db.prepare('SELECT id, ward_number, name, zone, description FROM wards ORDER BY ward_number ASC').all();
    return res.status(200).json({ wards });
  } catch (err) {
    console.error('[Get Wards Error]:', err);
    return res.status(500).json({ error: 'Internal server error fetching wards.' });
  }
}

/**
 * GET /api/complaints/meta/departments
 * Returns list of municipal departments
 */
export async function getDepartments(req, res) {
  try {
    const departments = db.prepare('SELECT id, name, code, description FROM departments ORDER BY name ASC').all();
    return res.status(200).json({ departments });
  } catch (err) {
    console.error('[Get Departments Error]:', err);
    return res.status(500).json({ error: 'Internal server error fetching departments.' });
  }
}
