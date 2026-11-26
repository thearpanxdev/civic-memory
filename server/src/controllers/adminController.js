import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import {
  createOfficialSchema,
  updateOfficialDeptSchema,
  toggleOfficialStatusSchema,
} from '../validators/adminValidators.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../validators/departmentRoutingValidators.js';
import { logAuditEvent, getAuditLogs } from '../utils/auditLogger.js';

/**
 * Municipal Administrator Controller — Phase 2D
 * Handles:
 * - System-wide cross-departmental KPI overview & dashboards
 * - Department workload & configuration
 * - Official account provisioning, department reassignment & status toggling
 * - Comprehensive system analytics (status, department, ward, chronic clusters)
 * - Immutable system audit log inspection
 */

/**
 * GET /api/admin/dashboard
 * High-level municipal platform health and executive metrics
 */
export function getAdminDashboard(req, res) {
  try {
    // 1. Overall counts
    const complaintCounts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN relation_type != 'duplicate' THEN 1 ELSE 0 END) as unique_issues,
        SUM(CASE WHEN relation_type = 'duplicate' THEN 1 ELSE 0 END) as duplicate_reports,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'Under Review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN status = 'Verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status IN ('Work Completed', 'Awaiting Citizen Verification') THEN 1 ELSE 0 END) as awaiting_verification,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'Reopened' THEN 1 ELSE 0 END) as reopened,
        SUM(CASE WHEN severity IN ('high', 'critical') AND status NOT IN ('Resolved') THEN 1 ELSE 0 END) as high_critical_open,
        SUM(CASE WHEN relation_type = 'recurring' THEN 1 ELSE 0 END) as recurring_count,
        SUM(CASE WHEN assigned_official_id IS NULL AND status NOT IN ('Resolved', 'Work Completed') THEN 1 ELSE 0 END) as unassigned_count
      FROM complaints
    `).get();

    const totalSupportingReports = (complaintCounts.duplicate_reports || 0) + (
      db.prepare('SELECT COUNT(*) as count FROM complaint_supporters').get().count || 0
    );

    const userCounts = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'citizen' THEN 1 ELSE 0 END) as total_citizens,
        SUM(CASE WHEN role = 'official' THEN 1 ELSE 0 END) as total_officials,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as total_admins,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users
      FROM users
    `).get();

    const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
    const wardCount = db.prepare('SELECT COUNT(*) as count FROM wards').get().count;

    // Chronic recurring clusters count
    const chronicClustersCount = db.prepare(`
      SELECT COUNT(DISTINCT root_incident_id) as count
      FROM complaints
      WHERE relation_type = 'recurring' AND root_incident_id IS NOT NULL
    `).get().count;

    // Most frequently reported recurring and supported problems
    const mostFrequentlyReported = db.prepare(`
      SELECT 
        c.id, c.ticket_number, c.title, c.category, c.status, c.support_count,
        c.address, c.created_at,
        (SELECT COUNT(*) FROM complaints WHERE duplicate_of_id = c.id) as duplicate_count,
        d.name as department_name,
        w.name as ward_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN wards w ON c.ward_id = w.id
      WHERE c.relation_type != 'duplicate'
      ORDER BY (c.support_count + (SELECT COUNT(*) FROM complaints WHERE duplicate_of_id = c.id)) DESC
      LIMIT 5
    `).all();

    // Locations with repeated complaints (duplicate or recurring)
    const repeatedComplaintLocations = db.prepare(`
      SELECT 
        c.address, c.ward_id, w.name as ward_name,
        COUNT(c.id) as total_reports,
        SUM(CASE WHEN c.relation_type != 'duplicate' THEN 1 ELSE 0 END) as unique_issues,
        SUM(CASE WHEN c.relation_type = 'duplicate' THEN 1 ELSE 0 END) as duplicate_reports,
        SUM(CASE WHEN c.relation_type = 'recurring' THEN 1 ELSE 0 END) as recurring_reports
      FROM complaints c
      LEFT JOIN wards w ON c.ward_id = w.id
      GROUP BY c.ward_id, c.address
      HAVING total_reports > 1
      ORDER BY total_reports DESC
      LIMIT 5
    `).all();

    // Recent 5 complaints across all departments
    const recentComplaints = db.prepare(`
      SELECT 
        c.id, c.ticket_number, c.title, c.category, c.severity, c.status,
        c.relation_type, c.created_at,
        d.name as department_name,
        w.name as ward_name,
        u.full_name as citizen_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN wards w ON c.ward_id = w.id
      LEFT JOIN users u ON c.citizen_id = u.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `).all();

    // Recent 5 audit logs
    const recentAuditLogs = db.prepare(`
      SELECT a.*, u.full_name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `).all();

    return res.status(200).json({
      metrics: {
        totalComplaints: complaintCounts.total || 0,
        totalUniqueIssues: complaintCounts.unique_issues || 0,
        totalSupportingReports,
        totalDuplicateReports: complaintCounts.duplicate_reports || 0,
        submitted: complaintCounts.submitted || 0,
        inProgress: complaintCounts.in_progress || 0,
        awaitingVerification: complaintCounts.awaiting_verification || 0,
        resolved: complaintCounts.resolved || 0,
        reopened: complaintCounts.reopened || 0,
        highCriticalOpen: complaintCounts.high_critical_open || 0,
        recurringCount: complaintCounts.recurring_count || 0,
        unassignedCount: complaintCounts.unassigned_count || 0,
        chronicClustersCount,
        totalUsers: userCounts.total_users || 0,
        totalCitizens: userCounts.total_citizens || 0,
        totalOfficials: userCounts.total_officials || 0,
        totalAdmins: userCounts.total_admins || 0,
        activeUsers: userCounts.active_users || 0,
        totalDepartments: deptCount,
        totalWards: wardCount,
      },
      mostFrequentlyReported,
      repeatedComplaintLocations,
      recentComplaints,
      recentAuditLogs,
    });
  } catch (error) {
    console.error('[Admin Dashboard Error]:', error);
    return res.status(500).json({ error: 'Internal server error fetching admin dashboard data.' });
  }
}

