import db from '../config/database.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts endpoint access to specific authorized user roles.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
}

/**
 * Department Restriction Middleware
 * Ensures officials can only access resources matching their assigned department.
 * Admins are permitted cross-departmental oversight.
 */
export function requireDepartment(deptCodeOrId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Admins have cross-department oversight
    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'official') {
      return res.status(403).json({ error: 'Access restricted to departmental officials.' });
    }

    if (
      req.user.department_id !== deptCodeOrId &&
      req.user.department_code !== deptCodeOrId
    ) {
      return res.status(403).json({
        error: 'Access restricted: You are not assigned to this municipal department.',
      });
    }

    next();
  };
}

/**
 * Complaint Resource Authorization Middleware
 * Enforces that:
 * 1. Citizens can ONLY access complaints they personally reported.
 * 2. Officials can ONLY access complaints assigned to their department.
 * 3. Admins have system-wide access to all complaints.
 */
export function authorizeComplaintAccess(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Admins can access all complaints
    if (req.user.role === 'admin') {
      return next();
    }

    const complaintId = req.params[paramName] || req.body.complaint_id || req.query.complaint_id;
    if (!complaintId) {
      return res.status(400).json({ error: 'Complaint identifier is required.' });
    }

    const complaint = db.prepare(
      'SELECT id, citizen_id, department_id, title FROM complaints WHERE id = ?'
    ).get(complaintId);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    // Citizens: must be the original reporter
    if (req.user.role === 'citizen') {
      if (complaint.citizen_id !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied: Citizens may only access their own submitted complaints.',
        });
      }
      req.complaint = complaint;
      return next();
    }

    // Officials: must belong to the assigned department
    if (req.user.role === 'official') {
      if (req.user.department_id && complaint.department_id !== req.user.department_id) {
        return res.status(403).json({
          error: 'Access denied: Officials cannot access complaints outside their assigned department.',
        });
      }
      req.complaint = complaint;
      return next();
    }

    return res.status(403).json({ error: 'Access denied.' });
  };
}
