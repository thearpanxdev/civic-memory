import db from '../config/database.js';

console.log('====================================================');
console.log('CivicMemory Phase 2A — Database Seeding Verification');
console.log('====================================================');

// 1. Record counts
console.log('\n--- 1. RECORD COUNTS ---');
const tables = [
  'wards',
  'departments',
  'users',
  'complaints',
  'complaint_images',
  'complaint_status_history',
  'citizen_verifications',
  'complaint_supporters',
  'ai_analyses',
  'audit_logs',
];

const counts = {};
for (const t of tables) {
  const row = db.prepare(`SELECT count(*) as count FROM ${t}`).get();
  counts[t] = row.count;
  console.log(`  • ${t.padEnd(26)}: ${row.count}`);
}

// 2. Foreign Key Integrity Check
console.log('\n--- 2. FOREIGN KEY INTEGRITY ---');
const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
if (fkCheck.length === 0) {
  console.log('  ✓ 100% Valid. Zero foreign key violations.');
} else {
  console.error('  ✗ Foreign key violations found:', fkCheck);
}

// 3. User Credentials & Password Hash Verification
console.log('\n--- 3. USER ACCOUNTS & PASSWORD HASHES ---');
const users = db.prepare('SELECT id, email, role, password_hash, full_name FROM users').all();
for (const u of users) {
  const isBcrypt = u.password_hash.startsWith('$2b$') || u.password_hash.startsWith('$2a$');
  console.log(`  • [${u.role.toUpperCase()}] ${u.email.padEnd(35)} | Hash: ${u.password_hash.substring(0, 15)}... | Bcrypt: ${isBcrypt ? 'YES' : 'NO'}`);
}

// 4. CivicMemory Core Differentiator: Historical Memory & Recurrence
console.log('\n--- 4. CIVICMEMORY HISTORICAL INCIDENT CLUSTER (100ft Road, Ward 7) ---');
const cluster = db.prepare(`
  SELECT 
    c.ticket_number, 
    c.status, 
    c.relation_type, 
    c.duplicate_of_id, 
    c.root_incident_id, 
    c.is_recurring, 
    c.recurrence_count,
    c.support_count,
    c.created_at,
    u.full_name as reported_by
  FROM complaints c
  JOIN users u ON c.citizen_id = u.id
  WHERE c.root_incident_id = 'cmp-101'
  ORDER BY c.created_at ASC
`).all();

console.table(cluster);

// 5. Verification of Status Lifecycles
console.log('\n--- 5. STATUS LIFECYCLE BREAKDOWN ---');
const statusBreakdown = db.prepare(`
  SELECT status, count(*) as count 
  FROM complaints 
  GROUP BY status 
  ORDER BY count DESC
`).all();
console.table(statusBreakdown);

// 6. Citizen Verifications Test (Accepted vs Rejected)
console.log('\n--- 6. CITIZEN RESOLUTION VERIFICATIONS ---');
const verifications = db.prepare(`
  SELECT 
    c.ticket_number, 
    c.title,
    c.status, 
    v.is_satisfactory, 
    v.feedback, 
    u.full_name as verified_by
  FROM citizen_verifications v
  JOIN complaints c ON v.complaint_id = c.id
  JOIN users u ON v.citizen_id = u.id
`).all();
console.table(verifications);

// 7. Complaint Evidence Images
console.log('\n--- 7. EVIDENCE IMAGES PER TYPE ---');
const images = db.prepare(`
  SELECT image_type, count(*) as count 
  FROM complaint_images 
  GROUP BY image_type
`).all();
console.table(images);

console.log('====================================================');
console.log('Verification completed successfully.');
console.log('====================================================');
