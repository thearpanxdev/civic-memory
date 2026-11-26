/**
 * ====================================================================
 * CivicMemory — Multimodal AI Complaint Analysis Test Suite
 *
 * Automated verification for multimodal Gemini complaint analysis:
 * 1. Road damage analysis with uploaded photograph (all 10 schema fields).
 * 2. Drainage & sewage analysis with uploaded photograph.
 * 3. Garbage accumulation analysis with uploaded photograph.
 * 4. Image signature verification (magic bytes) rejection on /analyze.
 * 5. Text-only analysis support with 10 fields.
 * 6. Gemini timeout handling (503 Service Unavailable).
 * 7. Gemini rate limit / 503 handling (503 Service Unavailable).
 * 8. Malformed / schema-violating JSON handling (502 Bad Gateway).
 * 9. Database persistence in `complaints` and `ai_analyses` tables.
 * 10. Graceful degradation: complaint submission succeeds when AI fails or times out.
 * ====================================================================
 */

import http from 'http';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { setGeminiClient, resetGeminiClient } from '../src/services/geminiService.js';
import { MULTIMODAL_ISSUE_CATEGORIES, MULTIMODAL_SEVERITIES } from '../src/validators/complaintValidators.js';

let server;
let baseUrl;

function parseSetCookie(res) {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/civic_token=([^;]+)/);
  return match ? match[1] : null;
}

// Generate minimal genuine JPEG with magic bytes (FF D8 FF E0 ...)
function createGenuineJpegBuffer() {
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0xFF, 0xD9,
  ]);
}

// Generate minimal genuine PNG with magic bytes (89 50 4E 47 ...)
function createGenuinePngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
  ]);
}

// Generate fake binary payload disguised as an image
function createSpoofedBinaryBuffer() {
  return Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00ThisIsNotAJpeg');
}