/**
 * GET /api/admin/departments
 * Returns all departments with official count and complaint performance metrics
 */
export function getAdminDepartments(req, res) {
  try {
    const departments = db.prepare(`
      SELECT 
        d.id, d.name, d.code, d.description, d.responsibilities, d.routing_rules, d.is_active, d.created_at, d.updated_at,
        (SELECT count(*) FROM users WHERE department_id = d.id AND role = 'official' AND is_active = 1) as official_count,
        (SELECT count(*) FROM complaints WHERE department_id = d.id) as total_complaints,
        (SELECT count(*) FROM complaints WHERE department_id = d.id AND status NOT IN ('Resolved')) as open_complaints,
        (SELECT count(*) FROM complaints WHERE department_id = d.id AND status = 'Resolved') as resolved_complaints,
        (SELECT count(*) FROM complaints WHERE department_id = d.id AND relation_type = 'recurring') as recurring_complaints,
        (SELECT count(*) FROM complaints WHERE department_id = d.id AND requires_manual_review = 1 AND status NOT IN ('Resolved')) as pending_review_complaints
      FROM departments d
      ORDER BY d.name ASC
    `).all();

    return res.status(200).json({ departments });
  } catch (error) {
    console.error('[Admin Get Departments Error]:', error);
    return res.status(500).json({ error: 'Internal server error fetching departments.' });
  }
}

/**
 * POST /api/admin/departments
 * Provisions a new municipal department with responsibilities and routing rules
 */
export function createDepartment(req, res) {
  try {
    const parseResult = createDepartmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, code, description, responsibilities, routing_rules, is_active } = parseResult.data;

    const existingName = db.prepare('SELECT id FROM departments WHERE name = ? COLLATE NOCASE').get(name);
    if (existingName) {
      return res.status(409).json({ error: 'A department with this name already exists.' });
    }

    const existingCode = db.prepare('SELECT id FROM departments WHERE code = ? COLLATE NOCASE').get(code);
    if (existingCode) {
      return res.status(409).json({ error: 'A department with this code already exists.' });
    }

    const id = `dept-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const activeVal = is_active === false || is_active === 0 ? 0 : 1;

    db.prepare(`
      INSERT INTO departments (id, name, code, description, responsibilities, routing_rules, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, code.toUpperCase(), description || '', responsibilities || '', routing_rules || '', activeVal);

    logAuditEvent({
      userId: req.user.id,
      action: 'DEPARTMENT_CREATED',
      targetEntity: 'department',
      targetId: id,
      ipAddress: req.ip,
      details: { name, code: code.toUpperCase() },
    });

    const created = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    return res.status(201).json({
      message: 'Department created successfully.',
      department: created,
    });
  } catch (error) {
    console.error('[Admin Create Department Error]:', error);
    return res.status(500).json({ error: 'Internal server error creating department.' });
  }
}

/**
 * PUT /api/admin/departments/:id
 * Updates an existing department's name, code, description, responsibilities, and routing rules
 */
