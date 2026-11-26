-- ====================================================================
-- CivicMemory Relational Database Schema
-- Supports Full Audit Trail, Citizen Verification, and Recurrence History
-- ====================================================================

-- 1. WARDS (Administrative Divisions)
CREATE TABLE IF NOT EXISTS wards (
    id TEXT PRIMARY KEY,
    ward_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    zone TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    responsibilities TEXT,
    routing_rules TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. USERS
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT CHECK(role IN ('citizen', 'official', 'admin')) NOT NULL DEFAULT 'citizen',
    department_id TEXT,
    is_active INTEGER DEFAULT 1,
    state TEXT,
    district TEXT,
    ulb TEXT,
    locality TEXT,
    street TEXT,
    pin_code TEXT,
    house_number TEXT,
    landmark TEXT,
    locality_verification_level TEXT DEFAULT 'manual_unverified',
    ulb_verification_status TEXT DEFAULT 'UNVERIFIED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- 3A. CITIZEN PENDING REGISTRATIONS (Dual OTP Verification Before Activation)
CREATE TABLE IF NOT EXISTS citizen_pending_registrations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    phone TEXT NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    ulb TEXT NOT NULL,
    locality TEXT NOT NULL,
    street TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    house_number TEXT,
    landmark TEXT,
    locality_verification_level TEXT DEFAULT 'manual_unverified',
    ulb_verification_status TEXT DEFAULT 'UNVERIFIED',
    email_otp_hash TEXT NOT NULL,
    email_otp_expires_at INTEGER NOT NULL,
    email_otp_attempts INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    mobile_otp_hash TEXT NOT NULL,
    mobile_otp_expires_at INTEGER NOT NULL,
    mobile_otp_attempts INTEGER DEFAULT 0,
    mobile_verified INTEGER DEFAULT 0,
    resend_available_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON citizen_pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_reg_phone ON citizen_pending_registrations(phone);

-- 3B. PASSWORD RESET REQUESTS (Secure OTP Verification & Reset Tokens)
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_type TEXT CHECK(contact_type IN ('email', 'phone')) NOT NULL,
    contact_value TEXT NOT NULL COLLATE NOCASE,
    otp_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    resend_available_at INTEGER NOT NULL,
    verified_at DATETIME,
    reset_token_hash TEXT,
    reset_token_expires_at INTEGER,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_contact ON password_reset_requests(contact_value);

-- 3C. CITIZEN DUMMY REGISTRATIONS (Anti-Enumeration Shadow Sessions)
CREATE TABLE IF NOT EXISTS citizen_dummy_registrations (
    id TEXT PRIMARY KEY,
    email_otp_hash TEXT NOT NULL,
    mobile_otp_hash TEXT NOT NULL,
    email_otp_attempts INTEGER DEFAULT 0,
    mobile_otp_attempts INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    mobile_verified INTEGER DEFAULT 0,
    resend_available_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dummy_reg_expires ON citizen_dummy_registrations(expires_at);

-- 3D. PROVIDER DISPATCH QUOTAS (SMS & Email Destination / IP Abuse Protection)
CREATE TABLE IF NOT EXISTS provider_dispatch_quotas (
    quota_key TEXT PRIMARY KEY,
    dispatch_count INTEGER NOT NULL DEFAULT 1,
    window_start INTEGER NOT NULL,
    window_expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotas_expires ON provider_dispatch_quotas(window_expires_at);

-- 3E. PROVIDER CIRCUIT BREAKERS (SMS & Email Upstream Protection)
CREATE TABLE IF NOT EXISTS provider_circuit_breakers (
    provider_name TEXT PRIMARY KEY,
    state TEXT CHECK(state IN ('CLOSED', 'OPEN', 'HALF_OPEN')) NOT NULL DEFAULT 'CLOSED',
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at INTEGER DEFAULT 0,
    cooldown_until INTEGER DEFAULT 0
);

-- 4. REVOKED TOKENS (For secure JWT session invalidation on logout)
CREATE TABLE IF NOT EXISTS revoked_tokens (
    token_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(expires_at);

-- 5. COMPLAINTS (The Core Ticket)
CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    citizen_id TEXT NOT NULL,
    department_id TEXT,
    assigned_official_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    status TEXT CHECK(status IN (
        'Submitted', 'Under Review', 'Verified', 'Assigned',
        'In Progress', 'Work Completed', 'Awaiting Citizen Verification',
        'Resolved', 'Reopened'
    )) DEFAULT 'Submitted',
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT,
    landmark TEXT,
    ward_zone TEXT,
    ward_id TEXT,
    duplicate_of_id TEXT, -- Points to the primary active ticket if this is a duplicate report
    relation_type TEXT CHECK(relation_type IN ('standalone', 'duplicate', 'recurring')) DEFAULT 'standalone',
    root_incident_id TEXT, -- Points to the earliest root incident in an infrastructure failure chain
    is_recurring INTEGER DEFAULT 0,
    recurrence_count INTEGER DEFAULT 0,
    support_count INTEGER DEFAULT 1,
    recommended_department_id TEXT,
    secondary_department_id TEXT,
    routing_reason TEXT,
    routing_confidence INTEGER,
    requires_manual_review INTEGER DEFAULT 0,
    routing_status TEXT CHECK(routing_status IN ('pending', 'auto_routed', 'manual_review_required', 'manually_assigned', 'accepted')) DEFAULT 'pending',
    priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    accepted_by_user_id TEXT,
    accepted_at DATETIME,
    language_preference TEXT DEFAULT 'auto',
    detected_language TEXT,
    original_text TEXT,
    english_translation TEXT,
    translated_title TEXT,
    translation_confidence INTEGER DEFAULT 100,
    translation_revised_by_user_id TEXT,
    translation_revised_at DATETIME,
    translation_notes TEXT,
    deadline_at DATETIME,
    deadline_set_by_admin_id TEXT,
    deadline_set_at DATETIME,
    deadline_consultation_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citizen_id) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (recommended_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (secondary_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (translation_revised_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_official_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL,
    FOREIGN KEY (duplicate_of_id) REFERENCES complaints(id) ON DELETE SET NULL,
    FOREIGN KEY (root_incident_id) REFERENCES complaints(id) ON DELETE SET NULL
);

-- 6. COMPLAINT IMAGES
CREATE TABLE IF NOT EXISTS complaint_images (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    uploader_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_type TEXT CHECK(image_type IN ('before_report', 'progress', 'after_repair')) NOT NULL,
    caption TEXT,
    file_name TEXT,
    file_path TEXT,
    mime_type TEXT,
    file_size INTEGER,
    media_type TEXT CHECK(media_type IN ('IMAGE', 'VIDEO')) DEFAULT 'IMAGE',
    sha256_hash TEXT,
    latitude REAL,
    longitude REAL,
    accuracy_meters REAL,
    device_captured_at DATETIME,
    recording_started_at DATETIME,
    recording_ended_at DATETIME,
    server_received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    capture_type TEXT DEFAULT 'LIVE_CAMERA',
    evidence_purpose TEXT DEFAULT 'citizen_report',
    duration_seconds REAL,
    uploader_role TEXT,
    department_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);

-- 7. COMPLAINT STATUS AUDIT TRAIL
CREATE TABLE IF NOT EXISTS complaint_status_history (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    changed_by_user_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- 8. CITIZEN RESOLUTION VERIFICATIONS
CREATE TABLE IF NOT EXISTS citizen_verifications (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    citizen_id TEXT NOT NULL,
    is_satisfactory INTEGER NOT NULL, -- 1 = Confirmed Fixed, 0 = Rejected/Still Broken
    feedback TEXT,
    verification_photo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (citizen_id) REFERENCES users(id)
);

-- 9. CITIZEN COMPLAINT SUPPORTERS (Upvotes / Me-too)
CREATE TABLE IF NOT EXISTS complaint_supporters (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    citizen_id TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(complaint_id, citizen_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (citizen_id) REFERENCES users(id)
);

-- 10. AI ANALYSIS AUDIT RECORDS
CREATE TABLE IF NOT EXISTS ai_analyses (
    id TEXT PRIMARY KEY,
    complaint_id TEXT,
    analysis_type TEXT CHECK(analysis_type IN ('issue_classification', 'duplicate_detection', 'evidence_comparison', 'recurrence_risk')),
    raw_prompt_summary TEXT,
    response_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

-- 11. COMPLAINT ASSIGNMENT RECORDS (Official & Admin Assignment Trail)
CREATE TABLE IF NOT EXISTS complaint_assignments (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    assigned_official_id TEXT NOT NULL,
    assigned_by_user_id TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_official_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_comp ON complaint_assignments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_off ON complaint_assignments(assigned_official_id);

-- 12. COMPLAINT PROGRESS UPDATES (Official Maintenance Notes & Logs)
CREATE TABLE IF NOT EXISTS complaint_progress_updates (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    official_id TEXT NOT NULL,
    message TEXT NOT NULL,
    update_type TEXT CHECK(update_type IN ('note', 'inspection', 'crew_dispatched', 'work_update', 'material_requisition', 'repair_completed')) DEFAULT 'work_update',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (official_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_progress_updates_comp ON complaint_progress_updates(complaint_id);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id TEXT,
    ip_address TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. CIVIC INTELLIGENCE REPORTS
CREATE TABLE IF NOT EXISTS civic_intelligence_reports (
    id TEXT PRIMARY KEY,
    generated_by_user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    time_period TEXT NOT NULL, -- '7d', '30d', '90d', '180d', '365d', 'all'
    ward_id TEXT,
    category TEXT,
    summary TEXT NOT NULL,
    content_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_intel_reports_created ON civic_intelligence_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_intel_reports_period ON civic_intelligence_reports(time_period);

-- 15. DEPARTMENT ROUTING AUDIT TRAIL
CREATE TABLE IF NOT EXISTS department_routing_audit (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    recommended_department_id TEXT,
    recommended_department_name TEXT,
    secondary_department_id TEXT,
    secondary_department_name TEXT,
    assigned_department_id TEXT,
    assigned_department_name TEXT,
    assigned_by_user_id TEXT,
    assigned_by_type TEXT CHECK(assigned_by_type IN ('system_ai', 'official', 'admin')) DEFAULT 'system_ai',
    confidence_score INTEGER,
    routing_reason TEXT,
    reassignment_reason TEXT,
    requires_manual_review INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (recommended_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (secondary_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_dept_routing_audit_comp ON department_routing_audit(complaint_id);
CREATE INDEX IF NOT EXISTS idx_dept_routing_audit_created ON department_routing_audit(created_at);

-- 16. CITIZEN NOTIFICATIONS (Multilingual Complaint Updates)
CREATE TABLE IF NOT EXISTS citizen_notifications (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    citizen_id TEXT NOT NULL,
    event_type TEXT CHECK(event_type IN (
        'registration_confirmed',
        'department_assigned',
        'status_changed',
        'work_completed',
        'resolved',
        'reopened'
    )) NOT NULL,
    target_language TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    english_message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_citizen ON citizen_notifications(citizen_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_complaint ON citizen_notifications(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaints_detected_lang ON complaints(detected_language);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_complaints_geo ON complaints(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_root ON complaints(root_incident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_duplicate ON complaints(duplicate_of_id);
CREATE INDEX IF NOT EXISTS idx_complaints_relation ON complaints(relation_type);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON complaints(citizen_id);
CREATE INDEX IF NOT EXISTS idx_complaints_ward ON complaints(ward_id);
CREATE INDEX IF NOT EXISTS idx_complaints_dept ON complaints(department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_routing_status ON complaints(routing_status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_status_history_comp_date ON complaint_status_history(complaint_id, created_at);

-- 17. COMPLAINT DEADLINES AUDIT HISTORY (Admin-Only Authority)
CREATE TABLE IF NOT EXISTS complaint_deadlines_history (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL,
    assigned_official_id TEXT,
    set_by_admin_id TEXT NOT NULL,
    previous_deadline_at DATETIME,
    new_deadline_at DATETIME,
    consultation_notes TEXT,
    action TEXT CHECK(action IN ('SET', 'MODIFIED', 'EXTENDED', 'REMOVED')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (set_by_admin_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_deadlines_hist_comp ON complaint_deadlines_history(complaint_id);

-- 18. OFFICIAL NOTIFICATIONS (Deadlines, Reassignments)
CREATE TABLE IF NOT EXISTS official_notifications (
    id TEXT PRIMARY KEY,
    official_id TEXT NOT NULL,
    complaint_id TEXT,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (official_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_off_notif_off ON official_notifications(official_id, is_read);

-- 19. GRIEVANCES (Citizen & Engineer Redressal System)
CREATE TABLE IF NOT EXISTS grievances (
    id TEXT PRIMARY KEY,
    tracking_number TEXT UNIQUE NOT NULL,
    complainant_user_id TEXT NOT NULL,
    complainant_name TEXT NOT NULL,
    complainant_email TEXT NOT NULL,
    complainant_role TEXT NOT NULL,
    complainant_phone TEXT,
    department_id TEXT,
    related_complaint_id TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT CHECK(status IN ('Pending', 'Under Review', 'Resolved', 'Rejected')) NOT NULL DEFAULT 'Pending',
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complainant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_complaint_id) REFERENCES complaints(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_grievances_status ON grievances(status);
CREATE INDEX IF NOT EXISTS idx_grievances_user ON grievances(complainant_user_id);
CREATE INDEX IF NOT EXISTS idx_grievances_created ON grievances(created_at);

-- 20. GRIEVANCE RESPONSES & STATUS AUDIT RECORDS
CREATE TABLE IF NOT EXISTS grievance_responses (
    id TEXT PRIMARY KEY,
    grievance_id TEXT NOT NULL,
    responder_user_id TEXT NOT NULL,
    responder_name TEXT NOT NULL,
    responder_role TEXT NOT NULL DEFAULT 'admin',
    response_text TEXT NOT NULL,
    status_change TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grievance_id) REFERENCES grievances(id) ON DELETE CASCADE,
    FOREIGN KEY (responder_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_grv_responses_grv ON grievance_responses(grievance_id);

-- 21. GOVERNMENT TENDERS (State & Central Public Procurement Portals)
CREATE TABLE IF NOT EXISTS government_tenders (
    id TEXT PRIMARY KEY,
    tender_number TEXT UNIQUE NOT NULL,
    complaint_id TEXT NOT NULL,
    work_order_id TEXT,
    assigned_official_id TEXT,
    created_by_admin_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    pin_code TEXT,
    estimated_cost REAL,
    work_specifications TEXT NOT NULL,
    submission_deadline DATETIME NOT NULL,
    terms_and_conditions TEXT,
    portal_type TEXT CHECK(portal_type IN ('state', 'central')) NOT NULL,
    portal_name TEXT NOT NULL,
    portal_url TEXT NOT NULL,
    official_tender_ref TEXT,
    external_tracking_id TEXT,
    status TEXT CHECK(status IN (
        'Draft',
        'Ready for Publication',
        'Published',
        'Bidding Open',
        'Bidding Closed',
        'Under Evaluation',
        'Awarded',
        'Cancelled'
    )) NOT NULL DEFAULT 'Draft',
    published_at DATETIME,
    bidding_closed_at DATETIME,
    awarded_at DATETIME,
    awarded_contractor_name TEXT,
    awarded_contractor_license TEXT,
    awarded_bid_amount REAL,
    contractor_contact TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_official_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tenders_comp ON government_tenders(complaint_id);
CREATE INDEX IF NOT EXISTS idx_tenders_status ON government_tenders(status);
CREATE INDEX IF NOT EXISTS idx_tenders_portal ON government_tenders(portal_type);

-- 22. GOVERNMENT TENDER AUDIT LOGS
CREATE TABLE IF NOT EXISTS tender_audit_logs (
    id TEXT PRIMARY KEY,
    tender_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tender_id) REFERENCES government_tenders(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tender_audit_tnd ON tender_audit_logs(tender_id);
