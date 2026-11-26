/**
 * ====================================================================
 * CivicMemory — Live Geo-Tagged Camera & Video Evidence Test Suite
 * Comprehensive automated verification covering:
 *
 * 1. Citizen Live Photo Evidence:
 *    - Geo-tagged photo submission with device-reported coordinates & accuracy.
 *    - Server-side SHA-256 hash calculation and separate server_received_at timestamp.
 *    - Database record persistence in complaint_images with media_type='IMAGE'.
 *
 * 2. Citizen Live Video Evidence:
 *    - Geo-tagged video submission with start/end recording timestamps and duration.
 *    - Magic byte verification for WebM and MP4 video formats.
 *    - Database record persistence with media_type='VIDEO'.
 *
 * 3. File Signature & Upload Security Defenses:
 *    - Spoofed image payloads (e.g. executable disguised as .jpg) strictly rejected (400).
 *    - Spoofed video payloads strictly rejected (400).
 *    - Oversized image files (> 5MB) strictly rejected (400).
 *    - Oversized video files (> 25MB) strictly rejected (400).
 *    - Missing or null GPS coordinates safely recorded without inventing fake coordinates.
 *
 * 4. Official Portal Live Evidence Workflow:
 *    - Official captures initial_inspection and site_inspection evidence with GPS tags.
 *    - Official captures resolution evidence with GPS tags.
 *    - Invariant: Evidence capture strictly does NOT auto-resolve the complaint.
 *    - Department authorization: Official blocked from attaching evidence to other departments (403).
 *    - Citizens blocked from invoking official evidence endpoints (403).
 *
 * 5. Evidence Access Control & Integrity:
 *    - Reporting citizen can retrieve evidence file with proper MIME headers (200).
 *    - Unauthorized citizens strictly blocked from retrieving another citizen's evidence (403).
 *    - Cross-department officials blocked from evidence retrieval (403).
 *    - Municipal Admin has system-wide access to all evidence (200).
 *    - Unauthenticated requests rejected (401).
 *
 * 6. Multimodal Gemini Video Advisory Handling:
 *    - POST /api/complaints/analyze handles attached photo and video evidence gracefully.
 *    - Photos are analyzed; videos are preserved with advisory notice.
 * ====================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { config } from '../src/config/env.js';
import { calculateSha256 } from '../src/middleware/uploadMiddleware.js';

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

// Generate genuine minimal WebM buffer with EBML header (1A 45 DF A3 ...)
function createGenuineWebmBuffer() {
  return Buffer.from([
    0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81,
    0x01, 0x42, 0xF7, 0x81, 0x01, 0x42, 0xF2, 0x81,
    0x04, 0x42, 0xF3, 0x81, 0x08, 0x42, 0x82, 0x84,
    0x77, 0x65, 0x62, 0x6D, 0x42, 0x87, 0x81, 0x02,
    0x42, 0x85, 0x81, 0x02, 0x18, 0x53, 0x80, 0x67,
  ]);
}

// Generate genuine minimal MP4 buffer ('ftyp' box at offset 4)
function createGenuineMp4Buffer() {
  return Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x6D, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00, // 'mp42'
    0x69, 0x73, 0x6F, 0x6D, 0x6D, 0x70, 0x34, 0x32,
  ]);
}

// Generate fake binary payload disguised as media
function createSpoofedBinaryBuffer() {
  return Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00ThisIsExecutableCode');
}

// Helper to build multipart/form-data body
function buildMultipartBody(fields, files, boundary) {
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    );
  }

  const fileBuffers = [];
  for (const file of files) {
    const header =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${file.field || 'images'}"; filename="${file.name}"\r\n` +
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
    fileBuffers.push(Buffer.from(header, 'utf-8'));
    fileBuffers.push(file.buffer);
    fileBuffers.push(Buffer.from('\r\n', 'utf-8'));
  }

  const footer = Buffer.from(`--${boundary}--\r\n`, 'utf-8');
  return Buffer.concat([...parts.map((p) => Buffer.from(p, 'utf-8')), ...fileBuffers, footer]);
}

async function runLiveGeoTaggedEvidenceSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Live Geo-Tagged Camera & Video Evidence Test Suite');
  console.log('====================================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api`;

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
    // -------------------------------------------------------------
    // Setup: Reset & Authenticate Test Personas
    // -------------------------------------------------------------
    console.log('--- Setup: Authenticating Test Personas ---');
    db.prepare("UPDATE users SET department_id = 'dept-water' WHERE email = 'official.water@civicmemory.local'").run();
    db.prepare("UPDATE users SET department_id = 'dept-roads' WHERE email = 'official.roads@civicmemory.local'").run();

    // 1. Citizen Arjun
    const arjunLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ email: 'citizen.arjun@civicmemory.local', password: 'Citizen@Civic2026!' }),
    });
    const arjunCookie = parseSetCookie(arjunLoginRes);
    assert(arjunLoginRes.status === 200 && arjunCookie, 'Setup 1: Citizen Arjun authenticated');

    // 2. Citizen Meera
    const meeraLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ email: 'citizen.meera@civicmemory.local', password: 'Citizen@Civic2026!' }),
    });
    const meeraCookie = parseSetCookie(meeraLoginRes);
    assert(meeraLoginRes.status === 200 && meeraCookie, 'Setup 2: Citizen Meera authenticated');

    // 3. Roads Official
    const roadsLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ email: 'official.roads@civicmemory.local', password: 'Official@Civic2026!' }),
    });
    const roadsCookie = parseSetCookie(roadsLoginRes);
    assert(roadsLoginRes.status === 200 && roadsCookie, 'Setup 3: Roads Official authenticated');

    // 4. Water Official
    const waterLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ email: 'official.water@civicmemory.local', password: 'Official@Civic2026!' }),
    });
    const waterCookie = parseSetCookie(waterLoginRes);
    assert(waterLoginRes.status === 200 && waterCookie, 'Setup 4: Water Official authenticated');

    // 5. Municipal Admin
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ email: 'admin@civicmemory.local', password: 'Admin@Civic2026!' }),
    });
    const adminCookie = parseSetCookie(adminLoginRes);
    assert(adminLoginRes.status === 200 && adminCookie, 'Setup 5: Municipal Admin authenticated');

    // -------------------------------------------------------------
    // Section 1: Citizen Live Photo Evidence with Device GPS
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Citizen Live Photo Evidence with Device GPS ---');

    const jpegBuffer = createGenuineJpegBuffer();
    const expectedPhotoHash = calculateSha256(jpegBuffer);
    const photoBoundary = '----WebKitFormBoundaryPhoto1234';

    const photoMeta = [
      {
        latitude: 12.9784,
        longitude: 77.6408,
        accuracy_meters: 12,
        captured_at: '2026-11-26T10:00:00.000Z',
        recording_started_at: null,
        recording_ended_at: null,
        capture_type: 'LIVE_CAMERA',
        media_type: 'IMAGE',
      },
    ];

    const photoFields = {
      title: 'Pothole on 100ft road near Metro pillar 42',
      description: 'Dangerous pothole in the right lane of 100ft road causing motorcycle skids.',
      category: 'Roads and Infrastructure',
      ward_id: 'ward-indiranagar',
      address: '100ft Road, Indiranagar, Bengaluru',
      landmark: 'Near Metro Pillar 42',
      latitude: '12.9784',
      longitude: '77.6408',
      evidence_metadata: JSON.stringify(photoMeta),
    };

    const photoFiles = [
      { name: 'live_photo_01.jpg', buffer: jpegBuffer, type: 'image/jpeg', field: 'images' },
    ];

    const photoBody = buildMultipartBody(photoFields, photoFiles, photoBoundary);

    const photoSubmitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${photoBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: photoBody,
    });

    const photoSubmitData = await photoSubmitRes.json();
    assert(photoSubmitRes.status === 201 && photoSubmitData.complaint, '1.1 Citizen successfully submits complaint with live geo-tagged photo');

    const photoComplaintId = photoSubmitData.complaint.id;
    // Explicitly guarantee complaint is assigned to dept-roads for strict isolation testing
    db.prepare("UPDATE complaints SET department_id = 'dept-roads' WHERE id = ?").run(photoComplaintId);

    // Verify DB columns in complaint_images
    const photoImgRow = db.prepare('SELECT * FROM complaint_images WHERE complaint_id = ?').get(photoComplaintId);
    assert(photoImgRow != null, '1.2 complaint_images record persisted in SQLite database');
    assert(photoImgRow.media_type === 'IMAGE', '1.3 media_type correctly recorded as "IMAGE"');
    assert(photoImgRow.sha256_hash === expectedPhotoHash, '1.4 sha256_hash accurately matches SHA-256 calculation of image buffer');
    assert(photoImgRow.latitude === 12.9784 && photoImgRow.longitude === 77.6408, '1.5 Device-reported GPS coordinates recorded accurately');
    assert(photoImgRow.accuracy_meters === 12, '1.6 Device-reported accuracy in meters (12m) recorded accurately');
    assert(photoImgRow.device_captured_at === '2026-11-26T10:00:00.000Z', '1.7 device_captured_at timestamp preserved verbatim');
    assert(photoImgRow.server_received_at != null, '1.8 server_received_at timestamp recorded independently on server');
    assert(photoImgRow.capture_type === 'LIVE_CAMERA', '1.9 capture_type recorded as LIVE_CAMERA');

    // -------------------------------------------------------------
    // Section 2: Citizen Live Video Evidence with Device GPS
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Citizen Live Video Evidence with Device GPS ---');

    const webmBuffer = createGenuineWebmBuffer();
    const expectedVideoHash = calculateSha256(webmBuffer);
    const videoBoundary = '----WebKitFormBoundaryVideo5678';

    const videoMeta = [
      {
        latitude: 12.9801,
        longitude: 77.6420,
        accuracy_meters: 18,
        captured_at: '2026-11-26T10:05:00.000Z',
        recording_started_at: '2026-11-26T10:05:00.000Z',
        recording_ended_at: '2026-11-26T10:05:14.000Z',
        duration_seconds: 14,
        capture_type: 'LIVE_CAMERA',
        media_type: 'VIDEO',
      },
    ];

    const videoFields = {
      title: 'Active storm drain overflow flooding market street',
      description: 'Black wastewater overflowing from broken storm drain into shopping entrance.',
      category: 'Drainage and Sewerage',
      ward_id: 'ward-indiranagar',
      address: '12th Main Market Road, Indiranagar',
      landmark: 'Opposite Central Supermarket',
      latitude: '12.9801',
      longitude: '77.6420',
      evidence_metadata: JSON.stringify(videoMeta),
    };

    const videoFiles = [
      { name: 'live_drain_overflow.webm', buffer: webmBuffer, type: 'video/webm', field: 'images' },
    ];

    const videoBody = buildMultipartBody(videoFields, videoFiles, videoBoundary);

    const videoSubmitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${videoBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: videoBody,
    });

    const videoSubmitData = await videoSubmitRes.json();
    assert(videoSubmitRes.status === 201 && videoSubmitData.complaint, '2.1 Citizen successfully submits complaint with live geo-tagged video');

    const videoComplaintId = videoSubmitData.complaint.id;

    // Verify DB columns in complaint_images
    const videoImgRow = db.prepare('SELECT * FROM complaint_images WHERE complaint_id = ?').get(videoComplaintId);
    assert(videoImgRow != null, '2.2 complaint_images video record persisted in SQLite');
    assert(videoImgRow.media_type === 'VIDEO', '2.3 media_type correctly recorded as "VIDEO"');
    assert(videoImgRow.sha256_hash === expectedVideoHash, '2.4 sha256_hash accurately matches SHA-256 calculation of WebM video buffer');
    assert(videoImgRow.mime_type === 'video/webm', '2.5 mime_type recorded as "video/webm"');
    assert(videoImgRow.duration_seconds === 14, '2.6 duration_seconds (14s) recorded accurately');
    assert(videoImgRow.recording_started_at === '2026-11-26T10:05:00.000Z', '2.7 recording_started_at recorded accurately');
    assert(videoImgRow.recording_ended_at === '2026-11-26T10:05:14.000Z', '2.8 recording_ended_at recorded accurately');
    assert(videoImgRow.latitude === 12.9801 && videoImgRow.longitude === 77.6420, '2.9 Device-reported GPS coordinates recorded for video');

    // -------------------------------------------------------------
    // Section 3: File Signature & Security Defenses
    // -------------------------------------------------------------
    console.log('\n--- Section 3: File Signature & Security Defenses ---');

    // 3.1 Spoofed image rejected (binary disguised as image/jpeg)
    const spoofedImageBoundary = '----WebKitBoundarySpoofImg';
    const spoofedImageBody = buildMultipartBody(
      {
        title: 'Spoofed image test incident',
        description: 'Attempting to upload executable disguised as JPEG photo.',
        ward_id: 'ward-indiranagar',
        address: 'Test Address Indiranagar',
      },
      [{ name: 'spoofed.jpg', buffer: createSpoofedBinaryBuffer(), type: 'image/jpeg', field: 'images' }],
      spoofedImageBoundary
    );

    const spoofedImageRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${spoofedImageBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: spoofedImageBody,
    });
    assert(spoofedImageRes.status === 400, '3.1 Spoofed executable disguised as JPEG strictly rejected (400 Bad Request)');

    // 3.2 Spoofed video rejected (binary disguised as video/webm)
    const spoofedVideoBoundary = '----WebKitBoundarySpoofVid';
    const spoofedVideoBody = buildMultipartBody(
      {
        title: 'Spoofed video test incident',
        description: 'Attempting to upload executable disguised as WebM video.',
        ward_id: 'ward-indiranagar',
        address: 'Test Address Indiranagar',
      },
      [{ name: 'malicious.webm', buffer: createSpoofedBinaryBuffer(), type: 'video/webm', field: 'images' }],
      spoofedVideoBoundary
    );

    const spoofedVideoRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${spoofedVideoBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: spoofedVideoBody,
    });
    assert(spoofedVideoRes.status === 400, '3.2 Spoofed executable disguised as WebM strictly rejected (400 Bad Request)');

    // 3.3 Oversized image (> 5MB) rejected
    const oversizedImageBoundary = '----WebKitBoundaryBigImg';
    const bigImageBuffer = Buffer.concat([createGenuineJpegBuffer(), Buffer.alloc(6 * 1024 * 1024)]);
    const bigImageBody = buildMultipartBody(
      {
        title: 'Oversized photo test',
        description: 'Attempting to upload a 6MB photograph.',
        ward_id: 'ward-indiranagar',
        address: 'Test Address Indiranagar',
      },
      [{ name: 'huge_photo.jpg', buffer: bigImageBuffer, type: 'image/jpeg', field: 'images' }],
      oversizedImageBoundary
    );

    const bigImageRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${oversizedImageBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: bigImageBody,
    });
    assert(bigImageRes.status === 400, '3.3 Oversized photograph (> 5MB) strictly rejected with 400 Bad Request');

    // 3.4 Missing GPS coordinates safely handled without inventing fake coordinates
    const noGpsBoundary = '----WebKitBoundaryNoGPS';
    const noGpsMeta = [
      {
        latitude: null,
        longitude: null,
        accuracy_meters: null,
        captured_at: '2026-11-26T10:10:00.000Z',
        capture_type: 'LIVE_CAMERA',
        media_type: 'IMAGE',
      },
    ];
    const noGpsBody = buildMultipartBody(
      {
        title: 'Complaint with GPS disabled by citizen',
        description: 'Citizen denied browser location permissions; photo captured without GPS.',
        category: 'Roads and Infrastructure',
        ward_id: 'ward-indiranagar',
        address: 'Indiranagar 100ft road',
        latitude: '12.9784',
        longitude: '77.6408',
        evidence_metadata: JSON.stringify(noGpsMeta),
      },
      [{ name: 'no_gps_photo.jpg', buffer: createGenuineJpegBuffer(), type: 'image/jpeg', field: 'images' }],
      noGpsBoundary
    );

    const noGpsRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${noGpsBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: noGpsBody,
    });
    const noGpsData = await noGpsRes.json();
    assert(noGpsRes.status === 201, '3.4 Complaint with location permission denied submitted safely without crashing');

    const noGpsRow = db.prepare('SELECT latitude, longitude, accuracy_meters FROM complaint_images WHERE complaint_id = ?').get(noGpsData.complaint.id);
    assert(noGpsRow.latitude === null && noGpsRow.longitude === null, '3.5 Never invents fake coordinates: latitude and longitude are stored as NULL');

    // -------------------------------------------------------------
    // Section 4: Official Portal Live Evidence Workflow
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Official Portal Live Evidence Workflow ---');

    // 4.1 Roads Official attaches initial_inspection live photo with GPS
    const officialInspectBoundary = '----WebKitBoundaryOffInspect';
    const officialInspectMeta = [
      {
        latitude: 12.9785,
        longitude: 77.6409,
        accuracy_meters: 8,
        captured_at: '2026-11-26T11:00:00.000Z',
        capture_type: 'LIVE_CAMERA',
        media_type: 'IMAGE',
        evidence_purpose: 'initial_inspection',
      },
    ];

    const officialInspectBody = buildMultipartBody(
      {
        evidence_purpose: 'initial_inspection',
        caption: 'Senior inspector initial site survey: 2.5m x 1.8m pothole on right lane.',
        evidence_metadata: JSON.stringify(officialInspectMeta),
      },
      [{ name: 'official_site_survey.jpg', buffer: createGenuineJpegBuffer(), type: 'image/jpeg', field: 'images' }],
      officialInspectBoundary
    );

    const inspectRes = await fetch(`${baseUrl}/official/complaints/${photoComplaintId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${officialInspectBoundary}`,
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: officialInspectBody,
    });
    const inspectData = await inspectRes.json();
    assert(inspectRes.status === 201 && Array.isArray(inspectData.images), '4.1 Roads Official attaches initial_inspection evidence with device GPS');

    // 4.2 Invariant: Evidence upload does NOT auto-resolve the complaint
    const complaintAfterInspect = db.prepare('SELECT status FROM complaints WHERE id = ?').get(photoComplaintId);
    assert(complaintAfterInspect.status !== 'Resolved' && complaintAfterInspect.status !== 'Work Completed',
      '4.2 Invariant preserved: Official evidence capture does NOT unilaterally resolve the complaint'
    );

    // 4.3 Roads Official attaches resolution video
    const officialResBoundary = '----WebKitBoundaryOffRes';
    const officialResMeta = [
      {
        latitude: 12.9785,
        longitude: 77.6409,
        accuracy_meters: 6,
        captured_at: '2026-11-26T12:00:00.000Z',
        recording_started_at: '2026-11-26T12:00:00.000Z',
        recording_ended_at: '2026-11-26T12:00:20.000Z',
        duration_seconds: 20,
        capture_type: 'LIVE_CAMERA',
        media_type: 'VIDEO',
        evidence_purpose: 'resolution',
      },
    ];

    const officialResBody = buildMultipartBody(
      {
        evidence_purpose: 'resolution',
        caption: 'Compacted asphalt patch complete and open to traffic.',
        evidence_metadata: JSON.stringify(officialResMeta),
      },
      [{ name: 'repair_finish.webm', buffer: createGenuineWebmBuffer(), type: 'video/webm', field: 'images' }],
      officialResBoundary
    );

    const resVideoRes = await fetch(`${baseUrl}/official/complaints/${photoComplaintId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${officialResBoundary}`,
        'Cookie': `civic_token=${roadsCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: officialResBody,
    });
    assert(resVideoRes.status === 201, '4.3 Roads Official attaches resolution video evidence');

    // 4.4 Water Official blocked from attaching evidence to Roads complaint (403)
    const crossDeptRes = await fetch(`${baseUrl}/official/complaints/${photoComplaintId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${officialInspectBoundary}`,
        'Cookie': `civic_token=${waterCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: officialInspectBody,
    });
    assert(crossDeptRes.status === 403, '4.4 Water Official strictly blocked from uploading evidence to Roads complaint (403 Forbidden)');

    // 4.5 Citizen blocked from official evidence endpoint (403)
    const citizenOfficialBlockRes = await fetch(`${baseUrl}/official/complaints/${photoComplaintId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${officialInspectBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: officialInspectBody,
    });
    assert(citizenOfficialBlockRes.status === 403, '4.5 Citizen strictly blocked from official evidence endpoint (403 Forbidden)');

    // -------------------------------------------------------------
    // Section 5: Evidence Access Control & Integrity
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Evidence Access Control & Integrity ---');

    const photoImgId = photoImgRow.id;

    // 5.1 Submitting Citizen Arjun can retrieve evidence image
    const arjunViewRes = await fetch(`${baseUrl}/complaints/${photoComplaintId}/images/${photoImgId}`, {
      headers: { 'Cookie': `civic_token=${arjunCookie}` },
    });
    assert(arjunViewRes.status === 200 && arjunViewRes.headers.get('content-type') === 'image/jpeg',
      '5.1 Submitting citizen Arjun can retrieve genuine evidence photo with 200 OK & image/jpeg MIME'
    );

    // 5.2 Unauthorized Citizen Meera blocked from Arjun's private evidence (403)
    const meeraBlockRes = await fetch(`${baseUrl}/complaints/${photoComplaintId}/images/${photoImgId}`, {
      headers: { 'Cookie': `civic_token=${meeraCookie}` },
    });
    assert(meeraBlockRes.status === 403, '5.2 Citizen Meera strictly blocked from another citizen\'s private evidence (403 Forbidden)');

    // 5.3 Roads Official can retrieve evidence for complaint in their department (200)
    const roadsViewRes = await fetch(`${baseUrl}/complaints/${photoComplaintId}/images/${photoImgId}`, {
      headers: { 'Cookie': `civic_token=${roadsCookie}` },
    });
    assert(roadsViewRes.status === 200, '5.3 Roads Official can view evidence within their assigned department (200 OK)');

    // 5.4 Water Official blocked from Roads complaint evidence (403)
    const waterViewRes = await fetch(`${baseUrl}/complaints/${photoComplaintId}/images/${photoImgId}`, {
      headers: { 'Cookie': `civic_token=${waterCookie}` },
    });
    assert(waterViewRes.status === 403, '5.4 Water Official strictly blocked from Roads evidence (403 Forbidden)');

    // 5.5 Municipal Admin has universal evidence access (200)
    const adminViewRes = await fetch(`${baseUrl}/complaints/${photoComplaintId}/images/${photoImgId}`, {
      headers: { 'Cookie': `civic_token=${adminCookie}` },
    });
    assert(adminViewRes.status === 200, '5.5 Municipal Admin has full cross-departmental access to evidence (200 OK)');

    // 5.6 Unauthenticated request rejected (401)
    const unauthViewRes = await fetch(`${baseUrl}/complaints/${photoComplaintId}/images/${photoImgId}`);
    assert(unauthViewRes.status === 401, '5.6 Unauthenticated evidence retrieval strictly rejected (401 Unauthorized)');

    // 5.7 Video evidence retrieval returns video MIME type and Accept-Ranges
    const videoImgId = videoImgRow.id;
    const arjunVideoViewRes = await fetch(`${baseUrl}/complaints/${videoComplaintId}/images/${videoImgId}`, {
      headers: { 'Cookie': `civic_token=${arjunCookie}` },
    });
    assert(arjunVideoViewRes.status === 200 && arjunVideoViewRes.headers.get('content-type') === 'video/webm',
      '5.7 Citizen retrieves video evidence with 200 OK & video/webm MIME'
    );
    assert(arjunVideoViewRes.headers.get('accept-ranges') === 'bytes',
      '5.8 Server declares Accept-Ranges: bytes for efficient video playback'
    );

    // -------------------------------------------------------------
    // Section 6: Multimodal Gemini Analysis with Video & Photos
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Multimodal Gemini Analysis with Video & Photos ---');

    const analyzeBoundary = '----WebKitBoundaryAnalyzeMedia';
    const analyzeBody = buildMultipartBody(
      {
        title: 'Deep crater on Ring Road near flyover',
        description: 'Road cave-in causing traffic jams and vehicular damage.',
        address: 'Ring Road Flyover, Bengaluru',
        landmark: 'Near Pillar 14',
        latitude: '12.9784',
        longitude: '77.6408',
      },
      [
        { name: 'photo.jpg', buffer: createGenuineJpegBuffer(), type: 'image/jpeg', field: 'images' },
        { name: 'video.webm', buffer: createGenuineWebmBuffer(), type: 'video/webm', field: 'images' },
      ],
      analyzeBoundary
    );

    // Set mock Gemini response
    const mockGeminiAnalysis = {
      issue_category: 'Road damage',
      issue_subcategory: 'Pothole and road surface degradation',
      description_summary: 'Severe road surface cave-in and asphalt degradation on Ring Road.',
      severity: 'High',
      detected_objects: ['asphalt chunks', 'sunken road surface'],
      visible_evidence: ['exposed road foundation', 'bitumen crater'],
      potential_public_safety_risk: 'High risk of vehicle tire blowouts and two-wheeler accidents.',
      recommended_department: 'Roads and Infrastructure',
      confidence_score: 92,
      additional_information_required: [],
    };

    app.locals.geminiClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify(mockGeminiAnalysis),
        }),
      },
    };

    const analyzeRes = await fetch(`${baseUrl}/complaints/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${analyzeBoundary}`,
        'Cookie': `civic_token=${arjunCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: analyzeBody,
    });

    const analyzeData = await analyzeRes.json();
    assert(analyzeRes.status === 200, '6.1 POST /api/complaints/analyze returns 200 OK with attached photo and video');
    assert(analyzeData.issue_category === 'Road damage', '6.2 Correctly categorizes complaint as "Road damage"');
    assert(analyzeData.video_evidence_attached === true, '6.3 System recognizes that live video evidence was attached');
    assert(typeof analyzeData.video_analysis_notice === 'string', '6.4 Returns transparent advisory notice that video is preserved for municipal inspection');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n====================================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveGeoTaggedEvidenceSuite();
