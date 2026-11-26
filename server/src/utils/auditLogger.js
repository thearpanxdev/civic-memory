import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

/**
 * System Audit Logging Utility
 * Records all critical administrative, departmental, and lifecycle mutations.
 * 
 * Rules:
 * - Actor ID is required for authenticated actions.
 * - Sensitive credentials (passwords, JWTs, cookies) MUST NEVER be logged.
 * - Audit logs are append-only.
 */

export function logAuditEvent({
  userId = null,
  action,
  targetEntity,
  targetId = null,
  details = null,
  ipAddress = null,
}) {
  try {
    const id = `audit-${uuidv4()}`;
    const serializedDetails = details
      ? (typeof details === 'string' ? details : JSON.stringify(details))
      : null;

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_entity, target_id, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, action, targetEntity, targetId, ipAddress, serializedDetails);

    return id;
  } catch (err) {
    console.error('[Audit Log Error]: Failed to persist audit event:', err);
    return null;
  }
}

/**
 * Retrieves paginated audit logs with optional filters
 */
export function getAuditLogs({ limit = 50, offset = 0, action = null, targetEntity = null } = {}) {
  let query = `
    SELECT a.*, u.full_name as user_name, u.email as user_email, u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (action) {
    query += ' AND a.action = ?';
    params.push(action);
  }

  if (targetEntity) {
    query += ' AND a.target_entity = ?';
    params.push(targetEntity);
  }

  query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}