export function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const parseResult = updateDepartmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    const { name, code, description, responsibilities, routing_rules, is_active } = parseResult.data;

    if (name && name.toLowerCase() !== dept.name.toLowerCase()) {
      const existingName = db.prepare('SELECT id FROM departments WHERE name = ? COLLATE NOCASE AND id != ?').get(name, id);
      if (existingName) {
        return res.status(409).json({ error: 'A department with this name already exists.' });
      }
    }

    if (code && code.toUpperCase() !== dept.code.toUpperCase()) {
      const existingCode = db.prepare('SELECT id FROM departments WHERE code = ? COLLATE NOCASE AND id != ?').get(code, id);
      if (existingCode) {
        return res.status(409).json({ error: 'A department with this code already exists.' });
      }
    }

    const updatedName = name || dept.name;
    const updatedCode = code ? code.toUpperCase() : dept.code;
    const updatedDesc = description !== undefined ? description : dept.description;
    const updatedResp = responsibilities !== undefined ? responsibilities : dept.responsibilities;
    const updatedRules = routing_rules !== undefined ? routing_rules : dept.routing_rules;
    const updatedActive = is_active !== undefined ? (is_active === false || is_active === 0 ? 0 : 1) : dept.is_active;

    db.prepare(`
      UPDATE departments
      SET name = ?, code = ?, description = ?, responsibilities = ?, routing_rules = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedName, updatedCode, updatedDesc, updatedResp, updatedRules, updatedActive, id);

    logAuditEvent({
      userId: req.user.id,
      action: 'DEPARTMENT_UPDATED',
      targetEntity: 'department',
      targetId: id,
      ipAddress: req.ip,
      details: { name: updatedName, code: updatedCode, is_active: updatedActive },
    });

    const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    return res.status(200).json({
      message: 'Department updated successfully.',
      department: updated,
    });
  } catch (error) {
    console.error('[Admin Update Department Error]:', error);
    return res.status(500).json({ error: 'Internal server error updating department.' });
  }
}

/**
 * PATCH /api/admin/departments/:id/status
 * Toggles or updates a department's active status
 */
export function toggleDepartmentStatus(req, res) {
  try {
    const { id } = req.params;
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!dept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    let newStatus;
    if (req.body && req.body.is_active !== undefined) {
      newStatus = req.body.is_active === true || req.body.is_active === 1 ? 1 : 0;
    } else {
      newStatus = dept.is_active === 1 ? 0 : 1;
    }

    db.prepare('UPDATE departments SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);

    logAuditEvent({
      userId: req.user.id,
      action: newStatus === 1 ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED',
      targetEntity: 'department',
      targetId: id,
      ipAddress: req.ip,
      details: { department_name: dept.name, is_active: newStatus },
    });

    const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    return res.status(200).json({
      message: `Department ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
      department: updated,
    });
  } catch (error) {
    console.error('[Admin Toggle Department Status Error]:', error);
    return res.status(500).json({ error: 'Internal server error toggling department status.' });
  }
}

/**
 * GET /api/admin/officials
 * Returns all official accounts with department assignment and workload stats
 */
export function getAdminOfficials(req, res) {
  try {
    const officials = db.prepare(`
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.role, u.department_id, u.is_active, u.created_at, u.updated_at,
        d.name as department_name, d.code as department_code,
        (SELECT count(*) FROM complaints WHERE assigned_official_id = u.id) as total_assigned,
        (SELECT count(*) FROM complaints WHERE assigned_official_id = u.id AND status NOT IN ('Resolved')) as active_assigned
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'official'
      ORDER BY u.full_name ASC
    `).all();

    return res.status(200).json({ officials });
  } catch (error) {
    console.error('[Admin Get Officials Error]:', error);
    return res.status(500).json({ error: 'Internal server error fetching officials.' });
  }
}

/**
 * POST /api/admin/officials
 * Creates a new municipal official account with secure password hashing
 */
export async function createOfficial(req, res) {
  try {
    const user = req.user;
    const parseResult = createOfficialSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { email, password, full_name, phone, department_id } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check email uniqueness
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // Check department exists
    const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(department_id);
    if (!dept) {
      return res.status(400).json({ error: 'Selected department does not exist.' });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const officialId = `user-${uuidv4()}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role, department_id, is_active)
      VALUES (?, ?, ?, ?, ?, 'official', ?, 1)
    `).run(officialId, normalizedEmail, passwordHash, full_name.trim(), phone?.trim() || null, department_id);

    // Audit log
    logAuditEvent({
      userId: user.id,
      action: 'OFFICIAL_CREATED',
      targetEntity: 'user',
      targetId: officialId,
      ipAddress: req.ip,
      details: {
        email: normalizedEmail,
        full_name: full_name.trim(),
        department_id,
        department_name: dept.name,
      },
    });

    return res.status(201).json({
      message: `Official account created successfully for ${full_name}.`,
      official: {
        id: officialId,
        email: normalizedEmail,
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        role: 'official',
        department_id,
        department_name: dept.name,
        is_active: 1,
      },
    });
  } catch (error) {
    console.error('[Admin Create Official Error]:', error);
    return res.status(500).json({ error: 'Internal server error creating official account.' });
  }
}