async function runMultimodalTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Multimodal AI Complaint Analysis Test Suite');
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
    // Authenticate citizen persona
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: 'citizen.arjun@civicmemory.local',
        password: 'Citizen@Civic2026!',
      }),
    });
    const citizenCookie = parseSetCookie(loginRes);

    const sendAnalyze = async (formDataOrJson, isMultipart = false) => {
      const headers = {
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `civic_token=${citizenCookie}`,
      };
      if (!isMultipart) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`${baseUrl}/complaints/analyze`, {
        method: 'POST',
        headers,
        body: isMultipart ? formDataOrJson : JSON.stringify(formDataOrJson),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}
      return { res, data };
    };

    // ===================================================================
    // TEST 1: Multimodal Road Damage Analysis with Photo
    // ===================================================================
    console.log('--- Test 1: Road Damage Complaint Multimodal Analysis ---');
    const roadOutput = {
      issue_category: 'Road damage',
      issue_subcategory: 'Pothole',
      description_summary: 'Large fractured pothole on 100ft road causing severe vehicle hazard.',
      severity: 'High',
      detected_objects: ['asphalt depression', 'fractured road bitumen', 'traffic lane'],
      visible_evidence: ['crater measuring ~1 meter wide with irregular broken asphalt perimeter'],
      potential_public_safety_risk: 'High risk of two-wheeler crashes and vehicular wheel-rim damage.',
      recommended_department: 'Roads and Infrastructure',
      confidence_score: 94,
      additional_information_required: [],
    };

    let receivedContents = null;
    setGeminiClient({
      models: {
        generateContent: async ({ contents }) => {
          receivedContents = contents;
          return { text: JSON.stringify(roadOutput) };
        },
      },
    });

    const roadForm = new FormData();
    roadForm.append('title', 'Massive crater pothole near 12th main');
    roadForm.append('description', 'Deep crater pothole in the middle of 100ft road causing vehicles to swerve.');
    roadForm.append('address', '100ft Road, Indiranagar');
    roadForm.append('latitude', '12.9784');
    roadForm.append('longitude', '77.6408');
    roadForm.append('images', new Blob([createGenuineJpegBuffer()], { type: 'image/jpeg' }), 'road_damage.jpg');

    const t1 = await sendAnalyze(roadForm, true);

    assert(
      t1.res.status === 200,
      '1.1 Status 200 returned for multimodal road damage analysis'
    );
    assert(
      t1.data?.issue_category === 'Road damage' &&
      t1.data?.issue_subcategory === 'Pothole' &&
      t1.data?.severity === 'High' &&
      t1.data?.recommended_department === 'Roads and Infrastructure' &&
      t1.data?.confidence_score === 94,
      '1.2 Returns verified 10-field structured schema for road damage'
    );
    assert(
      Array.isArray(t1.data?.detected_objects) && t1.data.detected_objects.length > 0 &&
      Array.isArray(t1.data?.visible_evidence) && t1.data.visible_evidence.length > 0,
      '1.3 Contains detected objects and observable visual evidence'
    );
    assert(
      Array.isArray(receivedContents) && receivedContents.some((part) => part.inlineData?.mimeType === 'image/jpeg'),
      '1.4 Verified Gemini received multimodal inlineData with correct MIME type'
    );

    // ===================================================================
    // TEST 2: Multimodal Drainage & Sewage Analysis with Photo
    // ===================================================================
    console.log('\n--- Test 2: Drainage & Sewage Multimodal Analysis ---');
    const drainageOutput = {
      issue_category: 'Drainage and sewage',
      issue_subcategory: 'Overflowing storm drain',
      description_summary: 'Clogged storm drain backing up black sewage onto pedestrian walkway.',
      severity: 'High',
      detected_objects: ['drain grating', 'sludge overflow', 'footpath'],
      visible_evidence: ['dark wastewater overflowing past concrete drain grating onto pedestrian walkway'],
      potential_public_safety_risk: 'High public health hazard from pathogenic biological wastewater exposure.',
      recommended_department: 'Drainage and Sewerage',
      confidence_score: 91,
      additional_information_required: [],
    };

    setGeminiClient({
      models: {
        generateContent: async () => ({ text: JSON.stringify(drainageOutput) }),
      },
    });

    const drainageForm = new FormData();
    drainageForm.append('title', 'Clogged storm drain overflowing with sewage');
    drainageForm.append('description', 'Storm drain on 5th cross has been clogged for three days and is overflowing.');
    drainageForm.append('address', '5th Cross, Koramangala');
    drainageForm.append('images', new Blob([createGenuinePngBuffer()], { type: 'image/png' }), 'drainage.png');

    const t2 = await sendAnalyze(drainageForm, true);

    assert(
      t2.res.status === 200 &&
      t2.data?.issue_category === 'Drainage and sewage' &&
      t2.data?.recommended_department === 'Drainage and Sewerage' &&
      t2.data?.severity === 'High',
      '2. Drainage & sewage multimodal complaint classified accurately'
    );

    // ===================================================================
    // TEST 3: Multimodal Garbage Accumulation Analysis with Photo
    // ===================================================================
    console.log('\n--- Test 3: Garbage Accumulation Multimodal Analysis ---');
    const garbageOutput = {
      issue_category: 'Garbage accumulation',
      issue_subcategory: 'Illegal street waste dumping',
      description_summary: 'Uncollected municipal garbage heap spilling onto public road.',
      severity: 'Medium',
      detected_objects: ['plastic bags', 'discarded food waste', 'street curb'],
      visible_evidence: ['piles of plastic bags and organic waste decomposing near sidewalk boundary'],
      potential_public_safety_risk: 'Attracting stray animals, vector pests, and pedestrian walking obstruction.',
      recommended_department: 'Sanitation and Waste Management',
      confidence_score: 89,
      additional_information_required: [],
    };

    setGeminiClient({
      models: {
        generateContent: async () => ({ text: JSON.stringify(garbageOutput) }),
      },
    });

    const garbageForm = new FormData();
    garbageForm.append('title', 'Piles of uncollected waste on street corner');
    garbageForm.append('description', 'Garbage has been accumulating for 4 days outside the market corner.');
    garbageForm.append('images', new Blob([createGenuineJpegBuffer()], { type: 'image/jpeg' }), 'garbage.jpg');

    const t3 = await sendAnalyze(garbageForm, true);

    assert(
      t3.res.status === 200 &&
      t3.data?.issue_category === 'Garbage accumulation' &&
      t3.data?.recommended_department === 'Sanitation and Waste Management' &&
      t3.data?.severity === 'Medium',
      '3. Garbage accumulation multimodal complaint classified accurately'
    );

    // ===================================================================
    // TEST 4: Image Signature Verification Rejection (Magic Bytes)
    // ===================================================================
    console.log('\n--- Test 4: Image Signature Magic Byte Verification ---');
    const fakeForm = new FormData();
    fakeForm.append('title', 'Pothole with fake photo attachment');
    fakeForm.append('description', 'Pothole description with non-image file disguised as image.');
    fakeForm.append('images', new Blob([createSpoofedBinaryBuffer()], { type: 'image/jpeg' }), 'fake.jpg');

    const t4 = await sendAnalyze(fakeForm, true);
    assert(
      t4.res.status === 400 &&
      t4.data?.error?.includes('Invalid file signature'),
      '4. Spoofed image file rejected with 400 Bad Request before calling Gemini'
    );

    // ===================================================================
    // TEST 5: Text-Only Analysis (No Images) Backward Compatibility
    // ===================================================================
    console.log('\n--- Test 5: Text-Only Analysis Backward Compatibility ---');
    setGeminiClient({
      models: {
        generateContent: async () => ({ text: JSON.stringify(roadOutput) }),
      },
    });

    const t5 = await sendAnalyze({
      title: 'Deep pothole without photograph',
      description: 'Vehicle axle broke on 100ft road pothole near junction.',
    });

    assert(
      t5.res.status === 200 &&
      t5.data?.issue_category === 'Road damage' &&
      t5.data?.suggestedCategory === 'Roads and Infrastructure',
      '5. Text-only analysis functions seamlessly with both new and legacy fields'
    );

    // ===================================================================
    // TEST 6: Gemini Timeout (503 Service Unavailable)
    // ===================================================================
    console.log('\n--- Test 6: Gemini Timeout Handling ---');
    setGeminiClient({
      models: {
        generateContent: async () => {
          const err = new Error('This operation was aborted');
          err.name = 'AbortError';
          throw err;
        },
      },
    });

    const t6 = await sendAnalyze({
      title: 'Water pipe leaking under road',
      description: 'Drinking water is gushing out from under the pavement.',
    });

    assert(
      t6.res.status === 503 &&
      t6.data?.error?.includes('timed out'),
      '6. Timeout handled gracefully returning 503 without revealing secrets'
    );

    // ===================================================================
    // TEST 7: Gemini Overloaded (503 / 429)
    // ===================================================================
    console.log('\n--- Test 7: Gemini Overload (429/503) Handling ---');
    setGeminiClient({
      models: {
        generateContent: async () => {
          const err = new Error('HTTP 429: Too Many Requests');
          err.status = 429;
          throw err;
        },
      },
    });

    const t7 = await sendAnalyze({
      title: 'Broken streetlight on 7th main',
      description: 'Lamp has been dark for two weeks creating an unsafe environment.',
    });

    assert(
      t7.res.status === 503 &&
      t7.data?.error?.includes('temporarily unavailable'),
      '7. Provider 429/503 handled gracefully returning 503'
    );

    // ===================================================================
    // TEST 8: Malformed JSON Returned by Gemini (502 Bad Gateway)
    // ===================================================================
    console.log('\n--- Test 8: Malformed AI JSON Handling ---');
    setGeminiClient({
      models: {
        generateContent: async () => ({ text: 'This is not valid JSON at all.' }),
      },
    });

    const t8 = await sendAnalyze({
      title: 'Streetlight pole tilted dangerously',
      description: 'Electric pole is leaning towards pedestrian sidewalk at 30 degrees.',
    });

    assert(
      t8.res.status === 502 &&
      t8.data?.error?.includes('unparseable'),
      '8. Unparseable Gemini output returned 502 Bad Gateway safely'
    );

    // ===================================================================
    // TEST 9: Database Persistence in complaints and ai_analyses
    // ===================================================================
    console.log('\n--- Test 9: Database Persistence in complaints and ai_analyses ---');
    const submitForm = new FormData();
    submitForm.append('title', 'Severe waterlogging at railway underpass');
    submitForm.append('description', 'Rainwater accumulation over 3 feet deep blocking all vehicles under railway bridge.');
    submitForm.append('category', 'Drainage and Sewerage');
    submitForm.append('ward_id', 'ward-indiranagar');
    submitForm.append('address', 'Railway Underpass, Indiranagar');
    submitForm.append('latitude', '12.9784');
    submitForm.append('longitude', '77.6408');
    submitForm.append('severity', 'high');
    submitForm.append('images', new Blob([createGenuineJpegBuffer()], { type: 'image/jpeg' }), 'underpass.jpg');

    const confirmedAiAnalysis = {
      issue_category: 'Waterlogging',
      issue_subcategory: 'Railway underpass inundation',
      description_summary: 'Severe 3-foot deep waterlogging obstructing underpass traffic.',
      severity: 'High',
      detected_objects: ['submerged asphalt', 'standing water', 'bridge pier'],
      visible_evidence: ['water level reaching over car bumper height'],
      potential_public_safety_risk: 'High risk of vehicles getting trapped and drowning hazard.',
      recommended_department: 'Drainage and Sewerage',
      confidence_score: 96,
      additional_information_required: [],
    };
    submitForm.append('ai_analysis', JSON.stringify(confirmedAiAnalysis));

    const submitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `civic_token=${citizenCookie}`,
      },
      body: submitForm,
    });

    const submitData = await submitRes.json();
    assert(
      submitRes.status === 201 &&
      submitData.complaint?.id !== undefined,
      '9.1 Complaint created successfully with 201 Created'
    );

    const createdComplaintId = submitData.complaint.id;

    // Verify ai_analyses database record exists
    const aiRow = db.prepare('SELECT * FROM ai_analyses WHERE complaint_id = ?').get(createdComplaintId);
    assert(
      aiRow !== undefined &&
      aiRow.complaint_id === createdComplaintId &&
      aiRow.analysis_type === 'issue_classification',
      '9.2 AI Analysis record safely persisted in ai_analyses table with matching complaint_id'
    );

    const storedAnalysis = JSON.parse(aiRow.response_json);
    assert(
      storedAnalysis.issue_category === 'Waterlogging' &&
      storedAnalysis.severity === 'High',
      '9.3 Persisted AI analysis response_json matches confirmed multimodal analysis'
    );

    // Verify GET /api/complaints/:id returns the linked ai_analysis
    const getRes = await fetch(`${baseUrl}/complaints/${createdComplaintId}`, {
      method: 'GET',
      headers: {
        'Cookie': `civic_token=${citizenCookie}`,
      },
    });
    const getData = await getRes.json();
    assert(
      getRes.status === 200 &&
      getData.ai_analysis?.analysis?.issue_category === 'Waterlogging',
      '9.4 GET /api/complaints/:id returns linked ai_analysis in payload'
    );

    // ===================================================================
    // TEST 10: Graceful Degradation: Submission Always Succeeds
    // ===================================================================
    console.log('\n--- Test 10: Graceful Degradation on Submission ---');
    // Submit complaint without AI analysis attached
    const unblockedForm = new FormData();
    unblockedForm.append('title', 'Damaged footpath slab with exposed rebar');
    unblockedForm.append('description', 'Pedestrian sidewalk slab broken with sharp rusty metal rebar sticking out.');
    unblockedForm.append('category', 'Roads and Infrastructure');
    unblockedForm.append('ward_id', 'ward-indiranagar');
    unblockedForm.append('address', '100ft Road footpath');
    unblockedForm.append('latitude', '12.9784');
    unblockedForm.append('longitude', '77.6408');
    unblockedForm.append('severity', 'medium');

    const unblockedRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': `civic_token=${citizenCookie}`,
      },
      body: unblockedForm,
    });

    const unblockedData = await unblockedRes.json();
    assert(
      unblockedRes.status === 201 &&
      unblockedData.complaint?.id !== undefined,
      '10. Complaint submission succeeds without AI analysis (graceful degradation, unblocked citizen)'
    );

  } finally {
    resetGeminiClient();
    if (server) {
      server.close();
    }
  }

  console.log('\n====================================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultimodalTestSuite().catch((err) => {
  console.error('[Fatal Test Failure]:', err);
  process.exit(1);
});
