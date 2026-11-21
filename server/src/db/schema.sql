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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citizen_id) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
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

-- 11. AUDIT LOGS
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_complaints_geo ON complaints(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_root ON complaints(root_incident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_duplicate ON complaints(duplicate_of_id);
CREATE INDEX IF NOT EXISTS idx_complaints_relation ON complaints(relation_type);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON complaints(citizen_id);
CREATE INDEX IF NOT EXISTS idx_complaints_ward ON complaints(ward_id);
