import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data, upload, and protected storage directories exist
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

if (!fs.existsSync(config.storageDir)) {
  fs.mkdirSync(config.storageDir, { recursive: true });
}

if (!fs.existsSync(config.protectedUploadDir)) {
  fs.mkdirSync(config.protectedUploadDir, { recursive: true });
}

// Initialize Native Node.js SQLite Database connection
const db = new DatabaseSync(config.dbPath);

// Enable foreign keys and WAL mode
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize schema and apply non-destructive column migrations
export function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    // 1. If complaints table already exists, ensure new columns are present before executing index statements
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='complaints'").get();
    if (tableExists) {
      const columns = db.prepare('PRAGMA table_info(complaints)').all().map((c) => c.name);
      if (!columns.includes('ward_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN ward_id TEXT;');
      }
      if (!columns.includes('duplicate_of_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN duplicate_of_id TEXT;');
      }
      if (!columns.includes('relation_type')) {
        db.exec("ALTER TABLE complaints ADD COLUMN relation_type TEXT DEFAULT 'standalone';");
      }
      if (!columns.includes('assigned_official_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN assigned_official_id TEXT;');
      }
      if (!columns.includes('recommended_department_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN recommended_department_id TEXT;');
      }
      if (!columns.includes('secondary_department_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN secondary_department_id TEXT;');
      }
      if (!columns.includes('routing_reason')) {
        db.exec('ALTER TABLE complaints ADD COLUMN routing_reason TEXT;');
      }
      if (!columns.includes('routing_confidence')) {
        db.exec('ALTER TABLE complaints ADD COLUMN routing_confidence INTEGER;');
      }
      if (!columns.includes('requires_manual_review')) {
        db.exec('ALTER TABLE complaints ADD COLUMN requires_manual_review INTEGER DEFAULT 0;');
      }
      if (!columns.includes('routing_status')) {
        db.exec("ALTER TABLE complaints ADD COLUMN routing_status TEXT DEFAULT 'pending';");
      }
      if (!columns.includes('priority')) {
        db.exec("ALTER TABLE complaints ADD COLUMN priority TEXT DEFAULT 'Medium';");
      }
      if (!columns.includes('accepted_by_user_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN accepted_by_user_id TEXT;');
      }
      if (!columns.includes('accepted_at')) {
        db.exec('ALTER TABLE complaints ADD COLUMN accepted_at DATETIME;');
      }
      if (!columns.includes('language_preference')) {
        db.exec("ALTER TABLE complaints ADD COLUMN language_preference TEXT DEFAULT 'auto';");
      }
      if (!columns.includes('detected_language')) {
        db.exec('ALTER TABLE complaints ADD COLUMN detected_language TEXT;');
      }
      if (!columns.includes('original_text')) {
        db.exec('ALTER TABLE complaints ADD COLUMN original_text TEXT;');
      }
      if (!columns.includes('english_translation')) {
        db.exec('ALTER TABLE complaints ADD COLUMN english_translation TEXT;');
      }
      if (!columns.includes('translated_title')) {
        db.exec('ALTER TABLE complaints ADD COLUMN translated_title TEXT;');
      }
      if (!columns.includes('translation_confidence')) {
        db.exec('ALTER TABLE complaints ADD COLUMN translation_confidence INTEGER DEFAULT 100;');
      }
      if (!columns.includes('translation_revised_by_user_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN translation_revised_by_user_id TEXT;');
      }
      if (!columns.includes('translation_revised_at')) {
        db.exec('ALTER TABLE complaints ADD COLUMN translation_revised_at DATETIME;');
      }
      if (!columns.includes('translation_notes')) {
        db.exec('ALTER TABLE complaints ADD COLUMN translation_notes TEXT;');
      }
      if (!columns.includes('deadline_at')) {
        db.exec('ALTER TABLE complaints ADD COLUMN deadline_at DATETIME;');
      }
      if (!columns.includes('deadline_set_by_admin_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN deadline_set_by_admin_id TEXT;');
      }
      if (!columns.includes('deadline_set_at')) {
        db.exec('ALTER TABLE complaints ADD COLUMN deadline_set_at DATETIME;');
      }
      if (!columns.includes('deadline_consultation_notes')) {
        db.exec('ALTER TABLE complaints ADD COLUMN deadline_consultation_notes TEXT;');
      }
    }

    // Ensure departments table has responsibilities, routing_rules, and is_active columns
    const deptsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='departments'").get();
    if (deptsTableExists) {
      const deptColumns = db.prepare('PRAGMA table_info(departments)').all().map((c) => c.name);
      if (!deptColumns.includes('responsibilities')) {
        db.exec('ALTER TABLE departments ADD COLUMN responsibilities TEXT;');
      }
      if (!deptColumns.includes('routing_rules')) {
        db.exec('ALTER TABLE departments ADD COLUMN routing_rules TEXT;');
      }
      if (!deptColumns.includes('is_active')) {
        db.exec('ALTER TABLE departments ADD COLUMN is_active INTEGER DEFAULT 1;');
      }
      if (!deptColumns.includes('updated_at')) {
        db.exec('ALTER TABLE departments ADD COLUMN updated_at DATETIME;');
      }
    }

    // Ensure complaint_images table has metadata columns for secure uploads
    const imagesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='complaint_images'").get();
    if (imagesTableExists) {
      const imgColumns = db.prepare('PRAGMA table_info(complaint_images)').all().map((c) => c.name);
      if (!imgColumns.includes('file_name')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN file_name TEXT;');
      }
      if (!imgColumns.includes('file_path')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN file_path TEXT;');
      }
      if (!imgColumns.includes('mime_type')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN mime_type TEXT;');
      }
      if (!imgColumns.includes('file_size')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN file_size INTEGER;');
      }

      // Geo-tagged live camera & video evidence metadata columns
      const liveEvidenceCols = [
        ['media_type', "TEXT DEFAULT 'IMAGE'"],
        ['sha256_hash', 'TEXT'],
        ['latitude', 'REAL'],
        ['longitude', 'REAL'],
        ['accuracy_meters', 'REAL'],
        ['device_captured_at', 'DATETIME'],
        ['recording_started_at', 'DATETIME'],
        ['recording_ended_at', 'DATETIME'],
        ['server_received_at', 'DATETIME'],
        ['capture_type', "TEXT DEFAULT 'LIVE_CAMERA'"],
        ['evidence_purpose', "TEXT DEFAULT 'citizen_report'"],
        ['duration_seconds', 'REAL'],
        ['uploader_role', 'TEXT'],
        ['department_id', 'TEXT'],
      ];
      for (const [colName, colType] of liveEvidenceCols) {
        if (!imgColumns.includes(colName)) {
          db.exec(`ALTER TABLE complaint_images ADD COLUMN ${colName} ${colType};`);
        }
      }
    }

    // Ensure users table has residential address columns for citizen registration
    const usersTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (usersTableExists) {
      const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
      const addressCols = [
        'state', 'district', 'ulb', 'locality', 'street', 'pin_code', 'house_number', 'landmark',
        'locality_verification_level', 'ulb_verification_status'
      ];
      for (const col of addressCols) {
        if (!userColumns.includes(col)) {
          db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT;`);
        }
      }
    }

    // Ensure citizen_pending_registrations table has address verification columns
    const pendingTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='citizen_pending_registrations'").get();
    if (pendingTableExists) {
      const pendingColumns = db.prepare('PRAGMA table_info(citizen_pending_registrations)').all().map((c) => c.name);
      if (!pendingColumns.includes('locality_verification_level')) {
        db.exec("ALTER TABLE citizen_pending_registrations ADD COLUMN locality_verification_level TEXT DEFAULT 'manual_unverified';");
      }
      if (!pendingColumns.includes('ulb_verification_status')) {
        db.exec("ALTER TABLE citizen_pending_registrations ADD COLUMN ulb_verification_status TEXT DEFAULT 'UNVERIFIED';");
      }
    }

    // Ensure Stage 1 anti-enumeration & provider abuse tables exist
    db.exec(`
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

      CREATE TABLE IF NOT EXISTS provider_dispatch_quotas (
        quota_key TEXT PRIMARY KEY,
        dispatch_count INTEGER NOT NULL DEFAULT 1,
        window_start INTEGER NOT NULL,
        window_expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_quotas_expires ON provider_dispatch_quotas(window_expires_at);

      CREATE TABLE IF NOT EXISTS provider_circuit_breakers (
        provider_name TEXT PRIMARY KEY,
        state TEXT CHECK(state IN ('CLOSED', 'OPEN', 'HALF_OPEN')) NOT NULL DEFAULT 'CLOSED',
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_failure_at INTEGER DEFAULT 0,
        cooldown_until INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS civic_intelligence_reports (
        id TEXT PRIMARY KEY,
        generated_by_user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        time_period TEXT NOT NULL,
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

      -- Task Deadlines Audit History (Admin-Only Authority)
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

      -- Official Notifications (Deadlines, Reassignments)
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

      -- Grievance Support System (Citizens & Engineers)
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

      -- Grievance Responses & Status Audit Records
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

      -- Government Tenders (State & Central Public Procurement)
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

      -- Government Tender Audit Logs
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
    `);

    // 2. Execute full schema SQL
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);

    console.log('[CivicMemory DB] Database schema and indexes verified using native node:sqlite.');
  } else {
    console.warn('[CivicMemory DB] schema.sql not found at:', schemaPath);
  }
  return db;
}

export default db;
