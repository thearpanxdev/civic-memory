import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { setDeadlineSchema } from '../validators/adminValidators.js';
import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Task Deadline Controller (Admin-Only Authority)
 * Manages task deadlines for municipal complaints and work orders.
 *
 * Security Invariant:
 * - Only users with the 'admin' role can create, modify, extend, or remove task deadlines.
 * - Engineers/officials can view deadlines but are strictly forbidden from creating, modifying,
 *   extending, or removing them (HTTP 403 Forbidden).
 */

/**
 * POST /api/admin/complaints/:id/deadline
 * Sets, updates, or extends a task deadline (Admin only)
 */
export function setComplaintDeadline(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    // Strict RBAC: Only Admin can set or modify deadlines
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied: Only users with the Admin role can set, modify, extend, or remove task deadlines.',
      });
    }

    const parseResult = setDeadlineSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { deadline_at, consultation_notes } = parseResult.data;

    // Verify complaint exists
    const complaint = db
      .prepare('SELECT id, ticket_number, title, department_id, assigned_official_id, deadline_at FROM complaints WHERE id = ?')
      .get(id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    const previousDeadline = complaint.deadline_at;
    const isNew = !previousDeadline;
    const isExtended = previousDeadline && new Date(deadline_at).getTime() > new Date(previousDeadline).getTime();
    const action = isNew ? 'SET' : (isExtended ? 'EXTENDED' : 'MODIFIED');

    // Update complaint record
    db.prepare(`
      UPDATE complaints
      SET deadline_at = ?,
          deadline_set_by_admin_id = ?,
          deadline_set_at = CURRENT_TIMESTAMP,
          deadline_consultation_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(deadline_at, user.id, consultation_notes || null, id);

    // Record in immutable deadline audit history
    const historyId = `dlh-${uuidv4()}`;
    db.prepare(`
      INSERT INTO complaint_deadlines_history (
        id, complaint_id, assigned_official_id, set_by_admin_id,
        previous_deadline_at, new_deadline_at, consultation_notes, action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      historyId,
      id,
      complaint.assigned_official_id || null,
      user.id,
      previousDeadline || null,
      deadline_at,
      consultation_notes || null,
      action
    );

    // Notify assigned engineer if task is assigned
    if (complaint.assigned_official_id) {
      const notifId = `onotif-${uuidv4()}`;
      const formattedDate = new Date(deadline_at).toLocaleString();
      const notifMessage = `Administrator ${user.full_name} set task deadline for ticket ${complaint.ticket_number} to ${formattedDate}.${consultation_notes ? ' Consultation Notes: ' + consultation_notes : ''}`;

      db.prepare(`
        INSERT INTO official_notifications (id, official_id, complaint_id, event_type, title, message)
        VALUES (?, ?, ?, 'deadline_assigned', 'Task Deadline Assigned / Updated', ?)
      `).run(notifId, complaint.assigned_official_id, id, notifMessage);

      // Also append progress update for audit trail visibility
      const progId = `prog-${uuidv4()}`;
      db.prepare(`
        INSERT INTO complaint_progress_updates (id, complaint_id, official_id, message, update_type)
        VALUES (?, ?, ?, ?, 'note')
      `).run(progId, id, user.id, `Task deadline set to ${formattedDate} by Administrator. ${consultation_notes || ''}`);
    }

    // System audit log
    logAuditEvent({
      userId: user.id,
      action: isNew ? 'TASK_DEADLINE_SET' : 'TASK_DEADLINE_MODIFIED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        action,
        previous_deadline: previousDeadline,
        new_deadline: deadline_at,
        consultation_notes,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Task deadline successfully ${action.toLowerCase()}.`,
      complaint_id: id,
      ticket_number: complaint.ticket_number,
      deadline_at,
      previous_deadline_at: previousDeadline,
      consultation_notes: consultation_notes || null,
      action,
    });
  } catch (error) {
    console.error('[Set Complaint Deadline Error]:', error);
    return res.status(500).json({ error: 'Internal server error setting task deadline.' });
  }
}

/**
 * DELETE /api/admin/complaints/:id/deadline
 * Removes a task deadline (Admin only)
 */
export function removeComplaintDeadline(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    // Strict RBAC: Only Admin can remove deadlines
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied: Only users with the Admin role can set, modify, extend, or remove task deadlines.',
      });
    }

    const complaint = db
      .prepare('SELECT id, ticket_number, assigned_official_id, deadline_at FROM complaints WHERE id = ?')
      .get(id);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    const previousDeadline = complaint.deadline_at;
    if (!previousDeadline) {
      return res.status(400).json({ error: 'Complaint does not have an active deadline to remove.' });
    }

    // Clear deadline
    db.prepare(`
      UPDATE complaints
      SET deadline_at = NULL,
          deadline_set_by_admin_id = NULL,
          deadline_set_at = NULL,
          deadline_consultation_notes = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    // Record in history
    const historyId = `dlh-${uuidv4()}`;
    db.prepare(`
      INSERT INTO complaint_deadlines_history (
        id, complaint_id, assigned_official_id, set_by_admin_id,
        previous_deadline_at, new_deadline_at, consultation_notes, action
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'REMOVED')
    `).run(
      historyId,
      id,
      complaint.assigned_official_id || null,
      user.id,
      previousDeadline,
      'Deadline removed by administrator.'
    );

    // Notify engineer
    if (complaint.assigned_official_id) {
      const notifId = `onotif-${uuidv4()}`;
      db.prepare(`
        INSERT INTO official_notifications (id, official_id, complaint_id, event_type, title, message)
        VALUES (?, ?, ?, 'deadline_removed', 'Task Deadline Removed', ?)
      `).run(
        notifId,
        complaint.assigned_official_id,
        id,
        `Task deadline for ticket ${complaint.ticket_number} was removed by Administrator ${user.full_name}.`
      );
    }

    logAuditEvent({
      userId: user.id,
      action: 'TASK_DEADLINE_REMOVED',
      targetEntity: 'complaint',
      targetId: id,
      ipAddress: req.ip,
      details: {
        ticket_number: complaint.ticket_number,
        previous_deadline: previousDeadline,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Task deadline successfully removed.',
      complaint_id: id,
      ticket_number: complaint.ticket_number,
    });
  } catch (error) {
    console.error('[Remove Complaint Deadline Error]:', error);
    return res.status(500).json({ error: 'Internal server error removing task deadline.' });
  }
}

/**
 * GET /api/admin/complaints/:id/deadline-history
 * Retrieves full audit history of deadline changes for a complaint
 */
export function getComplaintDeadlineHistory(req, res) {
  try {
    const { id } = req.params;

    const history = db.prepare(`
      SELECT 
        h.id, h.complaint_id, h.action, h.previous_deadline_at, h.new_deadline_at,
        h.consultation_notes, h.created_at,
        u.full_name as set_by_admin_name, u.email as set_by_admin_email,
        off.full_name as assigned_official_name, off.email as assigned_official_email
      FROM complaint_deadlines_history h
      LEFT JOIN users u ON h.set_by_admin_id = u.id
      LEFT JOIN users off ON h.assigned_official_id = off.id
      WHERE h.complaint_id = ?
      ORDER BY h.created_at DESC
    `).all(id);

    return res.status(200).json({ history });
  } catch (error) {
    console.error('[Get Complaint Deadline History Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving deadline history.' });
  }
}
