import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import {
  createTenderSchema,
  publishTenderSchema,
  updateTenderStatusSchema,
} from '../validators/adminValidators.js';
import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * Government Tender Management Controller
 * Handles municipal tender preparation, assisted government portal publication
 * (State e-Procurement and Central CPPP), official tender tracking,
 * and full work-order traceability.
 */

/**
 * Standard official government portal URLs
 */
export const OFFICIAL_PORTALS = {
  central: {
    name: 'Government of India — Central Public Procurement Portal (CPPP)',
    url: 'https://eprocure.gov.in/eprocure/app',
    contractor_reg_url: 'https://eprocure.gov.in/eprocure/app?page=StandardBiddersManual',
    description: 'Central Government e-procurement portal for municipal & infrastructure works.',
  },
  state: {
    karnataka: {
      name: 'Karnataka Public Procurement Portal (KPPP)',
      url: 'https://kppp.karnataka.gov.in',
      contractor_reg_url: 'https://kppp.karnataka.gov.in/#/portal/portal-home',
    },
    maharashtra: {
      name: 'Government of Maharashtra e-Procurement Portal (MahaTenders)',
      url: 'https://mahatenders.gov.in',
      contractor_reg_url: 'https://mahatenders.gov.in/nicgep/app',
    },
    west_bengal: {
      name: 'Government of West Bengal e-Tender Portal',
      url: 'https://wbtenders.gov.in',
      contractor_reg_url: 'https://wbtenders.gov.in/nicgep/app',
    },
    delhi: {
      name: 'Government of NCT of Delhi e-Procurement Portal',
      url: 'https://govtprocurement.delhi.gov.in',
      contractor_reg_url: 'https://govtprocurement.delhi.gov.in/nicgep/app',
    },
    tamil_nadu: {
      name: 'Government of Tamil Nadu e-Procurement Portal',
      url: 'https://tntenders.gov.in',
      contractor_reg_url: 'https://tntenders.gov.in/nicgep/app',
    },
    default: {
      name: 'State Government Public Procurement Portal',
      url: 'https://kppp.karnataka.gov.in',
      contractor_reg_url: 'https://kppp.karnataka.gov.in',
    },
  },
};

/**
 * GET /api/admin/tenders
 * List government tenders with pagination, filtering, and summary metrics
 */
