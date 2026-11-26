import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import {
  assignComplaintSchema,
  updateOfficialStatusSchema,
  progressUpdateSchema,
} from '../validators/officialValidators.js';
import { reassignDepartmentSchema } from '../validators/departmentRoutingValidators.js';
import {
  createCitizenNotification,
  processMultilingualComplaint,
} from '../services/multilingualService.js';
import {
  verifyImageSignature,
  verifyMediaSignature,
  saveVerifiedImageToDisk,
  saveVerifiedMediaToDisk,
  cleanupFiles,
} from '../middleware/uploadMiddleware.js';
import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Official & Departmental Complaint Controller — Phase 2D
 * Handles:
 * - Departmental KPI dashboards & metrics
 * - Server-side paginated & filtered complaints queue
 * - Detailed complaint view with full assignment & progress audit trail
 * - Official assignment within department
 * - Status transitions (with strict citizen resolution verification boundary)
 * - Field progress notes & dispatch updates
 * - Before / after repair evidence photo uploads with magic byte verification
 */

/**
 * GET /api/official/dashboard
 * Department-scoped KPI statistics and recent active complaints
 */
export function getOfficialDashboard(req, res) {
  try {
    const user = req.user;
    const departmentId = user.role === 'official' ? user.department_id : (req.query.department_id || null);

    let whereClause = '1=1';
    const params = [];

    if (departmentId) {
      whereClause += ' AND c.department_id = ?';
      params.push(departmentId);
    }

    // KPI counts
    const counts = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN c.status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN c.status = 'Under Review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN c.status = 'Verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN c.status = 'Assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN c.status IN ('Work Completed', 'Awaiting Citizen Verification') THEN 1 ELSE 0 END) as awaiting_verification,
        SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN c.status = 'Reopened' THEN 1 ELSE 0 END) as reopened,
        SUM(CASE WHEN (c.severity IN ('high', 'critical') OR c.priority IN ('High', 'Critical')) AND c.status NOT IN ('Resolved') THEN 1 ELSE 0 END) as high_or_critical,
        SUM(CASE WHEN c.requires_manual_review = 1 AND c.status NOT IN ('Resolved') THEN 1 ELSE 0 END) as pending_routing_review,
        SUM(CASE WHEN c.relation_type = 'recurring' THEN 1 ELSE 0 END) as recurring_count,
        SUM(CASE WHEN c.assigned_official_id IS NULL AND c.status NOT IN ('Resolved', 'Work Completed') THEN 1 ELSE 0 END) as unassigned_count
      FROM complaints c
      WHERE ${whereClause}
    `).get(...params);

    // Department workload across all active departments
    const departmentWorkload = db.prepare(`
      SELECT d.id, d.name, d.code, COUNT(c.id) as active_count
      FROM departments d
      LEFT JOIN complaints c ON c.department_id = d.id AND c.status NOT IN ('Resolved')
      WHERE d.is_active = 1
      GROUP BY d.id
      ORDER BY active_count DESC
    `).all();

    // Average resolution time in hours for resolved complaints
    const avgResRow = db.prepare(`
      SELECT AVG((julianday(c.updated_at) - julianday(c.created_at)) * 24) as avg_hours
      FROM complaints c
      WHERE c.status = 'Resolved' ${departmentId ? 'AND c.department_id = ?' : ''}
    `).get(...(departmentId ? [departmentId] : []));
    const avgResolutionHours = avgResRow && avgResRow.avg_hours ? Math.round(avgResRow.avg_hours * 10) / 10 : 0;

    // Department details if scoped
    let department = null;
    if (departmentId) {
      department = db.prepare('SELECT id, name, code, description FROM departments WHERE id = ?').get(departmentId);
    }

    // Recent 5 active complaints
    const recentComplaints = db.prepare(`
      SELECT 
        c.id, c.ticket_number, c.title, c.category, c.severity, c.status,
        c.relation_type, c.recurrence_count, c.address, c.created_at,
        w.name as ward_name, w.ward_number,
        u.full_name as citizen_name,
        off.full_name as assigned_official_name
      FROM complaints c
      LEFT JOIN wards w ON c.ward_id = w.id
      LEFT JOIN users u ON c.citizen_id = u.id
      LEFT JOIN users off ON c.assigned_official_id = off.id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT 5
    `).all(...params);

    return res.status(200).json({
      department: department || { name: 'All Municipal Departments', code: 'ALL' },
      metrics: {
        total: counts.total || 0,
        submitted: counts.submitted || 0,
        under_review: counts.under_review || 0,
        verified: counts.verified || 0,
        assigned: counts.assigned || 0,
        in_progress: counts.in_progress || 0,
        awaiting_verification: counts.awaiting_verification || 0,
        resolved: counts.resolved || 0,
        reopened: counts.reopened || 0,
        high_or_critical: counts.high_or_critical || 0,
        pending_routing_review: counts.pending_routing_review || 0,
        recurring_count: counts.recurring_count || 0,
        unassigned_count: counts.unassigned_count || 0,
        average_resolution_time_hours: avgResolutionHours,
      },
      department_workload: departmentWorkload,
      recentComplaints,
    });
  } catch (error) {
    console.error('[Official Dashboard Error]:', error);
    return res.status(500).json({ error: 'Internal server error fetching official dashboard metrics.' });
  }
}

/**
 * GET /api/official/complaints
 * Server-side paginated list of departmental complaints with rich filtering
 */
export function getDepartmentComplaints(req, res) {
  try {
    const user = req.user;
    const departmentId = user.role === 'official' ? user.department_id : (req.query.department_id || null);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const {
      status,
      ward_id,
      severity,
      priority,
      routing_status,
      requires_manual_review,
      assigned_official_id,
      search,
      relation_type,
      startDate,
      endDate,
    } = req.query;

    const whereClauses = ['1=1'];
    const params = [];

    if (departmentId) {
      whereClauses.push('c.department_id = ?');
      params.push(departmentId);
    }

    if (status && status !== 'all') {
      if (status === 'awaiting_verification') {
        whereClauses.push("c.status IN ('Work Completed', 'Awaiting Citizen Verification')");
      } else {
        whereClauses.push('c.status = ?');
        params.push(status);
      }
    }

    if (ward_id && ward_id !== 'all') {
      whereClauses.push('c.ward_id = ?');
      params.push(ward_id);
    }

    if (severity && severity !== 'all') {
      whereClauses.push('c.severity = ?');
      params.push(severity);
    }

    if (priority && priority !== 'all') {
      whereClauses.push('c.priority = ?');
      params.push(priority);
    }

    if (routing_status && routing_status !== 'all') {
      whereClauses.push('c.routing_status = ?');
      params.push(routing_status);
    }

    if (requires_manual_review !== undefined && requires_manual_review !== '' && requires_manual_review !== 'all') {
      const isManual = requires_manual_review === 'true' || requires_manual_review === '1' || requires_manual_review === 1 ? 1 : 0;
      whereClauses.push('c.requires_manual_review = ?');
      params.push(isManual);
    }

    if (assigned_official_id && assigned_official_id !== 'all') {
      if (assigned_official_id === 'unassigned') {
        whereClauses.push('c.assigned_official_id IS NULL');
      } else {
        whereClauses.push('c.assigned_official_id = ?');
        params.push(assigned_official_id);
      }
    }

    if (relation_type && relation_type !== 'all') {
      whereClauses.push('c.relation_type = ?');
      params.push(relation_type);
    }

    if (startDate) {
      whereClauses.push('c.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('c.created_at <= ?');
      params.push(endDate);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(c.title LIKE ? OR c.description LIKE ? OR c.ticket_number LIKE ? OR c.address LIKE ?)');
      params.push(term, term, term, term);
    }

    const whereString = whereClauses.join(' AND ');

    // Total count for pagination
    const totalRow = db.prepare(`
      SELECT count(*) as count
      FROM complaints c
      WHERE ${whereString}
    `).get(...params);
    const total = totalRow.count;

    // Paginated records
    const complaints = db.prepare(`
      SELECT 
        c.id, c.ticket_number, c.title, c.description, c.category, c.severity, c.status,
        c.latitude, c.longitude, c.address, c.landmark, c.ward_zone,
        c.is_recurring, c.recurrence_count, c.relation_type, c.duplicate_of_id, c.root_incident_id,
        c.created_at, c.updated_at, c.department_id, c.assigned_official_id,
        c.recommended_department_id, c.secondary_department_id, c.routing_reason,
        c.routing_confidence, c.requires_manual_review, c.routing_status, c.priority,
        c.accepted_by_user_id, c.accepted_at,
        c.language_preference, c.detected_language, c.original_text, c.english_translation,
        c.translation_confidence, c.translation_revised_at, c.translation_notes,
        c.deadline_at, c.deadline_set_at, c.deadline_consultation_notes,
        adm_dl.full_name as deadline_set_by_admin_name,
        (SELECT id FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as live_tender_id,
        (SELECT tender_number FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as live_tender_number,
        (SELECT official_tender_ref FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as live_official_tender_ref,
        (SELECT portal_url FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as live_tender_portal_url,
        (SELECT portal_name FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as live_tender_portal_name,
        (SELECT status FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as live_tender_status,
        w.name as ward_name, w.ward_number,
        d.name as department_name, d.code as department_code,
        rec_d.name as recommended_department_name,
        sec_d.name as secondary_department_name,
        acc_u.full_name as accepted_by_official_name,
        u.full_name as citizen_name, u.phone as citizen_phone, u.email as citizen_email,
        off.full_name as assigned_official_name, off.email as assigned_official_email,
        (SELECT count(*) FROM complaint_images WHERE complaint_id = c.id) as image_count,
        (SELECT count(*) FROM complaint_progress_updates WHERE complaint_id = c.id) as progress_count,
        (SELECT count(*) FROM citizen_verifications WHERE complaint_id = c.id) as verification_count
      FROM complaints c
      LEFT JOIN wards w ON c.ward_id = w.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN departments rec_d ON c.recommended_department_id = rec_d.id
      LEFT JOIN departments sec_d ON c.secondary_department_id = sec_d.id
      LEFT JOIN users acc_u ON c.accepted_by_user_id = acc_u.id
      LEFT JOIN users u ON c.citizen_id = u.id
      LEFT JOIN users off ON c.assigned_official_id = off.id
      LEFT JOIN users adm_dl ON c.deadline_set_by_admin_id = adm_dl.id
      WHERE ${whereString}
      ORDER BY 
        CASE 
          WHEN c.severity = 'critical' AND c.status NOT IN ('Resolved', 'Work Completed') THEN 1
          WHEN c.severity = 'high' AND c.status NOT IN ('Resolved', 'Work Completed') THEN 2
          ELSE 3
        END,
        c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return res.status(200).json({
      complaints,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('[Get Department Complaints Error]:', error);
    return res.status(500).json({ error: 'Internal server error querying department complaints.' });
  }
}

/**
 * GET /api/official/complaints/:id
 * Detailed complaint inspection including history, progress notes, assignments, and evidence images
 */
export function getDepartmentComplaintById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const complaint = db.prepare(`
      SELECT 
        c.*,
        w.name as ward_name, w.ward_number,
        d.name as department_name, d.code as department_code,
        rec_d.name as recommended_department_name, rec_d.code as recommended_department_code,
        sec_d.name as secondary_department_name, sec_d.code as secondary_department_code,
        acc_u.full_name as accepted_by_official_name,
        u.full_name as citizen_name, u.email as citizen_email, u.phone as citizen_phone,
        off.full_name as assigned_official_name, off.email as assigned_official_email, off.phone as assigned_official_phone
      FROM complaints c
      LEFT JOIN wards w ON c.ward_id = w.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN departments rec_d ON c.recommended_department_id = rec_d.id
      LEFT JOIN departments sec_d ON c.secondary_department_id = sec_d.id
      LEFT JOIN users acc_u ON c.accepted_by_user_id = acc_u.id
      LEFT JOIN users u ON c.citizen_id = u.id
      LEFT JOIN users off ON c.assigned_official_id = off.id
      WHERE c.id = ?
    `).get(id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    // Official department scoping
    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials cannot access complaints outside their assigned department.',
      });
    }

    // Images
    const images = db.prepare(`
      SELECT id, complaint_id, image_url, image_type, caption, file_name, mime_type, file_size,
             media_type, sha256_hash, latitude, longitude, accuracy_meters, device_captured_at,
             recording_started_at, recording_ended_at, server_received_at, capture_type,
             evidence_purpose, duration_seconds, created_at
      FROM complaint_images
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `).all(id);

    // Assignment history
    const assignments = db.prepare(`
      SELECT 
        a.id, a.complaint_id, a.notes, a.created_at,
        assigned_user.full_name as assigned_official_name, assigned_user.email as assigned_official_email,
        assigned_by.full_name as assigned_by_name, assigned_by.role as assigned_by_role
      FROM complaint_assignments a
      LEFT JOIN users assigned_user ON a.assigned_official_id = assigned_user.id
      LEFT JOIN users assigned_by ON a.assigned_by_user_id = assigned_by.id
      WHERE a.complaint_id = ?
      ORDER BY a.created_at DESC
    `).all(id);

    // Progress updates
    const progressUpdates = db.prepare(`
      SELECT 
        p.id, p.complaint_id, p.message, p.update_type, p.created_at,
        u.full_name as official_name, u.role as official_role
      FROM complaint_progress_updates p
      LEFT JOIN users u ON p.official_id = u.id
      WHERE p.complaint_id = ?
      ORDER BY p.created_at DESC
    `).all(id);

    // Status transition audit trail
    const statusHistory = db.prepare(`
      SELECT 
        h.id, h.complaint_id, h.from_status, h.to_status, h.notes, h.created_at,
        u.full_name as changed_by_name, u.role as changed_by_role
      FROM complaint_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.complaint_id = ?
      ORDER BY h.created_at ASC
    `).all(id);

    // Citizen verifications
    const verifications = db.prepare(`
      SELECT 
        v.id, v.complaint_id, v.is_satisfactory, v.feedback, v.verification_photo_url, v.created_at,
        u.full_name as citizen_name
      FROM citizen_verifications v
      LEFT JOIN users u ON v.citizen_id = u.id
      WHERE v.complaint_id = ?
      ORDER BY v.created_at DESC
    `).all(id);

    // Duplicate reference
    let duplicateOf = null;
    if (complaint.duplicate_of_id) {
      duplicateOf = db.prepare(`
        SELECT id, ticket_number, title, status, created_at FROM complaints WHERE id = ?
      `).get(complaint.duplicate_of_id);
    }

    // Root incident / recurrence chain
    let rootIncident = null;
    let recurrenceChain = [];
    if (complaint.root_incident_id) {
      rootIncident = db.prepare(`
        SELECT id, ticket_number, title, status, created_at FROM complaints WHERE id = ?
      `).get(complaint.root_incident_id);

      recurrenceChain = db.prepare(`
        SELECT id, ticket_number, title, status, severity, created_at
        FROM complaints
        WHERE root_incident_id = ? AND id != ?
        ORDER BY created_at ASC
      `).all(complaint.root_incident_id, complaint.id);
    }

    // Linked routing audit trail
    const routingAuditHistory = db.prepare(`
      SELECT dra.*, u.full_name as assigned_by_name, u.role as assigned_by_role
      FROM department_routing_audit dra
      LEFT JOIN users u ON dra.assigned_by_user_id = u.id
      WHERE dra.complaint_id = ?
      ORDER BY dra.created_at ASC
    `).all(id);

    // Deadlines audit history
    const deadlinesHistory = db.prepare(`
      SELECT 
        h.id, h.complaint_id, h.action, h.previous_deadline_at, h.new_deadline_at,
        h.consultation_notes, h.created_at,
        u.full_name as set_by_admin_name
      FROM complaint_deadlines_history h
      LEFT JOIN users u ON h.set_by_admin_id = u.id
      WHERE h.complaint_id = ?
      ORDER BY h.created_at DESC
    `).all(id);

    // Associated government tender (if any)
    const tender = db.prepare(`
      SELECT 
        t.*, adm.full_name as created_by_admin_name, off.full_name as assigned_official_name
      FROM government_tenders t
      LEFT JOIN users adm ON t.created_by_admin_id = adm.id
      LEFT JOIN users off ON t.assigned_official_id = off.id
      WHERE t.complaint_id = ? AND t.status NOT IN ('Cancelled')
      ORDER BY t.created_at DESC
      LIMIT 1
    `).get(id);

    return res.status(200).json({
      complaint,
      images,
      assignments,
      progressUpdates,
      statusHistory,
      verifications,
      duplicateOf,
      rootIncident,
      recurrenceChain,
      routing_history: routingAuditHistory,
      deadlinesHistory,
      tender: tender || null,
      is_tender_bidding_active: tender ? (tender.status === 'Published' || tender.status === 'Bidding Open') : false,
    });
  } catch (error) {
    console.error('[Get Department Complaint Detail Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving complaint details.' });
  }
}

/**
 * GET /api/official/officials
 * Returns active officials in the user's department (for assignment dropdown)
 */
export function getDepartmentOfficials(req, res) {
  try {
    const user = req.user;
    const departmentId = user.role === 'official' ? user.department_id : (req.query.department_id || user.department_id);

    if (!departmentId) {
      // If admin and no department specified, return all active officials
      const officials = db.prepare(`
        SELECT u.id, u.full_name, u.email, u.phone, u.role, u.department_id, d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.role = 'official' AND u.is_active = 1
        ORDER BY u.full_name ASC
      `).all();
      return res.status(200).json({ officials });
    }

    const officials = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.role, u.department_id, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'official' AND u.is_active = 1 AND u.department_id = ?
      ORDER BY u.full_name ASC
    `).all(departmentId);

    return res.status(200).json({ officials });
  } catch (error) {
    console.error('[Get Department Officials Error]:', error);
    return res.status(500).json({ error: 'Internal server error fetching department officials.' });
  }
}

/**
 * POST /api/official/complaints/:id/assign
 * Assigns an official within the department to a complaint
 */
export function assignComplaint(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    // RBAC: Only Admin role can assign, reassign, or distribute tasks to engineers
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied: Only users with the Admin role can assign or reassign tasks to engineers.',
      });
    }

    const parseResult = assignComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { assigned_official_id, notes } = parseResult.data;

    const complaint = db.prepare('SELECT id, ticket_number, status, department_id, assigned_official_id FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    // Validate target official exists, is active, is official, and matches department
    const targetOfficial = db.prepare(`
      SELECT id, full_name, email, department_id, role, is_active
      FROM users
      WHERE id = ?
    `).get(assigned_official_id);

    if (!targetOfficial || targetOfficial.role !== 'official' || !targetOfficial.is_active) {
      return res.status(400).json({
        error: 'Selected official does not exist, is not an official, or is currently inactive.',
      });
    }

    if (complaint.department_id && targetOfficial.department_id !== complaint.department_id) {
      return res.status(400).json({
        error: 'Cross-department assignment prohibited: The selected official is not in the complaint\'s department.',
      });
    }

    const assignmentId = `asgn-${uuidv4()}`;

    // Perform database updates
    db.prepare(`
      INSERT INTO complaint_assignments (id, complaint_id, assigned_official_id, assigned_by_user_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(assignmentId, id, assigned_official_id, user.id, notes || null);

    db.prepare(`
      UPDATE complaints
      SET assigned_official_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(assigned_official_id, id);

    let updatedStatus = complaint.status;
    // Auto-advance status to 'Assigned' if currently 'Submitted' or 'Under Review'
    if (complaint.status === 'Submitted' || complaint.status === 'Under Review') {
      updatedStatus = 'Assigned';
      db.prepare(`
        UPDATE complaints SET status = 'Assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(id);

      const histId = `hist-${uuidv4()}`;
      db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes)
        VALUES (?, ?, ?, ?, 'Assigned', ?)
      `).run(
        histId,
        id,
        user.id,
        complaint.status,
        `Assigned to ${targetOfficial.full_name} (${targetOfficial.email})${notes ? ': ' + notes : ''}`
      );
    }

    // Record system audit log
    logAuditEvent({
      userId: user.id,
      action: 'COMPLAINT_ASSIGNED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        assigned_official_id,
        assigned_official_name: targetOfficial.full_name,
        notes: notes || null,
        status: updatedStatus,
      },
    });

    return res.status(200).json({
      message: `Complaint ${complaint.ticket_number} successfully assigned to ${targetOfficial.full_name}.`,
      assigned_official: {
        id: targetOfficial.id,
        full_name: targetOfficial.full_name,
        email: targetOfficial.email,
      },
      status: updatedStatus,
    });
  } catch (error) {
    console.error('[Assign Complaint Error]:', error);
    return res.status(500).json({ error: 'Internal server error assigning official to complaint.' });
  }
}

/**
 * PATCH /api/official/complaints/:id/status
 * Official status transitions with strict citizen verification boundary
 */
export function updateOfficialComplaintStatus(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = updateOfficialStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { status, notes } = parseResult.data;

    const complaint = db.prepare('SELECT id, ticket_number, status, department_id, citizen_id, detected_language, language_preference FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    // Scope check
    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials cannot update complaints outside their assigned department.',
      });
    }

    // If complaint is already Resolved by citizen
    if (complaint.status === 'Resolved') {
      return res.status(400).json({
        error: 'Complaint has already been verified and marked as Resolved by the citizen.',
      });
    }

    // Direct transition to Resolved is blocked for officials
    if (status === 'Resolved') {
      return res.status(400).json({
        error: 'Officials cannot unilaterally resolve complaints. Transition status to \'Work Completed\', which submits the repair for citizen resolution verification.',
      });
    }

    const fromStatus = complaint.status;
    const toStatus = status;

    // Update complaint status
    db.prepare(`
      UPDATE complaints
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(toStatus, id);

    // Audit trail
    const histId = `hist-${uuidv4()}`;
    db.prepare(`
      INSERT INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(histId, id, user.id, fromStatus, toStatus, notes || null);

    // If marked Work Completed, record an automatic progress update
    if (toStatus === 'Work Completed') {
      const progId = `prog-${uuidv4()}`;
      db.prepare(`
        INSERT INTO complaint_progress_updates (id, complaint_id, official_id, message, update_type)
        VALUES (?, ?, ?, ?, 'repair_completed')
      `).run(
        progId,
        id,
        user.id,
        notes || 'Field repair completed. Maintenance work has been submitted for citizen verification.'
      );
    }

    // Multilingual status change notification for citizen
    createCitizenNotification({
      complaintId: id,
      citizenId: complaint.citizen_id,
      eventType: toStatus === 'Work Completed' ? 'work_completed' : 'status_changed',
      targetLanguage: complaint.detected_language || complaint.language_preference || 'English',
      ticketNumber: complaint.ticket_number,
      status: toStatus,
      dbInstance: db,
    });

    // Audit Log
    logAuditEvent({
      userId: user.id,
      action: 'STATUS_UPDATED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        from_status: fromStatus,
        to_status: toStatus,
        notes: notes || null,
      },
    });

    return res.status(200).json({
      message: `Complaint status updated to '${toStatus}'.`,
      complaint_id: id,
      ticket_number: complaint.ticket_number,
      from_status: fromStatus,
      to_status: toStatus,
    });
  } catch (error) {
    console.error('[Update Official Status Error]:', error);
    return res.status(500).json({ error: 'Internal server error updating complaint status.' });
  }
}

/**
 * POST /api/official/complaints/:id/progress
 * Adds an official progress update, dispatch note, or field log
 */
export function addProgressUpdate(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = progressUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { message, update_type } = parseResult.data;

    const complaint = db.prepare('SELECT id, ticket_number, department_id FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    // Scope check
    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials cannot add progress updates outside their assigned department.',
      });
    }

    const progId = `prog-${uuidv4()}`;
    db.prepare(`
      INSERT INTO complaint_progress_updates (id, complaint_id, official_id, message, update_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(progId, id, user.id, message, update_type);

    logAuditEvent({
      userId: user.id,
      action: 'PROGRESS_UPDATE_ADDED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        update_type,
        message,
      },
    });

    return res.status(201).json({
      message: 'Progress update recorded successfully.',
      progress: {
        id: progId,
        complaint_id: id,
        official_id: user.id,
        official_name: user.full_name,
        message,
        update_type,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Add Progress Update Error]:', error);
    return res.status(500).json({ error: 'Internal server error adding progress update.' });
  }
}

/**
 * POST /api/official/complaints/:id/evidence
 * Uploads official live inspection or resolution evidence (photos & videos) with magic byte verification
 */
export async function uploadRepairEvidence(req, res) {
  const writtenFiles = [];
  try {
    const { id } = req.params;
    const user = req.user;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'No evidence files uploaded. Please attach at least one photo or video.',
      });
    }

    const complaint = db.prepare('SELECT id, ticket_number, department_id FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials cannot upload evidence for complaints outside their department.',
      });
    }

    // Parse optional live evidence metadata submitted by client
    let clientMetadataList = [];
    if (req.body.evidence_metadata) {
      try {
        clientMetadataList = typeof req.body.evidence_metadata === 'string'
          ? JSON.parse(req.body.evidence_metadata)
          : req.body.evidence_metadata;
        if (!Array.isArray(clientMetadataList)) clientMetadataList = [clientMetadataList];
      } catch (_) {
        clientMetadataList = [];
      }
    }

    // Supported official evidence purposes:
    // 'initial_inspection', 'site_inspection', 'work_in_progress', 'repair_progress', 'resolution'
    const allowedPurposes = ['initial_inspection', 'site_inspection', 'work_in_progress', 'repair_progress', 'resolution'];
    const evidencePurpose = allowedPurposes.includes(req.body.evidence_purpose)
      ? req.body.evidence_purpose
      : (req.body.image_type === 'after_repair' ? 'resolution' : 'repair_progress');

    const imageType = evidencePurpose === 'resolution' || req.body.image_type === 'after_repair' ? 'after_repair' : 'progress';
    const caption = req.body.caption || (evidencePurpose === 'resolution' ? 'Repair resolution verification' : 'Field inspection record');

    const savedImages = [];
    for (let idx = 0; idx < req.files.length; idx++) {
      const file = req.files[idx];
      const verified = verifyMediaSignature(file.buffer);
      if (!verified) {
        cleanupFiles(writtenFiles);
        return res.status(400).json({
          error: `File signature verification failed for '${file.originalname}'. Only authentic JPEG, PNG, and WebP images or WebM and MP4 videos are accepted.`,
        });
      }

      // Check sizes: 5MB for photos, 25MB for videos
      if (verified.mediaType === 'IMAGE' && file.buffer.length > (5 * 1024 * 1024)) {
        cleanupFiles(writtenFiles);
        return res.status(400).json({
          error: `File '${file.originalname}' exceeds the 5MB image size limit.`,
        });
      }
      if (verified.mediaType === 'VIDEO' && file.buffer.length > (25 * 1024 * 1024)) {
        cleanupFiles(writtenFiles);
        return res.status(400).json({
          error: `Video '${file.originalname}' exceeds the 25MB video size limit.`,
        });
      }

      const clientMeta = clientMetadataList[idx] || clientMetadataList.find((m) => m?.file_name === file.originalname) || {};

      const diskMeta = await saveVerifiedMediaToDisk(file.buffer, verified.mimeType, verified.extension);
      writtenFiles.push(diskMeta.filePath);

      const imgId = `img-${uuidv4()}`;
      const imageUrl = `/api/complaints/${id}/images/${imgId}`;
      const serverReceivedAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO complaint_images (
          id, complaint_id, uploader_id, image_url, image_type, caption,
          file_name, file_path, mime_type, file_size,
          media_type, sha256_hash, latitude, longitude, accuracy_meters,
          device_captured_at, recording_started_at, recording_ended_at,
          server_received_at, capture_type, evidence_purpose, duration_seconds,
          uploader_role, department_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        imgId,
        id,
        user.id,
        imageUrl,
        imageType,
        caption,
        diskMeta.fileName,
        diskMeta.filePath,
        diskMeta.mimeType,
        diskMeta.fileSize,
        verified.mediaType,
        diskMeta.sha256,
        clientMeta.latitude != null && !isNaN(Number(clientMeta.latitude)) ? Number(clientMeta.latitude) : null,
        clientMeta.longitude != null && !isNaN(Number(clientMeta.longitude)) ? Number(clientMeta.longitude) : null,
        clientMeta.accuracy_meters != null && !isNaN(Number(clientMeta.accuracy_meters)) ? Number(clientMeta.accuracy_meters) : null,
        clientMeta.captured_at || clientMeta.device_captured_at || null,
        clientMeta.recording_started_at || null,
        clientMeta.recording_ended_at || null,
        serverReceivedAt,
        clientMeta.capture_type || 'LIVE_CAMERA',
        evidencePurpose,
        clientMeta.duration_seconds != null && !isNaN(Number(clientMeta.duration_seconds)) ? Number(clientMeta.duration_seconds) : null,
        user.role,
        complaint.department_id
      );

      savedImages.push({
        id: imgId,
        image_url: imageUrl,
        image_type: imageType,
        media_type: verified.mediaType,
        evidence_purpose: evidencePurpose,
        sha256_hash: diskMeta.sha256,
        latitude: clientMeta.latitude ?? null,
        longitude: clientMeta.longitude ?? null,
        accuracy_meters: clientMeta.accuracy_meters ?? null,
        server_received_at: serverReceivedAt,
        caption,
        mime_type: diskMeta.mimeType,
        file_size: diskMeta.fileSize,
      });
    }

    // Auto-log progress note about uploaded evidence
    const progId = `prog-${uuidv4()}`;
    const purposeLabel = evidencePurpose.replace(/_/g, ' ');
    db.prepare(`
      INSERT INTO complaint_progress_updates (id, complaint_id, official_id, message, update_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      progId,
      id,
      user.id,
      `Attached ${savedImages.length} live ${savedImages.some((i) => i.media_type === 'VIDEO') ? 'video/photo' : 'photo'} evidence record(s) for ${purposeLabel}.`,
      imageType === 'after_repair' ? 'repair_completed' : 'work_update'
    );

    logAuditEvent({
      userId: user.id,
      action: 'REPAIR_EVIDENCE_UPLOADED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        image_type: imageType,
        photo_count: savedImages.length,
      },
    });

    return res.status(201).json({
      message: `${savedImages.length} evidence photo(s) uploaded successfully.`,
      images: savedImages,
    });
  } catch (error) {
    cleanupFiles(writtenFiles);
    console.error('[Upload Repair Evidence Error]:', error);
    return res.status(500).json({ error: 'Internal server error uploading repair evidence.' });
  }
}

/**
 * POST /api/official/complaints/:id/accept
 * Formally acknowledges and accepts a routed complaint into the department's active queue.
 * Invariant: Platform does not claim official acknowledgment until this action is executed.
 */
export function acceptComplaint(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const complaint = db.prepare(`
      SELECT c.*, d.name as department_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.id = ?
    `).get(id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials can only accept complaints routed to their own department.',
      });
    }

    if (complaint.accepted_by_user_id) {
      return res.status(400).json({
        error: 'Complaint has already been accepted.',
        accepted_at: complaint.accepted_at,
        accepted_by_user_id: complaint.accepted_by_user_id,
      });
    }

    const newStatus = complaint.status === 'Submitted' ? 'Assigned' : complaint.status;
    const assignedOfficialId = complaint.assigned_official_id || user.id;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE complaints
        SET accepted_by_user_id = ?,
            accepted_at = CURRENT_TIMESTAMP,
            assigned_official_id = ?,
            status = ?,
            routing_status = 'accepted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(user.id, assignedOfficialId, newStatus, id);

      // Record status history
      const historyId = `hist-${uuidv4()}`;
      db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        historyId,
        id,
        user.id,
        complaint.status,
        newStatus,
        `Complaint formally acknowledged and accepted by official ${user.full_name}.`
      );

      // Record assignment if freshly assigned
      if (!complaint.assigned_official_id) {
        const assignId = `asgn-${uuidv4()}`;
        db.prepare(`
          INSERT INTO complaint_assignments (id, complaint_id, assigned_official_id, assigned_by_user_id, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(assignId, id, assignedOfficialId, user.id, 'Self-assigned upon official department acceptance.');
      }

      // Record Multilingual Notification: Department Accepted & Assigned
      createCitizenNotification({
        complaintId: id,
        citizenId: complaint.citizen_id,
        eventType: 'department_assigned',
        targetLanguage: complaint.detected_language || complaint.language_preference || 'English',
        ticketNumber: complaint.ticket_number,
        departmentName: complaint.department_name || 'Assigned Department',
        dbInstance: db,
      });

      db.exec('COMMIT;');
    } catch (txErr) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw txErr;
    }

    logAuditEvent({
      userId: user.id,
      action: 'COMPLAINT_ACCEPTED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        department_id: complaint.department_id,
        accepted_by: user.full_name,
      },
    });

    const updated = db.prepare(`
      SELECT c.*, d.name as department_name, off.full_name as assigned_official_name, acc.full_name as accepted_by_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN users off ON c.assigned_official_id = off.id
      LEFT JOIN users acc ON c.accepted_by_user_id = acc.id
      WHERE c.id = ?
    `).get(id);

    return res.status(200).json({
      message: 'Complaint successfully accepted and acknowledged by department.',
      complaint: updated,
    });
  } catch (error) {
    console.error('[Accept Complaint Error]:', error);
    return res.status(500).json({ error: 'Internal server error accepting complaint.' });
  }
}

