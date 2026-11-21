import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

/**
 * Complaint Controller
 * Handles complaint querying, detail inspection, status updates, and community support
 * with strict server-side authorization and departmental boundaries.
 */

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
      return res.status(200).json({ complaints: myComplaints });
    }

    // 2. Official queue inspection: STRICT departmental isolation
    if (user && user.role === 'official') {
      // If an official tries to query a department other than their own, REJECT
      if (departmentFilter && departmentFilter !== user.department_id) {
        return res.status(403).json({
          error: 'Access denied: Officials may only query complaints for their assigned department.',
        });
      }

      // Automatically scope official view to their assigned department
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

    // 4. Public / Citizen general feed: non-sensitive public data only
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
    // 1. Admin: Allowed
    if (user.role === 'admin') {
      return res.status(200).json({ complaint });
    }

    // 2. Official: Must match assigned department
    if (user.role === 'official') {
      if (user.department_id && complaint.department_id !== user.department_id) {
        return res.status(403).json({
          error: 'Access denied: Officials cannot view complaints outside their assigned department.',
        });
      }
      return res.status(200).json({ complaint });
    }

    // 3. Citizen: Can only view their own private complaint details
    if (user.role === 'citizen') {
      if (complaint.citizen_id !== user.id) {
        return res.status(403).json({
          error: 'Access denied: Citizens cannot access private complaint details submitted by other citizens.',
        });
      }
      return res.status(200).json({ complaint });
    }

    return res.status(403).json({ error: 'Access denied.' });
  } catch (error) {
    console.error('[Get Complaint By ID Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving complaint details.' });
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