export function getAdminTenders(req, res) {
  try {
    const { portal_type, status, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = ['1=1'];
    const params = [];

    if (portal_type && portal_type !== 'all') {
      whereClauses.push('t.portal_type = ?');
      params.push(portal_type);
    }

    if (status && status !== 'all') {
      whereClauses.push('t.status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(t.tender_number LIKE ? OR t.official_tender_ref LIKE ? OR t.title LIKE ? OR c.ticket_number LIKE ?)');
      params.push(term, term, term, term);
    }

    const whereString = whereClauses.join(' AND ');

    // Aggregate statistics
    const metrics = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'Ready for Publication' THEN 1 ELSE 0 END) as ready_for_publication,
        SUM(CASE WHEN status = 'Published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'Bidding Open' THEN 1 ELSE 0 END) as bidding_open,
        SUM(CASE WHEN status = 'Bidding Closed' THEN 1 ELSE 0 END) as bidding_closed,
        SUM(CASE WHEN status = 'Under Evaluation' THEN 1 ELSE 0 END) as under_evaluation,
        SUM(CASE WHEN status = 'Awarded' THEN 1 ELSE 0 END) as awarded,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN portal_type = 'state' THEN 1 ELSE 0 END) as state_count,
        SUM(CASE WHEN portal_type = 'central' THEN 1 ELSE 0 END) as central_count,
        COALESCE(SUM(CASE WHEN status = 'Awarded' THEN awarded_bid_amount ELSE 0 END), 0) as total_awarded_amount
      FROM government_tenders
    `).get();

    const totalFiltered = db.prepare(`
      SELECT COUNT(*) as count
      FROM government_tenders t
      LEFT JOIN complaints c ON t.complaint_id = c.id
      WHERE ${whereString}
    `).get(...params).count;

    const tenders = db.prepare(`
      SELECT 
        t.id, t.tender_number, t.complaint_id, t.work_order_id, t.assigned_official_id,
        t.created_by_admin_id, t.title, t.description, t.location, t.pin_code,
        t.estimated_cost, t.work_specifications, t.submission_deadline,
        t.terms_and_conditions, t.portal_type, t.portal_name, t.portal_url,
        t.official_tender_ref, t.external_tracking_id, t.status,
        t.published_at, t.bidding_closed_at, t.awarded_at,
        t.awarded_contractor_name, t.awarded_contractor_license,
        t.awarded_bid_amount, t.contractor_contact, t.notes,
        t.created_at, t.updated_at,
        c.ticket_number as complaint_ticket_number,
        c.title as complaint_title,
        c.category as complaint_category,
        c.status as complaint_status,
        off.full_name as assigned_official_name,
        off.email as assigned_official_email,
        adm.full_name as created_by_admin_name
      FROM government_tenders t
      LEFT JOIN complaints c ON t.complaint_id = c.id
      LEFT JOIN users off ON t.assigned_official_id = off.id
      LEFT JOIN users adm ON t.created_by_admin_id = adm.id
      WHERE ${whereString}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    return res.status(200).json({
      metrics,
      tenders,
      portals_catalog: OFFICIAL_PORTALS,
      pagination: {
        total: totalFiltered,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalFiltered / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('[Get Admin Tenders Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving government tenders.' });
  }
}

/**
 * GET /api/admin/tenders/eligible-complaints
 * Returns municipal complaints eligible for tender preparation
 */
export function getEligibleComplaintsForTender(req, res) {
  try {
    const complaints = db.prepare(`
      SELECT 
        c.id, c.ticket_number, c.title, c.description, c.category, c.severity, c.priority,
        c.status, c.address, c.landmark, c.ward_id, c.department_id, c.assigned_official_id,
        c.created_at,
        w.name as ward_name,
        d.name as department_name,
        off.full_name as assigned_official_name,
        (SELECT id FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as existing_tender_id,
        (SELECT tender_number FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as existing_tender_number,
        (SELECT status FROM government_tenders WHERE complaint_id = c.id AND status NOT IN ('Cancelled') LIMIT 1) as existing_tender_status
      FROM complaints c
      LEFT JOIN wards w ON c.ward_id = w.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN users off ON c.assigned_official_id = off.id
      WHERE c.status NOT IN ('Resolved')
      ORDER BY c.created_at DESC
    `).all();

    return res.status(200).json({ complaints });
  } catch (error) {
    console.error('[Get Eligible Complaints For Tender Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving eligible complaints.' });
  }
}

/**
 * GET /api/admin/tenders/:id
 * Single tender inspection with audit logs & complete project traceability
 */
export function getAdminTenderById(req, res) {
  try {
    const { id } = req.params;

    const tender = db.prepare(`
      SELECT 
        t.*,
        c.ticket_number as complaint_ticket_number,
        c.title as complaint_title,
        c.description as complaint_description,
        c.category as complaint_category,
        c.severity as complaint_severity,
        c.status as complaint_status,
        c.address as complaint_address,
        c.deadline_at as complaint_deadline_at,
        c.created_at as complaint_created_at,
        u.full_name as citizen_name,
        u.email as citizen_email,
        off.full_name as assigned_official_name,
        off.email as assigned_official_email,
        d.name as department_name,
        adm.full_name as created_by_admin_name
      FROM government_tenders t
      LEFT JOIN complaints c ON t.complaint_id = c.id
      LEFT JOIN users u ON c.citizen_id = u.id
      LEFT JOIN users off ON t.assigned_official_id = off.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN users adm ON t.created_by_admin_id = adm.id
      WHERE t.id = ?
    `).get(id);

    if (!tender) {
      return res.status(404).json({ error: 'Government tender not found.' });
    }

    // Associated work assignment
    const assignment = db.prepare(`
      SELECT id, assigned_official_id, assigned_by_user_id, notes, created_at
      FROM complaint_assignments
      WHERE complaint_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(tender.complaint_id);

    // Associated images / evidence files
    const images = db.prepare(`
      SELECT id, image_url, media_type, caption, created_at
      FROM complaint_images
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `).all(tender.complaint_id);

    // Tender audit logs
    const auditLogs = db.prepare(`
      SELECT 
        tal.id, tal.action, tal.from_status, tal.to_status, tal.details, tal.created_at,
        adm.full_name as admin_name
      FROM tender_audit_logs tal
      LEFT JOIN users adm ON tal.admin_id = adm.id
      WHERE tal.tender_id = ?
      ORDER BY tal.created_at ASC
    `).all(id);

    // Project Traceability Graph
    const traceability = {
      citizen_grievance: {
        complaint_id: tender.complaint_id,
        ticket_number: tender.complaint_ticket_number,
        title: tender.complaint_title,
        complainant_name: tender.citizen_name,
        submission_date: tender.complaint_created_at,
        current_status: tender.complaint_status,
      },
      work_order: {
        assignment_id: assignment ? assignment.id : `WO-${tender.complaint_ticket_number}`,
        assigned_date: assignment ? assignment.created_at : tender.complaint_created_at,
        notes: assignment ? assignment.notes : 'Direct municipal work allocation',
        deadline_at: tender.complaint_deadline_at,
      },
      assigned_engineer: {
        official_id: tender.assigned_official_id,
        full_name: tender.assigned_official_name || 'Unassigned Engineer',
        email: tender.assigned_official_email,
        department_name: tender.department_name,
      },
      internal_tender: {
        id: tender.id,
        tender_number: tender.tender_number,
        title: tender.title,
        status: tender.status,
        estimated_cost: tender.estimated_cost,
        submission_deadline: tender.submission_deadline,
        created_at: tender.created_at,
      },
      official_government_portal: {
        portal_type: tender.portal_type,
        portal_name: tender.portal_name,
        portal_url: tender.portal_url,
        official_tender_ref: tender.official_tender_ref,
        external_tracking_id: tender.external_tracking_id,
        published_at: tender.published_at,
        is_published: !!tender.official_tender_ref,
      },
      contractor_bid: tender.awarded_contractor_name ? {
        contractor_name: tender.awarded_contractor_name,
        license_number: tender.awarded_contractor_license,
        bid_amount: tender.awarded_bid_amount,
        awarded_at: tender.awarded_at,
        contact_info: tender.contractor_contact,
      } : null,
    };

    return res.status(200).json({
      tender,
      images,
      auditLogs,
      traceability,
    });
  } catch (error) {
    console.error('[Get Admin Tender Details Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving tender details.' });
  }
}

/**
 * POST /api/admin/tenders
 * Prepares a municipal work task for tender publication
 */
export function createGovernmentTender(req, res) {
  try {
    const user = req.user;

    const parseResult = createTenderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const {
      complaint_id,
      title,
      description,
      location,
      pin_code,
      estimated_cost,
      work_specifications,
      submission_deadline,
      terms_and_conditions,
      portal_type,
      portal_name,
      portal_url,
    } = parseResult.data;

    // Verify complaint exists
    const complaint = db.prepare(`
      SELECT id, ticket_number, assigned_official_id, department_id, address
      FROM complaints
      WHERE id = ?
    `).get(complaint_id);

    if (!complaint) {
      return res.status(404).json({ error: 'Target complaint / work task not found.' });
    }

    // Check if active tender already exists for this complaint
    const existingActiveTender = db.prepare(`
      SELECT id, tender_number, status
      FROM government_tenders
      WHERE complaint_id = ? AND status NOT IN ('Cancelled')
    `).get(complaint_id);

    if (existingActiveTender) {
      return res.status(409).json({
        error: `An active tender (${existingActiveTender.tender_number}, Status: ${existingActiveTender.status}) already exists for this work order. Cancel or conclude it before creating a new tender.`,
      });
    }

    const tenderId = `tnd-${uuidv4()}`;
    const randomSeq = Math.floor(10000 + Math.random() * 90000);
    const tenderNumber = `TND-2026-${randomSeq}`;
    const workOrderId = `WO-${complaint.ticket_number}`;

    db.prepare(`
      INSERT INTO government_tenders (
        id, tender_number, complaint_id, work_order_id, assigned_official_id,
        created_by_admin_id, title, description, location, pin_code,
        estimated_cost, work_specifications, submission_deadline,
        terms_and_conditions, portal_type, portal_name, portal_url,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      tenderId,
      tenderNumber,
      complaint_id,
      workOrderId,
      complaint.assigned_official_id || null,
      user.id,
      title,
      description,
      location,
      pin_code || null,
      estimated_cost || null,
      work_specifications,
      submission_deadline,
      terms_and_conditions || null,
      portal_type,
      portal_name,
      portal_url
    );

    // Initial audit log
    const auditId = `tal-${uuidv4()}`;
    db.prepare(`
      INSERT INTO tender_audit_logs (
        id, tender_id, admin_id, action, from_status, to_status, details
      ) VALUES (?, ?, ?, 'CREATED', NULL, 'Draft', 'Tender draft prepared by administrator.')
    `).run(auditId, tenderId, user.id);

    logAuditEvent({
      userId: user.id,
      action: 'GOVERNMENT_TENDER_CREATED',
      targetEntity: 'tender',
      targetId: tenderId,
      ipAddress: req.ip,
      details: {
        tender_number: tenderNumber,
        complaint_ticket_number: complaint.ticket_number,
        portal_type,
        portal_name,
        estimated_cost,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Government tender successfully prepared in Draft status.',
      tender: {
        id: tenderId,
        tender_number: tenderNumber,
        complaint_id,
        work_order_id: workOrderId,
        title,
        status: 'Draft',
        portal_type,
        portal_name,
        submission_deadline,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Create Government Tender Error]:', error);
    return res.status(500).json({ error: 'Internal server error preparing government tender.' });
  }
}

/**
 * PATCH /api/admin/tenders/:id/ready
 * Sets tender status to 'Ready for Publication' and prepares assisted publication package
 */
export function markTenderReadyForPublication(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const tender = db.prepare('SELECT * FROM government_tenders WHERE id = ?').get(id);
    if (!tender) {
      return res.status(404).json({ error: 'Tender not found.' });
    }

    if (tender.status !== 'Draft') {
      return res.status(400).json({ error: `Tender cannot be marked Ready from current status: ${tender.status}.` });
    }

    db.prepare(`
      UPDATE government_tenders
      SET status = 'Ready for Publication', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    const auditId = `tal-${uuidv4()}`;
    db.prepare(`
      INSERT INTO tender_audit_logs (
        id, tender_id, admin_id, action, from_status, to_status, details
      ) VALUES (?, ?, ?, 'STATUS_CHANGED', 'Draft', 'Ready for Publication', 'Tender specifications locked and ready for official portal submission.')
    `).run(auditId, id, user.id);

    return res.status(200).json({
      success: true,
      message: "Tender status updated to 'Ready for Publication'. You can now publish on the official portal.",
      tender_id: id,
      tender_number: tender.tender_number,
      status: 'Ready for Publication',
    });
  } catch (error) {
    console.error('[Mark Tender Ready Error]:', error);
    return res.status(500).json({ error: 'Internal server error preparing tender for publication.' });
  }
}

/**
 * PATCH /api/admin/tenders/:id/publish
 * Confirms publication of tender on official government portal.
 *
 * Strict Invariant:
 * Never simulate successful publication or mark a tender as published unless
 * actual publication has been confirmed with the official tender reference number.
 */
export function publishGovernmentTender(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = publishTenderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { official_tender_ref, external_tracking_id, notes } = parseResult.data;

    const tender = db.prepare(`
      SELECT t.*, c.ticket_number
      FROM government_tenders t
      LEFT JOIN complaints c ON t.complaint_id = c.id
      WHERE t.id = ?
    `).get(id);

    if (!tender) {
      return res.status(404).json({ error: 'Government tender not found.' });
    }

    if (tender.status === 'Published' || tender.status === 'Bidding Open') {
      return res.status(400).json({ error: 'Tender is already published.' });
    }

    const fromStatus = tender.status;

    // Confirm publication with official reference number
    db.prepare(`
      UPDATE government_tenders
      SET official_tender_ref = ?,
          external_tracking_id = ?,
          status = 'Published',
          published_at = CURRENT_TIMESTAMP,
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(official_tender_ref, external_tracking_id || null, notes || null, id);

    // Record audit log
    const auditId = `tal-${uuidv4()}`;
    db.prepare(`
      INSERT INTO tender_audit_logs (
        id, tender_id, admin_id, action, from_status, to_status, details
      ) VALUES (?, ?, ?, 'PUBLISHED', ?, 'Published', ?)
    `).run(
      auditId,
      id,
      user.id,
      fromStatus,
      `Tender confirmed published on ${tender.portal_name} with official ref: ${official_tender_ref}`
    );

    // Record progress note on complaint
    const progId = `prog-${uuidv4()}`;
    db.prepare(`
      INSERT INTO complaint_progress_updates (
        id, complaint_id, official_id, message, update_type
      ) VALUES (?, ?, ?, ?, 'note')
    `).run(
      progId,
      tender.complaint_id,
      user.id,
      `Published on official procurement portal (${tender.portal_name}) under Tender Ref #${official_tender_ref}. Open for eligible contractor bids.`
    );

    logAuditEvent({
      userId: user.id,
      action: 'GOVERNMENT_TENDER_PUBLISHED',
      targetEntity: 'tender',
      targetId: id,
      ipAddress: req.ip,
      details: {
        tender_number: tender.tender_number,
        official_tender_ref,
        portal_name: tender.portal_name,
        complaint_ticket_number: tender.ticket_number,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Tender confirmed published on ${tender.portal_name}. Official Reference: ${official_tender_ref}.`,
      tender: {
        id,
        tender_number: tender.tender_number,
        official_tender_ref,
        external_tracking_id,
        status: 'Published',
        published_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Publish Government Tender Error]:', error);
    return res.status(500).json({ error: 'Internal server error confirming tender publication.' });
  }
}

/**
 * PATCH /api/admin/tenders/:id/status
 * Updates tender status (Bidding Open, Bidding Closed, Under Evaluation, Awarded, Cancelled)
 */
export function updateGovernmentTenderStatus(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const parseResult = updateTenderStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const {
      status,
      awarded_contractor_name,
      awarded_contractor_license,
      awarded_bid_amount,
      contractor_contact,
      notes,
    } = parseResult.data;

    const tender = db.prepare('SELECT * FROM government_tenders WHERE id = ?').get(id);
    if (!tender) {
      return res.status(404).json({ error: 'Government tender not found.' });
    }

    const fromStatus = tender.status;

    // Special status handlers
    let biddingClosedAt = tender.bidding_closed_at;
    let awardedAt = tender.awarded_at;

    if (status === 'Bidding Closed' && !biddingClosedAt) {
      biddingClosedAt = new Date().toISOString();
    }

    if (status === 'Awarded') {
      awardedAt = new Date().toISOString();
      if (!awarded_contractor_name) {
        return res.status(400).json({ error: 'Awarded contractor name is required when status is Awarded.' });
      }
    }

    db.prepare(`
      UPDATE government_tenders
      SET status = ?,
          bidding_closed_at = ?,
          awarded_at = ?,
          awarded_contractor_name = COALESCE(?, awarded_contractor_name),
          awarded_contractor_license = COALESCE(?, awarded_contractor_license),
          awarded_bid_amount = COALESCE(?, awarded_bid_amount),
          contractor_contact = COALESCE(?, contractor_contact),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      status,
      biddingClosedAt,
      awardedAt,
      awarded_contractor_name || null,
      awarded_contractor_license || null,
      awarded_bid_amount || null,
      contractor_contact || null,
      notes || null,
      id
    );

    // Audit log
    const auditId = `tal-${uuidv4()}`;
    const auditDetails = status === 'Awarded'
      ? `Tender awarded to ${awarded_contractor_name} for ₹${awarded_bid_amount || 0}.`
      : `Status changed from ${fromStatus} to ${status}.`;

    db.prepare(`
      INSERT INTO tender_audit_logs (
        id, tender_id, admin_id, action, from_status, to_status, details
      ) VALUES (?, ?, ?, 'STATUS_CHANGED', ?, ?, ?)
    `).run(auditId, id, user.id, fromStatus, status, auditDetails);

    logAuditEvent({
      userId: user.id,
      action: 'GOVERNMENT_TENDER_STATUS_UPDATED',
      targetEntity: 'tender',
      targetId: id,
      ipAddress: req.ip,
      details: {
        tender_number: tender.tender_number,
        from_status: fromStatus,
        to_status: status,
        awarded_contractor_name,
        awarded_bid_amount,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Tender status updated to '${status}'.`,
      id,
      tender_number: tender.tender_number,
      from_status: fromStatus,
      to_status: status,
    });
  } catch (error) {
    console.error('[Update Tender Status Error]:', error);
    return res.status(500).json({ error: 'Internal server error updating tender status.' });
  }
}

/**
 * GET /api/complaints/:id/tender
 * Public/Citizen/Contractor endpoint to query live government tender information
 * Powers the "View Tender / Apply for Bid" hyperlink.
 */
export function getComplaintTenderInfo(req, res) {
  try {
    const { id } = req.params;

    const tender = db.prepare(`
      SELECT 
        id, tender_number, official_tender_ref, title, portal_type,
        portal_name, portal_url, status, estimated_cost, submission_deadline,
        published_at, awarded_contractor_name, awarded_bid_amount
      FROM government_tenders
      WHERE complaint_id = ? AND status NOT IN ('Cancelled')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(id);

    if (!tender) {
      return res.status(200).json({
        has_tender: false,
        tender: null,
      });
    }

    // Only display active bidding link for tenders that are genuinely published and currently open for bidding!
    const isBiddingActive = (tender.status === 'Published' || tender.status === 'Bidding Open');

    return res.status(200).json({
      has_tender: true,
      tender: {
        id: tender.id,
        tender_number: tender.tender_number,
        official_tender_ref: tender.official_tender_ref,
        title: tender.title,
        portal_type: tender.portal_type,
        portal_name: tender.portal_name,
        portal_url: tender.portal_url,
        status: tender.status,
        estimated_cost: tender.estimated_cost,
        submission_deadline: tender.submission_deadline,
        published_at: tender.published_at,
        is_bidding_active: isBiddingActive,
        awarded_contractor_name: tender.awarded_contractor_name,
        awarded_bid_amount: tender.awarded_bid_amount,
      },
    });
  } catch (error) {
    console.error('[Get Complaint Tender Info Error]:', error);
    return res.status(500).json({ error: 'Internal server error retrieving complaint tender info.' });
  }
}
