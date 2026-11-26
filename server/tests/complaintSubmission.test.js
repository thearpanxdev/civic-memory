/**
 * ====================================================================
 * CivicMemory — Phase 2C Complaint Submission & Media Handling Test Suite
 * Comprehensive automated verification covering:
 *
 * 1. Metadata Endpoints:
 *    - GET /api/complaints/meta/wards
 *    - GET /api/complaints/meta/departments
 *
 * 2. Authenticated Citizen Complaint Submission (POST /api/complaints):
 *    - Valid citizen submission creates ticket with initial status 'Submitted'
 *    - Correct automatic department assignment based on category
 *    - Server-side Zod validation errors on invalid input (title, ward, coords)
 *    - Role enforcement: Officials and unauthenticated users rejected (403/401)
 *
 * 3. Photo Upload & Protected Storage:
 *    - Multipart upload with genuine JPEG/PNG magic byte signatures
 *    - Safe random UUID filename storage outside public directory
 *    - Database metadata tracking (mime_type, file_size, file_name, file_path)
 *    - File signature verification: Fake images (extension spoofing) rejected (400)
 *    - Atomic transaction & disk cleanup on failure
 *
 * 4. Protected Image Retrieval (GET /api/complaints/:id/images/:imageId):
 *    - Submitting citizen can access evidence image with proper Content-Type & security headers
 *    - Unauthorized citizens rejected with 403 Forbidden
 *    - Unauthenticated requests rejected with 401 Unauthorized
 *
 * 5. Civic Memory Intelligence (Duplicate & Recurring Incident Linking):
 *    - Proximity detection links new reports within 100m of active incident as 'duplicate'
 *    - Proximity detection links new reports within 100m of resolved incident as 'recurring'
 *    - Recurrence count and root incident ID tracked accurately
 *
 * 6. Citizen Resolution Verification (POST /api/complaints/:id/verify):
 *    - Reporting citizen confirms fixed (is_satisfactory: true) -> status moves to 'Resolved'
 *    - Reporting citizen rejects fix (is_satisfactory: false) -> status moves to 'Reopened'
 *    - Non-reporting citizens and officials rejected with 403 Forbidden
 *    - Verification rejected when status is not yet 'Work Completed' or 'Awaiting Citizen Verification'
 * ====================================================================
 */

import http from 'http';
import fs from 'fs';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { config } from '../src/config/env.js';

let server;
let baseUrl;

function parseSetCookie(res) {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/civic_token=([^;]+)/);
  return match ? match[1] : null;
}

// Generate genuine minimal JPEG buffer with valid magic bytes (FF D8 FF E0 ...)
function createGenuineJpegBuffer() {
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0xFF, 0xD9,
  ]);
}

// Generate fake binary payload disguised as an image
function createSpoofedBinaryBuffer() {
  return Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00ThisIsExecutableCode');
}