/**
 * PATCH /api/admin/officials/:id/department
 * Reassigns an official to another municipal department
 */
export function updateOfficialDepartment(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = updateOfficialDeptSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { department_id } = parseResult.data;

    // Verify official exists
    const official = db.prepare('SELECT id, full_name, email, department_id, role FROM users WHERE id = ?').get(id);
    if (!official) {
      return res.status(404).json({ error: 'Official account not found.' });
    }

    if (official.role !== 'official') {
      return res.status(400).json({ error: 'Department assignment is only applicable to official accounts.' });
    }

    // Verify department exists
    const dept = db.prepare('SELECT id, name FROM departments WHERE id = ?').get(department_id);
    if (!dept) {
      return res.status(400).json({ error: 'Selected department does not exist.' });
    }

    const previousDeptId = official.department_id;

    db.prepare(`
      UPDATE users SET department_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(department_id, id);

    logAuditEvent({
      userId: user.id,
      action: 'OFFICIAL_DEPARTMENT_REASSIGNED',
      targetEntity: 'user',
      targetId: id,
      ipAddress: req.ip,
      details: {
        official_name: official.full_name,
        previous_department_id: previousDeptId,
        new_department_id: department_id,
        new_department_name: dept.name,
      },
    });

    return res.status(200).json({
      message: `Official ${official.full_name} successfully reassigned to ${dept.name}.`,
      official_id: id,
      department_id,
      department_name: dept.name,
    });
  } catch (error) {
    console.error('[Admin Update Official Dept Error]:', error);
    return res.status(500).json({ error: 'Internal server error reassigning official department.' });
  }
}

/**
 * PATCH /api/admin/officials/:id/status
 * Toggles an account's active/deactivated status
 * Invariant: Cannot deactivate the last active administrator
 */
export function toggleOfficialStatus(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = toggleOfficialStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { is_active } = parseResult.data;

    const targetUser = db.prepare('SELECT id, full_name, email, role, is_active FROM users WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Invariant: Last active administrator protection
    if (targetUser.role === 'admin' && !is_active) {
      const activeAdminsCount = db.prepare(`
        SELECT count(*) as count FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?
      `).get(id).count;

      if (activeAdminsCount === 0) {
        return res.status(400).json({
          error: 'Security restriction: Cannot deactivate the last active administrator account in the platform.',
        });
      }
    }

    const newStatus = is_active ? 1 : 0;
    db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);

    logAuditEvent({
      userId: user.id,
      action: 'USER_STATUS_TOGGLED',
      targetEntity: 'user',
      targetId: id,
      ipAddress: req.ip,
      details: {
        target_name: targetUser.full_name,
        target_role: targetUser.role,
        is_active: newStatus,
      },
    });

    return res.status(200).json({
      message: `User account for ${targetUser.full_name} has been ${is_active ? 'activated' : 'deactivated'}.`,
      user_id: id,
      is_active: newStatus,
    });
  } catch (error) {
    console.error('[Admin Toggle Status Error]:', error);
    return res.status(500).json({ error: 'Internal server error updating account status.' });
  }
}

/**
 * GET /api/admin/analytics
 * SQL aggregations for charts, resolution rates, chronic recurrence clusters, and workload
 */
export function getAdminAnalytics(req, res) {
  try {
    // 1. Complaint Status Distribution
    const statusDistribution = db.prepare(`
      SELECT status, count(*) as count
      FROM complaints
      GROUP BY status
      ORDER BY count DESC
    `).all();

    // 2. Department Workload & Performance
    const departmentWorkload = db.prepare(`
      SELECT 
        d.id, d.name, d.code,
        COUNT(c.id) as total_complaints,
        SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN c.status NOT IN ('Resolved') THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN c.relation_type = 'recurring' THEN 1 ELSE 0 END) as recurring_count
      FROM departments d
      LEFT JOIN complaints c ON d.id = c.department_id
      GROUP BY d.id
      ORDER BY total_complaints DESC
    `).all();

    // 3. Ward Complaint Distribution
    const wardDistribution = db.prepare(`
      SELECT 
        w.id, w.name, w.ward_number,
        COUNT(c.id) as complaint_count
      FROM wards w
      LEFT JOIN complaints c ON w.id = c.ward_id
      GROUP BY w.id
      ORDER BY w.ward_number ASC
    `).all();

    // 4. Chronic Recurring Clusters (Civic Memory Differentiator)
    const chronicClusters = db.prepare(`
      SELECT 
        c.root_incident_id,
        root.ticket_number as root_ticket,
        root.title as root_title,
        root.address as root_address,
        root.category,
        root.status as root_status,
        d.name as department_name,
        COUNT(c.id) as recurrence_count,
        MIN(c.created_at) as earliest_incident,
        MAX(c.created_at) as latest_incident
      FROM complaints c
      LEFT JOIN complaints root ON c.root_incident_id = root.id
      LEFT JOIN departments d ON root.department_id = d.id
      WHERE c.relation_type = 'recurring' AND c.root_incident_id IS NOT NULL
      GROUP BY c.root_incident_id
      ORDER BY recurrence_count DESC
      LIMIT 10
    `).all();

    // 5. Daily Submission Activity (Last 30 days)
    const dailyActivity = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_submitted,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
      FROM complaints
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      LIMIT 30
    `).all();

    // 6. Most frequently reported recurring and supported problems
    const mostFrequentlyReported = db.prepare(`
      SELECT 
        c.id, c.ticket_number, c.title, c.category, c.status, c.support_count,
        c.address, c.created_at,
        (SELECT COUNT(*) FROM complaints WHERE duplicate_of_id = c.id) as duplicate_count,
        d.name as department_name,
        w.name as ward_name
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN wards w ON c.ward_id = w.id
      WHERE c.relation_type != 'duplicate'
      ORDER BY (c.support_count + (SELECT COUNT(*) FROM complaints WHERE duplicate_of_id = c.id)) DESC
      LIMIT 10
    `).all();

    // 7. Locations with repeated complaints
    const repeatedComplaintLocations = db.prepare(`
      SELECT 
        c.address, c.ward_id, w.name as ward_name,
        COUNT(c.id) as total_reports,
        SUM(CASE WHEN c.relation_type != 'duplicate' THEN 1 ELSE 0 END) as unique_issues,
        SUM(CASE WHEN c.relation_type = 'duplicate' THEN 1 ELSE 0 END) as duplicate_reports,
        SUM(CASE WHEN c.relation_type = 'recurring' THEN 1 ELSE 0 END) as recurring_reports
      FROM complaints c
      LEFT JOIN wards w ON c.ward_id = w.id
      GROUP BY c.ward_id, c.address
      HAVING total_reports > 1
      ORDER BY total_reports DESC
      LIMIT 10
    `).all();

    return res.status(200).json({
      statusDistribution,
      departmentWorkload,
      wardDistribution,
      chronicClusters,
      dailyActivity,
      mostFrequentlyReported,
      repeatedComplaintLocations,
    });
  } catch (error) {
    console.error('[Admin Analytics Error]:', error);
    return res.status(500).json({ error: 'Internal server error computing municipal analytics.' });
  }
}

