import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import {
  createGrievanceSchema,
  respondGrievanceSchema,
  updateGrievanceStatusSchema,
} from '../validators/adminValidators.js';
import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Grievance Support Controller
 * Allows citizens and engineers to submit grievances regarding municipal works,
 * service delays, escalations, or operational issues, and enables the Admin
 * to review, respond, and update status.
 */

/**
 * POST /api/grievances
 * Submits a new grievance (Citizens & Officials/Engineers)
 */
export function submitGrievance(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to submit a grievance.' });
    }

    const parseResult = createGrievanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { subject, description, related_complaint_id, department_id } = parseResult.data;

    // Verify related complaint if provided
    if (related_complaint_id) {
      const comp = db.prepare('SELECT id FROM complaints WHERE id = ?').get(related_complaint_id);
      if (!comp) {
        return res.status(400).json({ error: 'Related complaint not found.' });
      }
    }

    const grievanceId = `grv-${uuidv4()}`;
    const randomSeq = Math.floor(10000 + Math.random() * 90000);
    const trackingNumber = `GRV-2026-${randomSeq}`;

    db.prepare(`
      INSERT INTO grievances (
        id, tracking_number, complainant_user_id, complainant_name,
        complainant_email, complainant_role, complainant_phone,
        department_id, related_complaint_id, subject, description,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      grievanceId,
      trackingNumber,
      user.id,
      user.full_name,
      user.email,
      user.role,
      user.phone || null,
      department_id || user.department_id || null,
      related_complaint_id || null,
      subject,
      description
    );

    logAuditEvent({
      userId: user.id,
      action: 'GRIEVANCE_SUBMITTED',
      targetEntity: 'grievance',
      targetId: grievanceId,
      ipAddress: req.ip,
      details: { tracking_number: trackingNumber, subject },
    });

    return res.status(201).json({
      success: true,
      message: 'Grievance submitted successfully. Municipal administration will review and respond.',
      grievance: {
        id: grievanceId,
        tracking_number: trackingNumber,
        subject,
        description,
        status: 'Pending',
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Submit Grievance Error]:', error);
    return res.status(500).json({ error: 'Internal server error submitting grievance.' });
  }
}

/**
 * GET /api/grievances/my
 * Retrieves grievances submitted by the current authenticated user
 */
export function getMyGrievances(req, res) {
  try {
    const user = req.user;
    const grievances = db.prepare(`
      SELECT 
        g.id, g.tracking_number, g.subject, g.description, g.status,
        g.related_complaint_id, g.created_at, g.updated_at,
        c.ticket_number as related_ticket_number,
        (SELECT COUNT(*) FROM grievance_responses WHERE grievance_id = g.id) as response_count
      FROM grievances g
      LEFT JOIN complaints c ON g.related_complaint_id = c.id
      WHERE g.complainant_user_id = ?
      ORDER BY g.created_at DESC
    `).all(user.id);

    return res.status(200).json({ grievances });
  } catch (error) {
    console.error('[Get My Grievances Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving grievances.' });
  }
}

/**
 * GET /api/grievances/:id
 * Retrieves a single grievance with response history for the complainant
 */
export function getMyGrievanceById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const grievance = db.prepare(`
      SELECT 
        g.*, c.ticket_number as related_ticket_number, c.title as related_complaint_title
      FROM grievances g
      LEFT JOIN complaints c ON g.related_complaint_id = c.id
      WHERE g.id = ?
    `).get(id);

    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    // Must be complainant or admin
    if (grievance.complainant_user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: You cannot view this grievance.' });
    }

    const responses = db.prepare(`
      SELECT 
        id, responder_name, responder_role, response_text, status_change, created_at
      FROM grievance_responses
      WHERE grievance_id = ?
      ORDER BY created_at ASC
    `).all(id);

    return res.status(200).json({ grievance, responses });
  } catch (error) {
    console.error('[Get Grievance By Id Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving grievance.' });
  }
}

/**
 * GET /api/admin/grievances
 * Admin portal grievance inspection and management
 */
export function getAdminGrievances(req, res) {
  try {
    const { status, role, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ['1=1'];
    const params = [];

    if (status && status !== 'all') {
      whereClauses.push('g.status = ?');
      params.push(status);
    }

    if (role && role !== 'all') {
      whereClauses.push('g.complainant_role = ?');
      params.push(role);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(g.tracking_number LIKE ? OR g.subject LIKE ? OR g.complainant_name LIKE ? OR g.complainant_email LIKE ?)');
      params.push(term, term, term, term);
    }

    const whereString = whereClauses.join(' AND ');

    // Aggregate statistics
    const metrics = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Under Review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN complainant_role = 'citizen' THEN 1 ELSE 0 END) as citizen_count,
        SUM(CASE WHEN complainant_role != 'citizen' THEN 1 ELSE 0 END) as engineer_count
      FROM grievances
    `).get();

    // Total filtered records
    const totalFiltered = db.prepare(`
      SELECT COUNT(*) as count FROM grievances g WHERE ${whereString}
    `).get(...params).count;

    // Filtered page
    const grievances = db.prepare(`
      SELECT 
        g.id, g.tracking_number, g.complainant_user_id, g.complainant_name,
        g.complainant_email, g.complainant_role, g.complainant_phone,
        g.subject, g.description, g.status, g.admin_notes, g.created_at, g.updated_at,
        c.ticket_number as related_ticket_number,
        d.name as department_name,
        (SELECT COUNT(*) FROM grievance_responses WHERE grievance_id = g.id) as response_count
      FROM grievances g
      LEFT JOIN complaints c ON g.related_complaint_id = c.id
      LEFT JOIN departments d ON g.department_id = d.id
      WHERE ${whereString}
      ORDER BY 
        CASE WHEN g.status = 'Pending' THEN 1 WHEN g.status = 'Under Review' THEN 2 ELSE 3 END,
        g.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    return res.status(200).json({
      metrics,
      grievances,
      pagination: {
        total: totalFiltered,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalFiltered / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('[Get Admin Grievances Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving grievances.' });
  }
}

/**
 * GET /api/admin/grievances/:id
 * Admin details view with complete response thread
 */
export function getAdminGrievanceById(req, res) {
  try {
    const { id } = req.params;

    const grievance = db.prepare(`
      SELECT 
        g.*, c.ticket_number as related_ticket_number, c.title as related_complaint_title,
        d.name as department_name
      FROM grievances g
      LEFT JOIN complaints c ON g.related_complaint_id = c.id
      LEFT JOIN departments d ON g.department_id = d.id
      WHERE g.id = ?
    `).get(id);

    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    const responses = db.prepare(`
      SELECT 
        id, responder_name, responder_role, response_text, status_change, created_at
      FROM grievance_responses
      WHERE grievance_id = ?
      ORDER BY created_at ASC
    `).all(id);

    return res.status(200).json({ grievance, responses });
  } catch (error) {
    console.error('[Get Admin Grievance Details Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving grievance details.' });
  }
}

/**
 * POST /api/admin/grievances/:id/respond
 * Admin submits an official response and optionally updates status
 */
export function respondToGrievance(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = respondGrievanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { response_text, status } = parseResult.data;

    const grievance = db.prepare('SELECT id, tracking_number, status, complainant_user_id FROM grievances WHERE id = ?').get(id);
    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    const responseId = `grvr-${uuidv4()}`;
    const newStatus = status || grievance.status;

    // Record response
    db.prepare(`
      INSERT INTO grievance_responses (
        id, grievance_id, responder_user_id, responder_name, responder_role, response_text, status_change
      ) VALUES (?, ?, ?, ?, 'admin', ?, ?)
    `).run(
      responseId,
      id,
      user.id,
      user.full_name,
      response_text,
      status && status !== grievance.status ? status : null
    );

    // Update grievance status and timestamp
    if (status && status !== grievance.status) {
      db.prepare(`
        UPDATE grievances
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, id);
    } else {
      db.prepare(`
        UPDATE grievances SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(id);
    }

    logAuditEvent({
      userId: user.id,
      action: 'GRIEVANCE_RESPONDED',
      targetEntity: 'grievance',
      targetId: id,
      ipAddress: req.ip,
      details: {
        tracking_number: grievance.tracking_number,
        from_status: grievance.status,
        to_status: newStatus,
        response_text,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Grievance response recorded successfully.',
      response: {
        id: responseId,
        responder_name: user.full_name,
        response_text,
        status_change: status || null,
        created_at: new Date().toISOString(),
      },
      current_status: newStatus,
    });
  } catch (error) {
    console.error('[Respond to Grievance Error]:', error);
    return res.status(500).json({ error: 'Internal server error responding to grievance.' });
  }
}

/**
 * PATCH /api/admin/grievances/:id/status
 * Admin updates status of grievance (Pending, Under Review, Resolved, Rejected)
 */
export function updateGrievanceStatus(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = updateGrievanceStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { status, admin_notes } = parseResult.data;

    const grievance = db.prepare('SELECT id, tracking_number, status FROM grievances WHERE id = ?').get(id);
    if (!grievance) {
      return res.status(404).json({ error: 'Grievance not found.' });
    }

    const fromStatus = grievance.status;

    db.prepare(`
      UPDATE grievances
      SET status = ?,
          admin_notes = COALESCE(?, admin_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, admin_notes || null, id);

    // Record response note for audit trail
    const responseId = `grvr-${uuidv4()}`;
    db.prepare(`
      INSERT INTO grievance_responses (
        id, grievance_id, responder_user_id, responder_name, responder_role, response_text, status_change
      ) VALUES (?, ?, ?, ?, 'admin', ?, ?)
    `).run(
      responseId,
      id,
      user.id,
      user.full_name,
      admin_notes ? `Status changed from ${fromStatus} to ${status}: ${admin_notes}` : `Status updated to ${status}.`,
      status
    );

    logAuditEvent({
      userId: user.id,
      action: 'GRIEVANCE_STATUS_UPDATED',
      targetEntity: 'grievance',
      targetId: id,
      ipAddress: req.ip,
      details: {
        tracking_number: grievance.tracking_number,
        from_status: fromStatus,
        to_status: status,
        admin_notes,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Grievance status updated to '${status}'.`,
      id,
      tracking_number: grievance.tracking_number,
      from_status: fromStatus,
      to_status: status,
    });
  } catch (error) {
    console.error('[Update Grievance Status Error]:', error);
    return res.status(500).json({ error: 'Internal server error updating grievance status.' });
  }
}