/**
 * POST /api/official/complaints/:id/reassign-department
 * Reassigns complaint to a different municipal department with mandatory operational reason.
 * Invariant: Preserves original AI recommendation and logs full audit trail.
 */
export function reassignDepartment(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = reassignDepartmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { target_department_id, reassignment_reason } = parseResult.data;

    const complaint = db.prepare(`
      SELECT c.*, d.name as current_department_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.id = ?
    `).get(id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    // Role check: official can only reassign complaints in their department
    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials can only reassign complaints currently assigned to their department.',
      });
    }

    // Verify target department
    const targetDept = db.prepare('SELECT id, name, is_active FROM departments WHERE id = ?').get(target_department_id);
    if (!targetDept) {
      return res.status(400).json({ error: 'Target department does not exist.' });
    }
    if (targetDept.is_active === 0) {
      return res.status(400).json({ error: 'Cannot reassign to an inactive department.' });
    }

    if (complaint.department_id === target_department_id) {
      return res.status(400).json({ error: 'Complaint is already assigned to the target department.' });
    }

    // Reassignment status transition
    const newStatus = (complaint.status === 'Assigned' || complaint.status === 'In Progress') ? 'Under Review' : complaint.status;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE complaints
        SET department_id = ?,
            assigned_official_id = NULL,
            accepted_by_user_id = NULL,
            accepted_at = NULL,
            routing_status = 'manually_assigned',
            requires_manual_review = 0,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(target_department_id, newStatus, id);

      // Preserve original AI recommendation in audit log
      const auditId = `dra-${uuidv4()}`;
      db.prepare(`
        INSERT INTO department_routing_audit (
          id, complaint_id,
          recommended_department_id, recommended_department_name,
          secondary_department_id, secondary_department_name,
          assigned_department_id, assigned_department_name,
          assigned_by_user_id, assigned_by_type,
          confidence_score, routing_reason, reassignment_reason,
          requires_manual_review
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        auditId,
        id,
        complaint.recommended_department_id,
        (db.prepare('SELECT name FROM departments WHERE id = ?').get(complaint.recommended_department_id) || {}).name || null,
        complaint.secondary_department_id,
        (db.prepare('SELECT name FROM departments WHERE id = ?').get(complaint.secondary_department_id) || {}).name || null,
        target_department_id,
        targetDept.name,
        user.id,
        user.role,
        complaint.routing_confidence,
        complaint.routing_reason,
        reassignment_reason
      );

      // Status history note
      const histId = `hist-${uuidv4()}`;
      db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        histId,
        id,
        user.id,
        complaint.status,
        newStatus,
        `Reassigned from ${complaint.current_department_name || 'Unassigned'} to ${targetDept.name}. Reason: ${reassignment_reason}`
      );

      // Record Multilingual Notification: Department Reassigned
      createCitizenNotification({
        complaintId: id,
        citizenId: complaint.citizen_id,
        eventType: 'department_assigned',
        targetLanguage: complaint.detected_language || complaint.language_preference || 'English',
        ticketNumber: complaint.ticket_number,
        departmentName: targetDept.name,
        dbInstance: db,
      });

      db.exec('COMMIT;');
    } catch (txErr) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw txErr;
    }

    logAuditEvent({
      userId: user.id,
      action: 'DEPARTMENT_REASSIGNED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        previous_department: complaint.current_department_name,
        new_department: targetDept.name,
        reason: reassignment_reason,
      },
    });

    const updated = db.prepare(`
      SELECT c.*, d.name as department_name, d.code as department_code
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.id = ?
    `).get(id);

    return res.status(200).json({
      message: `Complaint successfully reassigned to ${targetDept.name}.`,
      complaint: updated,
    });
  } catch (error) {
    console.error('[Reassign Department Error]:', error);
    return res.status(500).json({ error: 'Internal server error reassigning department.' });
  }
}

/**
 * GET /api/official/complaints/:id/routing-history
 * Returns the immutable assignment and routing history for a complaint
 */
export function getRoutingHistory(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const complaint = db.prepare('SELECT id, department_id FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials cannot access audit trails outside their department.',
      });
    }

    const history = db.prepare(`
      SELECT dra.*, u.full_name as assigned_by_name, u.role as assigned_by_role
      FROM department_routing_audit dra
      LEFT JOIN users u ON dra.assigned_by_user_id = u.id
      WHERE dra.complaint_id = ?
      ORDER BY dra.created_at ASC
    `).all(id);

    return res.status(200).json({ routing_history: history });
  } catch (error) {
    console.error('[Get Routing History Error]:', error);
    return res.status(500).json({ error: 'Internal server error fetching routing history.' });
  }
}

/**
 * POST /api/official/complaints/:id/revise-translation
 * Municipal officials can read the original complaint, view the detected language,
 * and generate a revised translation with Gemini or save manual corrections.
 */
export async function reviseTranslation(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    if (user.role === 'official' && user.department_id && complaint.department_id !== user.department_id) {
      return res.status(403).json({
        error: 'Access denied: Officials cannot revise translations for complaints outside their department.',
      });
    }

    const action = req.body?.action || 'manual_edit';
    const english_translation = req.body?.english_translation || req.body?.revised_translation;
    const translation_notes = req.body?.translation_notes || req.body?.revision_notes;

    let revisedTranslation = english_translation;
    let confidence = complaint.translation_confidence || 100;
    let detectedLang = complaint.detected_language || 'English';

    if (action === 'regenerate') {
      const result = await processMultilingualComplaint({
        title: complaint.title,
        description: complaint.original_text || complaint.description,
        languagePreference: complaint.language_preference || 'auto',
        context: {
          category: complaint.category,
          address: complaint.address,
          landmark: complaint.landmark,
          officialNotes: translation_notes,
        },
        client: req.app?.locals?.geminiClient,
      });

      revisedTranslation = result.english_translation;
      confidence = result.translation_confidence;
      detectedLang = result.detected_language;
    } else {
      if (!english_translation || typeof english_translation !== 'string' || !english_translation.trim()) {
        return res.status(400).json({ error: 'A valid revised English translation is required.' });
      }
      revisedTranslation = english_translation.trim();
    }

    db.prepare(`
      UPDATE complaints
      SET english_translation = ?,
          translation_notes = ?,
          translation_confidence = ?,
          detected_language = ?,
          translation_revised_by_user_id = ?,
          translation_revised_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      revisedTranslation,
      translation_notes || null,
      confidence,
      detectedLang,
      user.id,
      id
    );

    const updated = db.prepare(`
      SELECT id, ticket_number, detected_language, original_text, english_translation,
             translation_confidence, translation_revised_at, translation_notes
      FROM complaints
      WHERE id = ?
    `).get(id);

    logAuditEvent({
      userId: user.id,
      action: 'TRANSLATION_REVISED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        action,
        revised_by: user.full_name,
      },
    });

    return res.status(200).json({
      message: 'Complaint translation revised successfully.',
      complaint: updated,
      english_translation: updated.english_translation,
      translation_notes: updated.translation_notes,
      translation_confidence: updated.translation_confidence,
      detected_language: updated.detected_language,
    });
  } catch (error) {
    console.error('[Revise Translation Error]:', error);
    return res.status(500).json({ error: 'Internal server error revising translation.' });
  }
}

/**
 * GET /api/official/notifications
 * Returns recent task assignment and deadline notifications for the official
 */
export function getOfficialNotifications(req, res) {
  try {
    const user = req.user;
    const notifications = db.prepare(`
      SELECT n.*, c.ticket_number
      FROM official_notifications n
      LEFT JOIN complaints c ON n.complaint_id = c.id
      WHERE n.official_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(user.id);

    return res.status(200).json({ notifications });
  } catch (error) {
    console.error('[Get Official Notifications Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving official notifications.' });
  }
}

