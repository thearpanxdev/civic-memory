/**
 * ====================================================================
 * CivicMemory — Realistic Database Seeder
 * ====================================================================
 * Demonstrates:
 * 1. Municipal Departments and Administrative Wards
 * 2. Securely Hashed Demo User Credentials (Admin, Officials, Citizens)
 * 3. Core Civic Complaints across categories, severities, and lifecycles
 * 4. CivicMemory Core Differentiator:
 *    - Duplicate complaints linked to an active primary ticket
 *    - Historical incident marked repaired and resolved
 *    - Recurring incident occurring months later at the exact same location
 *    - Relational linking preserving full civic memory & repair history
 * 5. Complete Audit Trail:
 *    - Sequential complaint status history
 *    - Citizen verification records (satisfactory and rejected)
 *    - Citizen supporters (me-too upvotes)
 *    - AI analysis audit records
 * ====================================================================
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db, { initDatabase } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure schema is up to date
initDatabase();

// Ensure demo uploads directory exists with lightweight sample assets
const demoUploadsDir = path.resolve(__dirname, '../../uploads/demo');
if (!fs.existsSync(demoUploadsDir)) {
  fs.mkdirSync(demoUploadsDir, { recursive: true });
}

const sampleSvg = (title, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="${color}"/>
  <text x="300" y="190" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">CivicMemory Evidence</text>
  <text x="300" y="230" font-family="Arial, sans-serif" font-size="16" fill="#e2e8f0" text-anchor="middle">${title}</text>
</svg>`;

const demoFiles = [
  { name: 'pothole_crater_feb2026.svg', title: 'Deep Pothole Crater (Feb 2026)', color: '#475569' },
  { name: 'pothole_patching_feb2026.svg', title: 'Road Crew Cold Patching (Feb 2026)', color: '#334155' },
  { name: 'pothole_repaired_feb2026.svg', title: 'Completed Asphalt Patch (Feb 2026)', color: '#1e293b' },
  { name: 'pothole_duplicate_feb2026.svg', title: 'Citizen Evidence View 2 (Feb 2026)', color: '#64748b' },
  { name: 'pothole_reopened_jul2026.svg', title: 'Sub-base Failure & Seepage (Jul 2026)', color: '#e11d48' },
  { name: 'water_pipe_burst.svg', title: 'Main Distribution Pipe Burst (Sep 2026)', color: '#0284c7' },
  { name: 'water_pipe_repaired.svg', title: 'New Flange Valve Replaced (Sep 2026)', color: '#0369a1' },
  { name: 'garbage_overflow.svg', title: 'Overflowing Bins at Market (Nov 2026)', color: '#d97706' },
  { name: 'drain_clogged.svg', title: 'Silt Blocked Storm Culvert (Nov 2026)', color: '#7c3aed' },
  { name: 'streetlights_dead.svg', title: 'Unlit Pedestrian Crossing (Nov 2026)', color: '#0f172a' },
  { name: 'park_debris_dumped.svg', title: 'Construction Waste by Gate (Aug 2026)', color: '#b45309' },
];

for (const file of demoFiles) {
  const filePath = path.join(demoUploadsDir, file.name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, sampleSvg(file.title, file.color));
  }
}

export function seedDatabase() {
  console.log('----------------------------------------------------');
  console.log('[CivicMemory Seed] Starting database seeding...');
  console.log('----------------------------------------------------');

  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('BEGIN TRANSACTION;');

  try {
    // ---------------------------------------------------------------
    // 1. WARDS (Administrative Divisions)
    // ---------------------------------------------------------------
    const insertWard = db.prepare(`
      INSERT OR IGNORE INTO wards (id, ward_number, name, zone, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    const wards = [
      ['ward-indiranagar', 'Ward 7', 'Indiranagar', 'Central Zone', 'High-density commercial and residential arterial corridor.'],
      ['ward-koramangala', 'Ward 12', 'Koramangala', 'South Zone', 'Mixed commercial and startup hub with flood-sensitive valleys.'],
      ['ward-whitefield', 'Ward 18', 'Whitefield', 'East Zone', 'Rapidly growing IT park corridor with heavy transit loads.'],
      ['ward-malleshwaram', 'Ward 24', 'Malleshwaram', 'West Zone', 'Heritage residential zone with bustling local markets.'],
      ['ward-jayanagar', 'Ward 31', 'Jayanagar', 'South Zone', 'Planned residential blocks with extensive tree cover and older storm drainage.'],
      ['ward-hsr', 'Ward 45', 'HSR Layout', 'South-East Zone', 'Modern residential sectors adjacent to outer ring road.'],
    ];

    for (const w of wards) {
      insertWard.run(...w);
    }
    console.log(`[Seed] Wards verified: ${wards.length}`);

    // ---------------------------------------------------------------
    // 2. DEPARTMENTS
    // ---------------------------------------------------------------
    const insertDept = db.prepare(`
      INSERT OR IGNORE INTO departments (id, name, code, description)
      VALUES (?, ?, ?, ?)
    `);

    const departments = [
      ['dept-roads', 'Roads and Infrastructure', 'ROADS', 'Maintenance of public roads, flyovers, potholes, pavements, and street medians.'],
      ['dept-sanitation', 'Sanitation and Waste Management', 'SANITATION', 'Solid waste collection, street sweeping, dump clearing, and public sanitation facilities.'],
      ['dept-water', 'Water Supply', 'WATER', 'Potable drinking water supply, mains distribution, valve maintenance, and leak repair.'],
      ['dept-drainage', 'Drainage and Sewerage', 'DRAINAGE', 'Stormwater drains, underground sewers, culvert unblocking, and monsoon flood relief.'],
      ['dept-lighting', 'Street Lighting', 'LIGHTING', 'Public road illumination, LED pole repairs, junction high-masts, and timer switches.'],
    ];

    for (const d of departments) {
      insertDept.run(...d);
    }
    console.log(`[Seed] Departments verified: ${departments.length}`);

    // ---------------------------------------------------------------
    // 3. USERS (Admin, Officials, Citizens with bcrypt password hashes)
    // ---------------------------------------------------------------
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, full_name, phone, role, department_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Standard salt rounds for demo accounts (10 rounds)
    const saltRounds = 10;
    const adminHash = bcrypt.hashSync('Admin@Civic2026!', saltRounds);
    const officialHash = bcrypt.hashSync('Official@Civic2026!', saltRounds);
    const citizenHash = bcrypt.hashSync('Citizen@Civic2026!', saltRounds);

    const users = [
      // Platform Admin
      ['user-admin-1', 'admin@civicmemory.local', adminHash, 'Municipal Commissioner Rajesh Rao', '9800000001', 'admin', null, 1],

      // Municipal Officials (One for each core department)
      ['user-official-roads', 'official.roads@civicmemory.local', officialHash, 'Eng. Suresh Patil (Roads Lead)', '9800000011', 'official', 'dept-roads', 1],
      ['user-official-sanitation', 'official.sanitation@civicmemory.local', officialHash, 'Officer Priya Nair (Sanitation Lead)', '9800000012', 'official', 'dept-sanitation', 1],
      ['user-official-water', 'official.water@civicmemory.local', officialHash, 'Eng. Ramesh Gupta (Water Supply)', '9800000013', 'official', 'dept-water', 1],
      ['user-official-drainage', 'official.drainage@civicmemory.local', officialHash, 'Officer Anita Rao (Drainage Lead)', '9800000014', 'official', 'dept-drainage', 1],
      ['user-official-lighting', 'official.lighting@civicmemory.local', officialHash, 'Tech. Deepak Kumar (Street Lighting)', '9800000015', 'official', 'dept-lighting', 1],

      // Citizens
      ['user-citizen-arjun', 'citizen.arjun@civicmemory.local', citizenHash, 'Arjun Sharma', '9811110001', 'citizen', null, 1],
      ['user-citizen-meera', 'citizen.meera@civicmemory.local', citizenHash, 'Meera Krishnan', '9811110002', 'citizen', null, 1],
      ['user-citizen-rohit', 'citizen.rohit@civicmemory.local', citizenHash, 'Rohit Deshmukh', '9811110003', 'citizen', null, 1],
      ['user-citizen-sneha', 'citizen.sneha@civicmemory.local', citizenHash, 'Sneha Varma', '9811110004', 'citizen', null, 1],
    ];

    for (const u of users) {
      insertUser.run(...u);
    }
    console.log(`[Seed] Demo users verified: ${users.length} (Password hashes verified)`);

    // ---------------------------------------------------------------
    // 4. COMPLAINTS (Demonstrating Historical Memory, Duplicates & Recurrence)
    // ---------------------------------------------------------------
    const insertComplaint = db.prepare(`
      INSERT OR IGNORE INTO complaints (
        id, ticket_number, citizen_id, department_id, assigned_official_id,
        title, description, category, severity, status,
        latitude, longitude, address, landmark, ward_zone, ward_id,
        duplicate_of_id, root_incident_id, relation_type,
        is_recurring, recurrence_count, support_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const complaints = [
      // -------------------------------------------------------------
      // SCENARIO 1A: Historical Root Incident (Resolved)
      // Pothole on 100ft Road reported in Feb 2026, patched and closed.
      // -------------------------------------------------------------
      [
        'cmp-101',
        'CM-2026-00101',
        'user-citizen-arjun',
        'dept-roads',
        'user-official-roads',
        'Deep crater pothole causing vehicle axle damage',
        'Large crater-like pothole (~2.5 ft wide, 6 inches deep) on the right lane of 100ft Road just before 12th Main signal. Two two-wheelers skidded yesterday.',
        'Roads and Infrastructure',
        'high',
        'Resolved',
        12.9784,
        77.6408,
        '100ft Road, near 12th Main Junction, Indiranagar',
        'Opposite Metro Pillar #82',
        'Ward 7 - Indiranagar (Central Zone)',
        'ward-indiranagar',
        null,
        'cmp-101', // Root incident references itself
        'standalone',
        0,
        0,
        3,
        '2026-02-10 09:30:00',
        '2026-02-16 11:30:00'
      ],

      // -------------------------------------------------------------
      // SCENARIO 1B: Duplicate Complaint (Linked to active Incident 1A)
      // Sneha reported the exact same pothole 6 hours later.
      // Verified and linked as a duplicate without merging or dropping evidence.
      // -------------------------------------------------------------
      [
        'cmp-102',
        'CM-2026-00102',
        'user-citizen-sneha',
        'dept-roads',
        'user-official-roads',
        'Severe road damage on 100ft road near 12th main',
        'Dangerous pothole near the signal. Cars are suddenly swerving to avoid it.',
        'Roads and Infrastructure',
        'high',
        'Verified',
        12.9785,
        77.6409,
        '100ft Road, adjacent to 12th Main intersection',
        'Near Metro Pillar #82',
        'Ward 7 - Indiranagar (Central Zone)',
        'ward-indiranagar',
        'cmp-101', // Explicitly points to primary active ticket CM-2026-00101
        'cmp-101',
        'duplicate',
        0,
        0,
        1,
        '2026-02-10 15:20:00',
        '2026-02-11 11:00:00'
      ],

      // -------------------------------------------------------------
      // SCENARIO 1C: THE CORE DIFFERENTIATOR — Recurring Incident (5 months later)
      // The road patch from Feb washed away in monsoons; water leaking from beneath.
      // Linked to historical cluster 'cmp-101' showing chronic infrastructure failure!
      // -------------------------------------------------------------
      [
        'cmp-450',
        'CM-2026-00450',
        'user-citizen-meera',
        'dept-roads',
        'user-official-roads',
        'Pothole reopened at exact same spot on 100ft Road with water pooling',
        'The road patch done in February has completely washed away following monsoon showers. Water is continuously bubbling from underneath and the cavity is sinking deeper.',
        'Roads and Infrastructure',
        'critical',
        'In Progress',
        12.9784,
        77.6408,
        '100ft Road, near 12th Main Junction, Indiranagar',
        'Opposite Metro Pillar #82 (Same coordinate as CM-2026-00101)',
        'Ward 7 - Indiranagar (Central Zone)',
        'ward-indiranagar',
        null, // NOT a duplicate; this is a recurrence of a resolved issue!
        'cmp-101', // Linked to historical root incident!
        'recurring',
        1,
        1,
        4,
        '2026-07-22 10:15:00',
        '2026-07-24 11:00:00'
      ],

      // -------------------------------------------------------------
      // SCENARIO 2: Water Supply Burst (Awaiting Citizen Verification)
      // -------------------------------------------------------------
      [
        'cmp-210',
        'CM-2026-00210',
        'user-citizen-rohit',
        'dept-water',
        'user-official-water',
        'High pressure potable water pipe burst flooding 4th Cross',
        'Clean drinking water gushing onto the street from main distribution valve. Water wasted continuously for 4 hours.',
        'Water Supply',
        'critical',
        'Awaiting Citizen Verification',
        12.9352,
        77.6245,
        '4th Cross, 5th Block, Koramangala',
        'Near Canara Bank ATM',
        'Ward 12 - Koramangala (South Zone)',
        'ward-koramangala',
        null,
        'cmp-210',
        'standalone',
        0,
        0,
        5,
        '2026-09-05 07:00:00',
        '2026-09-06 16:30:00'
      ],

      // -------------------------------------------------------------
      // SCENARIO 3: Sanitation Overflow (Assigned)
      // -------------------------------------------------------------
      [
        'cmp-305',
        'CM-2026-00305',
        'user-citizen-arjun',
        'dept-sanitation',
        'user-official-sanitation',
        'Commercial vegetable waste and plastic dump overflowing onto sidewalk',
        'Black garbage bins overflowing for 3 days. Stray animals scattering refuse, pedestrian pathway completely blocked.',
        'Sanitation and Waste Management',
        'medium',
        'Assigned',
        13.0031,
        77.5643,
        '8th Cross Market, Malleshwaram',
        'Behind Central Market Complex',
        'Ward 24 - Malleshwaram (West Zone)',
        'ward-malleshwaram',
        null,
        'cmp-305',
        'standalone',
        0,
        0,
        2,
        '2026-11-18 08:30:00',
        '2026-11-19 10:00:00'
      ],

      // -------------------------------------------------------------
      // SCENARIO 4: Blocked Drainage (Under Review)
      // -------------------------------------------------------------
      [
        'cmp-340',
        'CM-2026-00340',
        'user-citizen-meera',
        'dept-drainage',
        'user-official-drainage',
        'Stormwater culvert clogged with construction silt and plastic bottles',
        'Rainwater pooling 8 inches high on the corner after short rain shower because the roadside culvert grate is packed with hard silt.',
        'Drainage and Sewerage',
        'high',
        'Under Review',
        12.9250,
        77.5938,
        '14th Main, 4th Block, Jayanagar',
        'Near Post Office',
        'Ward 31 - Jayanagar (South Zone)',
        'ward-jayanagar',
        null,
        'cmp-340',
        'standalone',
        0,
        0,
        3,
        '2026-11-20 14:00:00',
        '2026-11-20 16:30:00'
      ],

      // -------------------------------------------------------------
      // SCENARIO 5: Non-functional Streetlights (Submitted - Fresh)
      // -------------------------------------------------------------
      [
        'cmp-401',
        'CM-2026-00401',
        'user-citizen-sneha',
        'dept-lighting',
        null, // Not yet assigned
        'String of 5 LED streetlights dead along pedestrian bus shelter',
        'Streetlights on poles #WF-L14 through #WF-L18 have been dead for a week. The bus stop is in complete pitch darkness creating safety concerns.',
        'Street Lighting',
        'medium',
        'Submitted',
        12.9698,
        77.7499,
        'ITPL Main Road, Whitefield',
        'Near BMTC Bus Shelter #4',
        'Ward 18 - Whitefield (East Zone)',
        'ward-whitefield',
        null,
        'cmp-401',
        'standalone',
        0,
        0,
        1,
        '2026-11-21 06:45:00',
        '2026-11-21 06:45:00'
      ],

      // -------------------------------------------------------------
      // SCENARIO 6: Reopened Case (Citizen Verification Rejected)
      // Official claimed debris was cleared, but citizen showed it remained.
      // -------------------------------------------------------------
      [
        'cmp-180',
        'CM-2026-00180',
        'user-citizen-rohit',
        'dept-sanitation',
        'user-official-sanitation',
        'Construction debris dumped on public park boundary',
        'Truck dumped concrete rubble right outside community park gate.',
        'Sanitation and Waste Management',
        'high',
        'Reopened',
        12.9116,
        77.6389,
        '19th Main, Sector 2, HSR Layout',
        'Opposite Agara Lake Park Gate 3',
        'Ward 45 - HSR Layout (South-East Zone)',
        'ward-hsr',
        null,
        'cmp-180',
        'standalone',
        0,
        0,
        2,
        '2026-08-14 10:00:00',
        '2026-08-18 16:00:00'
      ],
    ];

    for (const c of complaints) {
      insertComplaint.run(...c);
    }
    console.log(`[Seed] Sample complaints verified: ${complaints.length}`);

    // ---------------------------------------------------------------
    // 5. COMPLAINT IMAGES (Before, Progress, and After Repair Evidence)
    // ---------------------------------------------------------------
    const insertImage = db.prepare(`
      INSERT OR IGNORE INTO complaint_images (id, complaint_id, uploader_id, image_url, image_type, caption, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const images = [
      // CM-2026-00101 (Resolved pothole)
      ['img-101-before', 'cmp-101', 'user-citizen-arjun', '/uploads/demo/pothole_crater_feb2026.svg', 'before_report', 'Large crater pothole on 100ft road', '2026-02-10 09:30:00'],
      ['img-101-progress', 'cmp-101', 'user-official-roads', '/uploads/demo/pothole_patching_feb2026.svg', 'progress', 'Road maintenance crew pouring asphalt mix', '2026-02-13 14:00:00'],
      ['img-101-after', 'cmp-101', 'user-official-roads', '/uploads/demo/pothole_repaired_feb2026.svg', 'after_repair', 'Compacted patch completed and traffic reopened', '2026-02-14 17:00:00'],

      // CM-2026-00102 (Duplicate ticket evidence)
      ['img-102-before', 'cmp-102', 'user-citizen-sneha', '/uploads/demo/pothole_duplicate_feb2026.svg', 'before_report', 'Perspective view of pothole from pedestrian crosswalk', '2026-02-10 15:20:00'],

      // CM-2026-00450 (Recurring failure at exact same location)
      ['img-450-before', 'cmp-450', 'user-citizen-meera', '/uploads/demo/pothole_reopened_jul2026.svg', 'before_report', 'Patch collapse with underground water bubbling after rain', '2026-07-22 10:15:00'],

      // CM-2026-00210 (Water burst)
      ['img-210-before', 'cmp-210', 'user-citizen-rohit', '/uploads/demo/water_pipe_burst.svg', 'before_report', 'Pressurized drinking water flooding road', '2026-09-05 07:00:00'],
      ['img-210-after', 'cmp-210', 'user-official-water', '/uploads/demo/water_pipe_repaired.svg', 'after_repair', 'Replacement distribution flange valve installed', '2026-09-06 15:00:00'],

      // CM-2026-00305 (Garbage)
      ['img-305-before', 'cmp-305', 'user-citizen-arjun', '/uploads/demo/garbage_overflow.svg', 'before_report', 'Sidewalk blocked by commercial refuse', '2026-11-18 08:30:00'],

      // CM-2026-00340 (Drainage)
      ['img-340-before', 'cmp-340', 'user-citizen-meera', '/uploads/demo/drain_clogged.svg', 'before_report', 'Culvert packed with silt causing standing water', '2026-11-20 14:00:00'],

      // CM-2026-00401 (Streetlights)
      ['img-401-before', 'cmp-401', 'user-citizen-sneha', '/uploads/demo/streetlights_dead.svg', 'before_report', 'Dark bus stop and unlit road corridor', '2026-11-21 06:45:00'],

      // CM-2026-00180 (Reopened)
      ['img-180-before', 'cmp-180', 'user-citizen-rohit', '/uploads/demo/park_debris_dumped.svg', 'before_report', 'Demolition waste blocking park entry gate', '2026-08-14 10:00:00'],
    ];

    for (const img of images) {
      insertImage.run(...img);
    }
    console.log(`[Seed] Complaint images verified: ${images.length}`);

    // ---------------------------------------------------------------
    // 6. COMPLAINT STATUS AUDIT TRAIL (Append-only state machine)
    // ---------------------------------------------------------------
    const insertHistory = db.prepare(`
      INSERT OR IGNORE INTO complaint_status_history (id, complaint_id, changed_by_user_id, from_status, to_status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const histories = [
      // Timeline for CM-2026-00101 (Resolved)
      ['hist-101-1', 'cmp-101', 'user-citizen-arjun', null, 'Submitted', 'Initial complaint submitted with photo evidence.', '2026-02-10 09:30:00'],
      ['hist-101-2', 'cmp-101', 'user-official-roads', 'Submitted', 'Under Review', 'Triage review confirmed dangerous pothole on high-speed lane.', '2026-02-10 11:15:00'],
      ['hist-101-3', 'cmp-101', 'user-official-roads', 'Under Review', 'Verified', 'Field engineer verified road depression and asphalt loss.', '2026-02-10 14:00:00'],
      ['hist-101-4', 'cmp-101', 'user-official-roads', 'Verified', 'Assigned', 'Assigned to Ward 7 Quick Response Road Team.', '2026-02-11 10:00:00'],
      ['hist-101-5', 'cmp-101', 'user-official-roads', 'Assigned', 'In Progress', 'Asphalt surface leveling and compaction started.', '2026-02-13 08:30:00'],
      ['hist-101-6', 'cmp-101', 'user-official-roads', 'In Progress', 'Work Completed', 'Cold asphalt patch compacted. Uploaded completion photo.', '2026-02-14 17:00:00'],
      ['hist-101-7', 'cmp-101', 'user-official-roads', 'Work Completed', 'Awaiting Citizen Verification', 'Notification triggered to reporting citizen for verification.', '2026-02-15 09:00:00'],
      ['hist-101-8', 'cmp-101', 'user-citizen-arjun', 'Awaiting Citizen Verification', 'Resolved', 'Citizen Arjun Sharma confirmed road surface is smooth and safe.', '2026-02-16 11:30:00'],

      // Timeline for CM-2026-00102 (Duplicate)
      ['hist-102-1', 'cmp-102', 'user-citizen-sneha', null, 'Submitted', 'Duplicate report filed by citizen.', '2026-02-10 15:20:00'],
      ['hist-102-2', 'cmp-102', 'user-official-roads', 'Submitted', 'Verified', 'Linked as duplicate of primary incident CM-2026-00101. Evidence preserved.', '2026-02-11 11:00:00'],

      // Timeline for CM-2026-00450 (Recurring Issue)
      ['hist-450-1', 'cmp-450', 'user-citizen-meera', null, 'Submitted', 'Citizen reported recurring road failure at previous repair location.', '2026-07-22 10:15:00'],
      ['hist-450-2', 'cmp-450', 'user-official-roads', 'Submitted', 'Under Review', 'CivicMemory flagged historic failure: CM-2026-00101 repaired on Feb 14 was washed away.', '2026-07-22 12:00:00'],
      ['hist-450-3', 'cmp-450', 'user-official-roads', 'Under Review', 'Verified', 'Field inspection confirms recurring cavity; sub-base water saturation diagnosed.', '2026-07-22 16:30:00'],
      ['hist-450-4', 'cmp-450', 'user-official-roads', 'Verified', 'Assigned', 'Joint dispatch requested with Water Supply Department.', '2026-07-23 09:00:00'],
      ['hist-450-5', 'cmp-450', 'user-official-roads', 'Assigned', 'In Progress', 'Excavation ordered to expose suspected leaking water line before re-tarring.', '2026-07-24 11:00:00'],

      // Timeline for CM-2026-00210 (Water Supply)
      ['hist-210-1', 'cmp-210', 'user-citizen-rohit', null, 'Submitted', 'Emergency water pipeline burst reported.', '2026-09-05 07:00:00'],
      ['hist-210-2', 'cmp-210', 'user-official-water', 'Submitted', 'Verified', 'Line valve shut down to prevent further wastage.', '2026-09-05 08:30:00'],
      ['hist-210-3', 'cmp-210', 'user-official-water', 'Verified', 'Assigned', 'Pipe repair crew dispatched.', '2026-09-05 10:00:00'],
      ['hist-210-4', 'cmp-210', 'user-official-water', 'Assigned', 'In Progress', 'Old cracked coupling removed; new high-pressure valve fitted.', '2026-09-05 13:00:00'],
      ['hist-210-5', 'cmp-210', 'user-official-water', 'In Progress', 'Work Completed', 'Pressure test successful. No leakage detected.', '2026-09-06 15:00:00'],
      ['hist-210-6', 'cmp-210', 'user-official-water', 'Work Completed', 'Awaiting Citizen Verification', 'Awaiting verification from resident.', '2026-09-06 16:30:00'],

      // Timeline for CM-2026-00180 (Reopened)
      ['hist-180-1', 'cmp-180', 'user-citizen-rohit', null, 'Submitted', 'Reported debris dumped by park entrance.', '2026-08-14 10:00:00'],
      ['hist-180-2', 'cmp-180', 'user-official-sanitation', 'Submitted', 'In Progress', 'Sanitation contractor notified to haul debris.', '2026-08-15 09:00:00'],
      ['hist-180-3', 'cmp-180', 'user-official-sanitation', 'In Progress', 'Work Completed', 'Official reported debris cleared.', '2026-08-17 14:00:00'],
      ['hist-180-4', 'cmp-180', 'user-official-sanitation', 'Work Completed', 'Awaiting Citizen Verification', 'Notification sent to citizen.', '2026-08-17 15:00:00'],
      ['hist-180-5', 'cmp-180', 'user-citizen-rohit', 'Awaiting Citizen Verification', 'Reopened', 'Citizen inspection: Only small garbage was removed; concrete rubble is still blocking park gate.', '2026-08-18 16:00:00'],
    ];

    for (const h of histories) {
      insertHistory.run(...h);
    }
    console.log(`[Seed] Complaint history records verified: ${histories.length}`);

    // ---------------------------------------------------------------
    // 7. CITIZEN RESOLUTION VERIFICATIONS
    // ---------------------------------------------------------------
    const insertVerification = db.prepare(`
      INSERT OR IGNORE INTO citizen_verifications (id, complaint_id, citizen_id, is_satisfactory, feedback, verification_photo_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const verifications = [
      // Satisfactory confirmation for CM-2026-00101
      ['ver-101', 'cmp-101', 'user-citizen-arjun', 1, 'The pothole was leveled and compacted properly. Smooth passage for traffic now.', null, '2026-02-16 11:30:00'],

      // Rejected verification for CM-2026-00180 (causing Reopened state)
      ['ver-180', 'cmp-180', 'user-citizen-rohit', 0, 'The contractor only cleared loose litter. The heavy concrete slabs and broken tiles are still blocking the pedestrian gate!', '/uploads/demo/park_debris_dumped.svg', '2026-08-18 16:00:00'],
    ];

    for (const v of verifications) {
      insertVerification.run(...v);
    }
    console.log(`[Seed] Citizen verification records verified: ${verifications.length}`);

    // ---------------------------------------------------------------
    // 8. CITIZEN COMPLAINT SUPPORTERS (Me-too / Upvotes)
    // ---------------------------------------------------------------
    const insertSupporter = db.prepare(`
      INSERT OR IGNORE INTO complaint_supporters (id, complaint_id, citizen_id, comment, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const supporters = [
      ['sup-101-1', 'cmp-101', 'user-citizen-meera', 'I commute daily on this road. This pothole has damaged many vehicle rims.', '2026-02-10 11:00:00'],
      ['sup-101-2', 'cmp-101', 'user-citizen-rohit', 'Strongly support immediate repair, very risky at night.', '2026-02-10 12:45:00'],
      ['sup-450-1', 'cmp-450', 'user-citizen-arjun', 'This is the exact same spot that was fixed in February. The water is definitely leaking from underneath.', '2026-07-22 11:30:00'],
      ['sup-450-2', 'cmp-450', 'user-citizen-sneha', 'Can confirm, my car hit this bump this morning. Needs a permanent fix, not another quick patch.', '2026-07-22 14:10:00'],
      ['sup-210-1', 'cmp-210', 'user-citizen-meera', 'Massive water wastage. Please prioritize!', '2026-09-05 08:00:00'],
    ];

    for (const s of supporters) {
      insertSupporter.run(...s);
    }
    console.log(`[Seed] Citizen supporters verified: ${supporters.length}`);

    // ---------------------------------------------------------------
    // 9. AI ANALYSIS AUDIT RECORDS (Civic Intelligence Logs)
    // ---------------------------------------------------------------
    const insertAiAnalysis = db.prepare(`
      INSERT OR IGNORE INTO ai_analyses (id, complaint_id, analysis_type, raw_prompt_summary, response_json, model_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const aiAnalyses = [
      [
        'ai-450-recurrence',
        'cmp-450',
        'recurrence_risk',
        'Analyze recurrence cluster: CM-2026-00101 (repaired Feb 14) and CM-2026-00450 (reopened Jul 22) at coordinate (12.9784, 77.6408).',
        JSON.stringify({
          recurrence_detected: true,
          cluster_root_id: 'CM-2026-00101',
          days_between_incidents: 158,
          location_delta_meters: 0.0,
          failure_mode: 'Sub-base washout and asphalt cohesion loss',
          hypothesis: 'Surface patching has failed twice in under 6 months. High probability of pressurized drinking water pipe leak or groundwater drainage infiltration underneath the pavement.',
          recommended_action: 'Conduct non-destructive ground penetrating radar (GPR) or joint excavation with Water Supply Board before asphalt re-tarring.',
          severity_upgrade: 'Upgraded from medium to critical due to chronic failure history.'
        }),
        'gemini-4-hydrogen',
        '2026-07-22 12:05:00'
      ],
      [
        'ai-102-duplicate',
        'cmp-102',
        'duplicate_detection',
        'Assess semantic and spatial proximity between CM-2026-00101 and CM-2026-00102.',
        JSON.stringify({
          is_duplicate: true,
          target_ticket_number: 'CM-2026-00101',
          spatial_distance_meters: 14.8,
          semantic_similarity_score: 0.94,
          rationale: 'Both reports describe a severe, vehicle-damaging road pothole adjacent to Metro Pillar 82 at 100ft Road / 12th Main junction filed within a 6-hour window.',
          recommendation: 'Link CM-2026-00102 as duplicate report to consolidate municipal response while preserving citizen evidence.'
        }),
        'gemini-4-hydrogen',
        '2026-02-10 15:22:00'
      ]
    ];

    for (const a of aiAnalyses) {
      insertAiAnalysis.run(...a);
    }
    console.log(`[Seed] AI analysis audit records verified: ${aiAnalyses.length}`);

    // Commit Transaction
    db.exec('COMMIT;');
    console.log('----------------------------------------------------');
    console.log('[CivicMemory Seed] Database seeding completed successfully.');
    console.log('----------------------------------------------------');
  } catch (error) {
    db.exec('ROLLBACK;');
    console.error('[CivicMemory Seed] Error seeding database:', error);
    throw error;
  }
}

// Direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  try {
    seedDatabase();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