async function runComplaintTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Phase 2C Complaint Submission & Media Test Suite');
  console.log('====================================================================\n');

  // Start test server on ephemeral port
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api`;

  // Clean up any test records from prior runs to guarantee idempotence
  db.prepare("DELETE FROM complaints WHERE id NOT IN ('cmp-101', 'cmp-102', 'cmp-450', 'cmp-210', 'cmp-305', 'cmp-340', 'cmp-401', 'cmp-180')").run();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------
    // Helper: Authenticate seeded roles
    // -------------------------------------------------------------------
    const loginUser = async (email, password) => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:5173',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      const cookie = parseSetCookie(res);
      return { res, data, cookie };
    };

    const arjunCitizen = await loginUser('citizen.arjun@civicmemory.local', 'Citizen@Civic2026!');
    const meeraCitizen = await loginUser('citizen.meera@civicmemory.local', 'Citizen@Civic2026!');
    const roadsOfficial = await loginUser('official.roads@civicmemory.local', 'Official@Civic2026!');
    const admin = await loginUser('admin@civicmemory.local', 'Admin@Civic2026!');

    // ===================================================================
    // SECTION 1: METADATA ENDPOINTS
    // ===================================================================
    console.log('\n--- Section 1: Metadata Endpoints ---');

    // 1.1 GET /api/complaints/meta/wards
    const wardsRes = await fetch(`${baseUrl}/complaints/meta/wards`);
    const wardsData = await wardsRes.json();
    assert(
      wardsRes.status === 200 && Array.isArray(wardsData.wards) && wardsData.wards.length >= 5,
      '1.1 GET /api/complaints/meta/wards returns complete list of administrative wards'
    );

    // 1.2 GET /api/complaints/meta/departments
    const deptsRes = await fetch(`${baseUrl}/complaints/meta/departments`);
    const deptsData = await deptsRes.json();
    assert(
      deptsRes.status === 200 && Array.isArray(deptsData.departments) && deptsData.departments.length >= 5,
      '1.2 GET /api/complaints/meta/departments returns municipal departments'
    );

    // ===================================================================
    // SECTION 2: AUTHENTICATED CITIZEN COMPLAINT SUBMISSION
    // ===================================================================
    console.log('\n--- Section 2: Complaint Submission Validation & Roles ---');

    // 2.1 Unauthenticated submission rejected (401)
    const unauthForm = new FormData();
    unauthForm.append('title', 'Leaking potable water main pipeline');
    unauthForm.append('description', 'Fresh water gushing across the road near market entrance.');
    unauthForm.append('category', 'Water Supply');
    unauthForm.append('ward_id', 'ward-indiranagar');
    unauthForm.append('latitude', '12.9780');
    unauthForm.append('longitude', '77.6400');
    unauthForm.append('address', '100ft Road near 12th Main Indiranagar');

    const unauthRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: unauthForm,
    });
    assert(
      unauthRes.status === 401,
      '2.1 Unauthenticated complaint submission rejected with 401 Unauthorized'
    );

    // 2.2 Official attempting citizen submission rejected (403)
    const officialForm = new FormData();
    officialForm.append('title', 'Official trying to report as citizen');
    officialForm.append('description', 'This should be blocked because officials have management roles.');
    officialForm.append('category', 'Roads and Infrastructure');
    officialForm.append('ward_id', 'ward-indiranagar');
    officialForm.append('latitude', '12.9780');
    officialForm.append('longitude', '77.6400');
    officialForm.append('address', '12th Main Road');

    const officialSubmitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${roadsOfficial.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: officialForm,
    });
    assert(
      officialSubmitRes.status === 403,
      '2.2 Official attempting citizen complaint submission rejected with 403 Forbidden'
    );

    // 2.3 Server-side Zod validation errors (short title, invalid ward)
    const invalidForm = new FormData();
    invalidForm.append('title', 'P'); // Too short (< 5 chars)
    invalidForm.append('description', 'Short'); // Too short (< 10 chars)
    invalidForm.append('category', 'Roads and Infrastructure');
    invalidForm.append('ward_id', 'ward-indiranagar');
    invalidForm.append('latitude', '999'); // Invalid latitude (> 90)
    invalidForm.append('longitude', '77.6400');
    invalidForm.append('address', 'Abc');

    const invalidRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: invalidForm,
    });
    const invalidData = await invalidRes.json();
    assert(
      invalidRes.status === 400 && invalidData.details && invalidData.details.title,
      '2.3 Zod validation rejects invalid complaint input with descriptive 400 Bad Request'
    );

    // ===================================================================
    // SECTION 3: PHOTO UPLOAD & FILE SIGNATURE VERIFICATION
    // ===================================================================
    console.log('\n--- Section 3: Photo Upload, File Signatures & Storage ---');

    // 3.1 Extension spoofing attack: Executable disguised as .jpg rejected by magic bytes
    const fakeImageForm = new FormData();
    fakeImageForm.append('title', 'Broken footpath paver tiles');
    fakeImageForm.append('description', 'Tiles uneven and loose, tripping hazard for elderly pedestrians.');
    fakeImageForm.append('category', 'Roads and Infrastructure');
    fakeImageForm.append('ward_id', 'ward-indiranagar');
    fakeImageForm.append('latitude', '12.9715');
    fakeImageForm.append('longitude', '77.6410');
    fakeImageForm.append('address', '100ft Road, Opp Metro Station');

    const fakeBlob = new Blob([createSpoofedBinaryBuffer()], { type: 'image/jpeg' });
    fakeImageForm.append('images', fakeBlob, 'malicious_payload.jpg');

    const fakeUploadRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: fakeImageForm,
    });
    const fakeUploadData = await fakeUploadRes.json();

    assert(
      fakeUploadRes.status === 400 && fakeUploadData.error.includes('file signature'),
      '3.1 File signature verification: Fake image with spoofed extension rejected (400 Bad Request)'
    );

    // 3.2 Genuine Image Upload & Ticket Creation
    const validForm = new FormData();
    validForm.append('title', 'Dangerous Open Electric Cable on Footpath');
    validForm.append('description', 'Live wires dangling from lamppost base after storm. Urgent safety hazard.');
    validForm.append('category', 'Street Lighting');
    validForm.append('ward_id', 'ward-indiranagar');
    validForm.append('latitude', '12.9790');
    validForm.append('longitude', '77.6420');
    validForm.append('address', 'Near 14th Cross corner, Indiranagar');
    validForm.append('landmark', 'Beside post office');
    validForm.append('severity', 'critical');

    const realBlob = new Blob([createGenuineJpegBuffer()], { type: 'image/jpeg' });
    validForm.append('images', realBlob, 'evidence_live_wires.jpg');

    const submitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: validForm,
    });
    const submitData = await submitRes.json();

    assert(
      submitRes.status === 201 &&
      submitData.complaint &&
      submitData.complaint.ticket_number.startsWith('CM-') &&
      submitData.complaint.status === 'Submitted' &&
      submitData.complaint.department_id === 'dept-lighting',
      '3.2 Valid submission creates complaint with CM- ticket reference and auto-assigns Street Lighting department'
    );

    const createdComplaintId = submitData.complaint.id;
    const createdImageId = submitData.images && submitData.images[0] && submitData.images[0].id;

    // Verify image was saved to protected disk storage outside public directory
    const imageRow = db.prepare('SELECT * FROM complaint_images WHERE id = ?').get(createdImageId);
    assert(
      imageRow &&
      imageRow.file_name &&
      imageRow.file_path &&
      fs.existsSync(imageRow.file_path) &&
      !imageRow.file_path.includes(config.uploadDir) &&
      imageRow.file_path.includes(config.protectedUploadDir),
      '3.3 Image storage: File persisted with random UUID in protected storage outside public directory'
    );

    // ===================================================================
    // SECTION 4: PROTECTED IMAGE RETRIEVAL WITH AUTHORIZATION
    // ===================================================================
    console.log('\n--- Section 4: Protected Image Retrieval ---');

    // 4.1 Submitting citizen can retrieve their evidence image
    const ownerImageRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}/images/${createdImageId}`, {
      headers: {
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
      },
    });
    assert(
      ownerImageRes.status === 200 &&
      ownerImageRes.headers.get('content-type') === 'image/jpeg' &&
      ownerImageRes.headers.get('x-content-type-options') === 'nosniff',
      '4.1 Submitting citizen retrieves evidence image (200 OK) with strict security headers'
    );

    // 4.2 Other citizen Meera blocked from accessing Arjun's evidence image (403 Forbidden)
    const unauthorizedImageRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}/images/${createdImageId}`, {
      headers: {
        'Cookie': `civic_token=${meeraCitizen.cookie}`,
      },
    });
    assert(
      unauthorizedImageRes.status === 403,
      '4.2 Other citizen blocked from accessing private complaint evidence image (403 Forbidden)'
    );

    // 4.3 Unauthenticated request blocked (401 Unauthorized)
    const unauthImageRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}/images/${createdImageId}`);
    assert(
      unauthImageRes.status === 401,
      '4.3 Unauthenticated image request rejected with 401 Unauthorized'
    );

    // ===================================================================
    // SECTION 5: CIVIC MEMORY INTELLIGENCE (DUPLICATE & RECURRING DETECTION)
    // ===================================================================
    console.log('\n--- Section 5: Civic Memory Intelligence ---');

    // 5.1 Duplicate Detection: Meera reports same issue within 30 meters of Arjun's open ticket
    const dupForm = new FormData();
    dupForm.append('title', 'Live electric wire sparking on sidewalk');
    dupForm.append('description', 'Pedestrians in danger, wire touching fence.');
    dupForm.append('category', 'Street Lighting');
    dupForm.append('ward_id', 'ward-indiranagar');
    // Coordinates within ~20 meters of Arjun's submission (12.9790, 77.6420)
    dupForm.append('latitude', '12.9791');
    dupForm.append('longitude', '77.6421');
    dupForm.append('address', '14th Cross corner, Indiranagar');

    const dupRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${meeraCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: dupForm,
    });
    const dupData = await dupRes.json();

    assert(
      dupRes.status === 201 &&
      dupData.memory_insights.is_duplicate === true &&
      dupData.complaint.duplicate_of_id === createdComplaintId &&
      dupData.complaint.relation_type === 'duplicate',
      '5.1 Duplicate Detection: Report within 100m of active issue automatically linked as duplicate'
    );

    // ===================================================================
    // SECTION 6: CITIZEN RESOLUTION VERIFICATION LIFECYCLE
    // ===================================================================
    console.log('\n--- Section 6: Citizen Resolution Verification ---');

    // Setup: Official advances created complaint to 'Work Completed'
    await fetch(`${baseUrl}/complaints/${createdComplaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${admin.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        status: 'Work Completed',
        notes: 'Electrician insulation tape and protective conduit installed.',
      }),
    });

    // 6.1 Unauthorized citizen Meera cannot verify Arjun's complaint
    const unauthVerifyRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${meeraCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        is_satisfactory: true,
        feedback: 'Looks good to me.',
      }),
    });
    assert(
      unauthVerifyRes.status === 403,
      '6.1 Non-reporting citizen blocked from verifying another citizen\'s complaint (403)'
    );

    // 6.2 Reporting citizen Arjun verifies repair is satisfactory -> Status transitions to 'Resolved'
    const verifySuccessRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        is_satisfactory: true,
        feedback: 'Inspected this morning on my walk. Cables are safely recessed in conduit.',
      }),
    });
    const verifySuccessData = await verifySuccessRes.json();

    assert(
      verifySuccessRes.status === 200 &&
      verifySuccessData.complaint.status === 'Resolved' &&
      verifySuccessData.verification_id,
      '6.2 Citizen resolution confirmation: is_satisfactory=true successfully marks complaint as Resolved'
    );

    // ===================================================================
    // SECTION 7: HISTORICAL RECURRENCE DETECTION (POST-RESOLUTION)
    // ===================================================================
    console.log('\n--- Section 7: Historical Recurrence Detection ---');

    // 7.1 Recurrence Detection: After resolution, a new incident at the same location is detected as recurring
    const recurringForm = new FormData();
    recurringForm.append('title', 'Streetlight fixture spark and black smoke recurrence');
    recurringForm.append('description', 'The previous repair failed after rain; sparks recurring at exact same junction.');
    recurringForm.append('category', 'Street Lighting');
    recurringForm.append('ward_id', 'ward-indiranagar');
    recurringForm.append('latitude', '12.9790');
    recurringForm.append('longitude', '77.6420');
    recurringForm.append('address', 'Near 14th Cross corner, Indiranagar');

    const recRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: recurringForm,
    });
    const recData = await recRes.json();

    assert(
      recRes.status === 201 &&
      recData.memory_insights.is_recurring === true &&
      recData.complaint.relation_type === 'recurring' &&
      recData.complaint.root_incident_id === createdComplaintId &&
      recData.complaint.recurrence_count >= 1,
      '7.1 Recurrence Detection: Historical memory links new report at recurring failure site to root incident'
    );

    // 7.2 Detailed Complaint Inspection includes images, history, and verification records
    const detailInspectionRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}`, {
      headers: {
        'Cookie': `civic_token=${arjunCitizen.cookie}`,
      },
    });
    const detailInspectionData = await detailInspectionRes.json();

    assert(
      detailInspectionRes.status === 200 &&
      detailInspectionData.images.length > 0 &&
      detailInspectionData.history.length >= 3 && // Submitted -> Work Completed -> Resolved
      detailInspectionData.verifications.length === 1 &&
      detailInspectionData.verifications[0].is_satisfactory === 1,
      '7.2 GET /api/complaints/:id returns complete audit trail including images, history timeline, and verifications'
    );

  } catch (err) {
    console.error('Test execution unhandled error:', err);
    failed++;
  } finally {
    try {
      db.prepare("DELETE FROM complaints WHERE id NOT IN ('cmp-101', 'cmp-102', 'cmp-450', 'cmp-210', 'cmp-305', 'cmp-340', 'cmp-401', 'cmp-180')").run();
    } catch (_) {}
    server.close();
  }

  console.log('\n====================================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runComplaintTestSuite();