/**
 * GET /api/admin/audit-logs
 * Paginated query of immutable system audit logs with actor and entity filters
 */
export function getAdminAuditLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { action, target_entity, user_id, startDate, endDate } = req.query;

    const whereClauses = ['1=1'];
    const params = [];

    if (action && action !== 'all') {
      whereClauses.push('a.action = ?');
      params.push(action);
    }

    if (target_entity && target_entity !== 'all') {
      whereClauses.push('a.target_entity = ?');
      params.push(target_entity);
    }

    if (user_id && user_id !== 'all') {
      whereClauses.push('a.user_id = ?');
      params.push(user_id);
    }

    if (startDate) {
      whereClauses.push('a.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('a.created_at <= ?');
      params.push(endDate);
    }

    const whereString = whereClauses.join(' AND ');

    const totalRow = db.prepare(`
      SELECT count(*) as count
      FROM audit_logs a
      WHERE ${whereString}
    `).get(...params);
    const total = totalRow.count;

    const logs = db.prepare(`
      SELECT 
        a.id, a.user_id, a.action, a.target_entity, a.target_id, a.ip_address, a.details, a.created_at,
        u.full_name as user_name, u.email as user_email, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE ${whereString}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return res.status(200).json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('[Admin Audit Logs Error]:', error);
    return res.status(500).json({ error: 'Internal server error querying system audit logs.' });
  }
}
