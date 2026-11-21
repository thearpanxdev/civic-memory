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
