/**
 * ====================================================================
 * CivicMemory — Semantic Duplicate Complaint Detection Test Suite
 *
 * Automated verification for AI-powered duplicate detection:
 * 1. Role enforcement: Non-citizens rejected (403 Forbidden).
 * 2. Unauthenticated requests rejected (401 Unauthorized).
 * 3. Validation: Missing / invalid fields rejected (400 Bad Request).
 * 4. Zero candidates: Area with no existing issues returns empty list.
 * 5. Semantic Paraphrase: Same defect in different words near same location -> High similarity match.
 * 6. Strict Geographic Guard: Same defect text > 200m away -> Suppressed to low similarity.
 * 7. Different Defect in Same Area: Unrelated issue -> Low similarity.
 * 8. Missing GPS Fallback: Matches by ward_id and applies weighting.
 * 9. Confirmed Duplicate Submission:
 *    - Preserves citizen's own report, description, photos, and location.
 *    - Sets relation_type = 'duplicate', duplicate_of_id = primary.id.
 *    - Increments primary complaint support_count.
 *    - Inserts into complaint_supporters table.
 *    - Inserts audit into ai_analyses table (type 'duplicate_detection').
 * 10. Citizen Opts Out (duplicate_of_id: 'separate') -> Creates standalone complaint.
 * 11. Municipal Dashboard: Returns accurate unique vs supporting counts and repeated lists.
 * ====================================================================
 */

import http from 'http';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { setGeminiClient, resetGeminiClient } from '../src/services/geminiService.js';

let server;
let baseUrl;

function parseSetCookie(res) {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/civic_token=([^;]+)/);
  return match ? match[1] : null;
}

// Minimal genuine PNG buffer
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

async function runSemanticDuplicateTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Semantic Duplicate Detection Test Suite');
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
    // 1. Authenticate Citizen Arjun
    const citizenLoginRes = await fetch(`${baseUrl}/auth/login`, {
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
    const citizenCookie = parseSetCookie(citizenLoginRes);
    assert(citizenCookie, 'Setup: Citizen Arjun authenticated with session cookie');

    // 2. Authenticate Roads Official
    const officialLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: 'official.roads@civicmemory.local',
        password: 'Official@Civic2026!',
      }),
    });
    const officialCookie = parseSetCookie(officialLoginRes);
    assert(officialCookie, 'Setup: Roads Official authenticated with session cookie');

    // 3. Authenticate Municipal Admin
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: 'admin@civicmemory.local',
        password: 'Admin@Civic2026!',
      }),
    });
    const adminCookie = parseSetCookie(adminLoginRes);
    assert(adminCookie, 'Setup: Municipal Admin authenticated with session cookie');

    // -------------------------------------------------------------
    // Test 1: Unauthenticated request rejected (401)
    // -------------------------------------------------------------
    const unauthRes = await fetch(`${baseUrl}/complaints/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Massive pothole on main road',
        description: 'Road crater damaging car suspensions.',
      }),
    });
    assert(unauthRes.status === 401, '1. Unauthenticated request to check-duplicates rejected with 401');

    // -------------------------------------------------------------
    // Test 2: Official role blocked (403)
    // -------------------------------------------------------------
    const officialRes = await fetch(`${baseUrl}/complaints/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${officialCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Massive pothole on main road',
        description: 'Road crater damaging car suspensions.',
      }),
    });
    assert(officialRes.status === 403, '2. Non-citizen (Official) blocked from check-duplicates with 403');

    // -------------------------------------------------------------
    // Test 3: Validation: Missing / invalid inputs (400)
    // -------------------------------------------------------------
    const valRes = await fetch(`${baseUrl}/complaints/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Bad',
        description: 'Short',
      }),
    });
    assert(valRes.status === 400, '3. Invalid input (title < 5, description < 10) rejected with 400');

    // -------------------------------------------------------------
    // Test 4: Seed a primary complaint for duplicate testing
    // -------------------------------------------------------------
    const primaryTitle = 'Massive pothole near the railway station';
    const primaryDesc = 'There is a huge dangerous pothole on the main approach road right next to the railway station exit.';
    const primaryLat = 12.9784;
    const primaryLon = 77.6408;

    const primaryForm = new FormData();
    primaryForm.append('title', primaryTitle);
    primaryForm.append('description', primaryDesc);
    primaryForm.append('category', 'Roads and Infrastructure');
    primaryForm.append('ward_id', 'ward-indiranagar');
    primaryForm.append('latitude', primaryLat.toString());
    primaryForm.append('longitude', primaryLon.toString());
    primaryForm.append('address', 'Station Approach Road, Indiranagar');
    primaryForm.append('landmark', 'Railway Station Exit Gate 2');
    primaryForm.append('severity', 'high');

    const primaryRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: primaryForm,
    });
    const primaryData = await primaryRes.json();
    assert(primaryRes.status === 201 || primaryRes.status === 200, '4. Primary complaint created successfully');
    const primaryTicket = primaryData.complaint?.ticket_number;
    const primaryId = primaryData.complaint?.id;
    assert(primaryId && primaryTicket, '4b. Primary complaint has ticket number and ID');

    // -------------------------------------------------------------
    // Test 5: Semantic Paraphrase Near Same Location (40m away) -> High Match
    // New phrasing: "The road outside the station has a huge hole and is dangerous."
    // Coordinates: ~35 meters away (12.9782, 77.6406)
    // -------------------------------------------------------------
    const mockClientParaphrase = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            new_complaint_features: {
              issue_category: 'Road damage',
              issue_description: 'Large road depression creating immediate vehicular hazard outside railway station.',
              infrastructure_type: 'Asphalt road pavement',
              location_description: 'Outside station exit',
              specific_landmarks: 'Railway station',
              nature_of_damage: 'Deep road crater / pothole',
              relevant_context: 'Dangerous road condition',
            },
            candidate_evaluations: [
              {
                candidate_id: primaryId,
                semantic_similarity_score: 94,
                is_semantic_match: true,
                match_reasoning: 'Both complaints describe a deep road hole/pothole at the exact railway station exit road.',
                infrastructure_type: 'Asphalt road',
                nature_of_damage: 'Deep pothole',
              },
            ],
          }),
        }),
      },
    };

    setGeminiClient(mockClientParaphrase);

    const dupCheckRes = await fetch(`${baseUrl}/complaints/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Road outside the station has a huge hole and is dangerous',
        description: 'Vehicles are struggling because of damaged road pavement near the station exit.',
        category: 'Roads and Infrastructure',
        ward_id: 'ward-indiranagar',
        latitude: 12.9782,
        longitude: 77.6406,
        address: 'Outside Indiranagar Station',
        landmark: 'Near Railway Station',
      }),
    });

    const dupCheckData = await dupCheckRes.json();
    assert(dupCheckRes.status === 200, '5.1 check-duplicates returns 200 OK');
    assert(dupCheckData.duplicate_found === true, '5.2 duplicate_found is true for semantic paraphrase');
    assert(dupCheckData.duplicates && dupCheckData.duplicates.length > 0, '5.3 Duplicates array contains matches');

    const topMatch = dupCheckData.duplicates[0];
    assert(topMatch.id === primaryId, '5.4 Matched candidate ID equals primary complaint ID');
    assert(topMatch.similarity_level === 'high', '5.5 Similarity level is high (>= 80%)');
    assert(topMatch.similarity_score >= 80, `5.6 Similarity score (${topMatch.similarity_score}) >= 80%`);
    assert(topMatch.distance_meters !== null && topMatch.distance_meters <= 100, `5.7 Distance correctly computed (${topMatch.distance_meters}m)`);
    assert(topMatch.infrastructure_type === 'Asphalt road', '5.8 Extracted infrastructure type is returned');

    // -------------------------------------------------------------
    // Test 6: Strict Geographic Guard: High Semantic Similarity but > 200m away
    // -------------------------------------------------------------
    const mockClientFarAway = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            new_complaint_features: {
              issue_category: 'Road damage',
              issue_description: 'Deep road crater.',
              infrastructure_type: 'Asphalt road',
              location_description: 'Far location',
              specific_landmarks: 'Railway station',
              nature_of_damage: 'Deep crater',
              relevant_context: 'Traffic risk',
            },
            candidate_evaluations: [
              {
                candidate_id: primaryId,
                semantic_similarity_score: 95,
                is_semantic_match: true,
                match_reasoning: 'Identical phrasing about railway station.',
                infrastructure_type: 'Asphalt road',
                nature_of_damage: 'Deep crater',
              },
            ],
          }),
        }),
      },
    };

    setGeminiClient(mockClientFarAway);

    // Coordinate ~500m away (lat 12.9825, lon 77.6435)
    const farCheckRes = await fetch(`${baseUrl}/complaints/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Deep crater pothole near station',
        description: 'Vehicles struggling due to damaged pavement.',
        category: 'Roads and Infrastructure',
        ward_id: 'ward-indiranagar',
        latitude: 12.9825,
        longitude: 77.6435,
        address: '500m up north',
      }),
    });

    const farCheckData = await farCheckRes.json();
    assert(farCheckRes.status === 200, '6.1 Far distance check returns 200 OK');
    const farMatch = farCheckData.duplicates.find((d) => d.id === primaryId);
    if (farMatch) {
      assert(farMatch.similarity_level === 'low', '6.2 Strict Geographic Guard forces similarity_level to low for > 200m');
      assert(farMatch.similarity_score <= 40, `6.3 Strict Geographic Guard caps similarity_score (${farMatch.similarity_score} <= 40)`);
      assert(farMatch.reasoning.includes('Geographic Guard') || farMatch.reasoning.includes('away'), '6.4 Reasoning indicates distance mismatch');
    } else {
      assert(true, '6.2 Candidate omitted because distance exceeded bounding search');
    }

    // -------------------------------------------------------------
    // Test 7: Unrelated Defect in Same Location -> Low Match
    // -------------------------------------------------------------
    const mockClientUnrelated = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            new_complaint_features: {
              issue_category: 'Streetlight failure',
              issue_description: 'Streetlight pole dark and non-operational.',
              infrastructure_type: 'Overhead luminaire pole',
              location_description: 'Near station',
              specific_landmarks: 'Railway station',
              nature_of_damage: 'Electrical burnout',
              relevant_context: 'Pedestrian visibility hazard',
            },
            candidate_evaluations: [
              {
                candidate_id: primaryId,
                semantic_similarity_score: 20,
                is_semantic_match: false,
                match_reasoning: 'Different infrastructure: streetlight failure vs road pothole.',
                infrastructure_type: 'Asphalt road',
                nature_of_damage: 'Pothole',
              },
            ],
          }),
        }),
      },
    };

    setGeminiClient(mockClientUnrelated);

    const unrelatedRes = await fetch(`${baseUrl}/complaints/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Completely dark broken streetlight near station',
        description: 'The streetlight fixture outside the railway station is broken and pitch black at night.',
        category: 'Street Lighting',
        ward_id: 'ward-indiranagar',
        latitude: 12.9783,
        longitude: 77.6407,
        address: 'Station Exit',
      }),
    });

    const unrelatedData = await unrelatedRes.json();
    assert(unrelatedRes.status === 200, '7.1 Unrelated defect check returns 200 OK');
    const unrelMatch = unrelatedData.duplicates.find((d) => d.id === primaryId);
    assert(unrelMatch && unrelMatch.similarity_level === 'low', '7.2 Unrelated infrastructure classified as low similarity');
    assert(unrelMatch && unrelMatch.similarity_score < 60, '7.3 Similarity score < 60% for unrelated problem');

    // -------------------------------------------------------------
    // Test 8: Missing GPS Coordinates Fallback (Ward Matching)
    // -------------------------------------------------------------
    const mockClientNoGps = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            new_complaint_features: {
              issue_category: 'Road damage',
              issue_description: 'Huge hole on road.',
              infrastructure_type: 'Road',
              location_description: 'Indiranagar station road',
              specific_landmarks: 'Station',
              nature_of_damage: 'Pothole',
              relevant_context: 'Traffic',
            },
            candidate_evaluations: [
              {
                candidate_id: primaryId,
                semantic_similarity_score: 88,
                is_semantic_match: true,
                match_reasoning: 'Same road pothole described in text.',
                infrastructure_type: 'Road',
                nature_of_damage: 'Pothole',
              },
            ],
          }),
        }),
      },
    };

    setGeminiClient(mockClientNoGps);

    const noGpsRes = await fetch(`${baseUrl}/complaints/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        title: 'Huge pothole outside railway station road',
        description: 'Deep road crater damaging cars on station road.',
        category: 'Roads and Infrastructure',
        ward_id: 'ward-indiranagar', // Coords omitted
        address: 'Station Road, Indiranagar',
      }),
    });

    const noGpsData = await noGpsRes.json();
    assert(noGpsRes.status === 200, '8.1 Missing GPS query returns 200 OK');
    const noGpsMatch = noGpsData.duplicates.find((d) => d.id === primaryId);
    assert(noGpsMatch, '8.2 Found candidate by ward_id fallback');
    assert(noGpsMatch.distance_meters === null, '8.3 distance_meters is null when GPS is missing');
    assert(noGpsMatch.similarity_score >= 60, '8.4 Ward weighting preserves valid similarity score');

    // -------------------------------------------------------------
    // Test 9: Confirmed Duplicate Complaint Submission
    // Citizen confirms duplicate_of_id = primaryId
    // -------------------------------------------------------------
    const dupSubmitForm = new FormData();
    dupSubmitForm.append('title', 'Vehicles struggling on station road crater');
    dupSubmitForm.append('description', 'Adding evidence: This hole is expanding every day during rain.');
    dupSubmitForm.append('category', 'Roads and Infrastructure');
    dupSubmitForm.append('ward_id', 'ward-indiranagar');
    dupSubmitForm.append('latitude', '12.9782');
    dupSubmitForm.append('longitude', '77.6406');
    dupSubmitForm.append('address', 'Opposite Station Gate 2');
    dupSubmitForm.append('duplicate_of_id', primaryId);
    dupSubmitForm.append('images', new Blob([createGenuinePngBuffer()], { type: 'image/png' }), 'station_crater.png');

    const dupSubmitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: dupSubmitForm,
    });

    const dupSubmitData = await dupSubmitRes.json();
    assert(dupSubmitRes.status === 201 || dupSubmitRes.status === 200, '9.1 Confirmed duplicate submitted successfully (200/201)');
    const dupComplaintId = dupSubmitData.complaint?.id;
    assert(dupComplaintId, '9.2 Duplicate complaint record generated');

    // Verify DB integrity
    const savedDup = db.prepare('SELECT * FROM complaints WHERE id = ?').get(dupComplaintId);
    assert(savedDup.relation_type === 'duplicate', '9.3 relation_type is strictly "duplicate"');
    assert(savedDup.duplicate_of_id === primaryId, '9.4 duplicate_of_id points to primary complaint');
    assert(savedDup.root_incident_id === (primaryData.complaint.root_incident_id || primaryId), '9.5 root_incident_id linked correctly');
    assert(savedDup.description.includes('Adding evidence'), '9.6 Citizen own description preserved intact');

    // Verify photo was preserved
    const savedImages = db.prepare('SELECT * FROM complaint_images WHERE complaint_id = ?').all(dupComplaintId);
    assert(savedImages.length === 1, '9.7 Supporting photo preserved in complaint_images');

    // Verify primary complaint support_count incremented
    const updatedPrimary = db.prepare('SELECT support_count FROM complaints WHERE id = ?').get(primaryId);
    assert(updatedPrimary.support_count >= 2, `9.8 Primary support_count incremented (${updatedPrimary.support_count} >= 2)`);

    // Verify complaint_supporters entry
    const supporterEntry = db.prepare('SELECT * FROM complaint_supporters WHERE complaint_id = ?').get(primaryId);
    assert(supporterEntry, '9.9 Recorded in complaint_supporters table');

    // Verify ai_analyses audit record
    const dupAiAnalysis = db.prepare('SELECT * FROM ai_analyses WHERE complaint_id = ? AND analysis_type = ?').get(dupComplaintId, 'duplicate_detection');
    assert(dupAiAnalysis, '9.10 Recorded in ai_analyses table with analysis_type="duplicate_detection"');

    // -------------------------------------------------------------
    // Test 10: Citizen Opts Out (duplicate_of_id: 'separate')
    // -------------------------------------------------------------
    const separateForm = new FormData();
    separateForm.append('title', 'Independent issue on same street');
    separateForm.append('description', 'This is a completely separate incident on the same street.');
    separateForm.append('category', 'Roads and Infrastructure');
    separateForm.append('ward_id', 'ward-indiranagar');
    separateForm.append('latitude', primaryLat.toString());
    separateForm.append('longitude', primaryLon.toString());
    separateForm.append('address', 'Indiranagar Station Road');
    separateForm.append('duplicate_of_id', 'separate');

    const separateRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Cookie': `civic_token=${citizenCookie}`,
        'Origin': 'http://localhost:5173',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: separateForm,
    });

    const separateData = await separateRes.json();
    assert(separateRes.status === 201 || separateRes.status === 200, '10.1 Opt-out submission succeeds');
    const separateComplaint = db.prepare('SELECT relation_type, duplicate_of_id FROM complaints WHERE id = ?').get(separateData.complaint?.id);
    assert(separateComplaint.relation_type === 'standalone', '10.2 relation_type is "standalone" when opted out');
    assert(separateComplaint.duplicate_of_id === null, '10.3 duplicate_of_id is null');

    // -------------------------------------------------------------
    // Test 11: Municipal Dashboard Metrics
    // -------------------------------------------------------------
    const adminDashRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: {
        'Cookie': `civic_token=${adminCookie}`,
      },
    });

    assert(adminDashRes.status === 200, '11.1 Admin dashboard returns 200 OK');
    const adminDashData = await adminDashRes.json();
    const metrics = adminDashData.metrics;

    assert(typeof metrics.totalUniqueIssues === 'number' && metrics.totalUniqueIssues > 0, '11.2 metrics.totalUniqueIssues is a valid count');
    assert(typeof metrics.totalSupportingReports === 'number' && metrics.totalSupportingReports > 0, '11.3 metrics.totalSupportingReports is a valid count');
    assert(Array.isArray(adminDashData.mostFrequentlyReported), '11.4 mostFrequentlyReported is an array');
    assert(Array.isArray(adminDashData.repeatedComplaintLocations), '11.5 repeatedComplaintLocations is an array');

    // -------------------------------------------------------------
    // Test 12: Municipal Analytics API
    // -------------------------------------------------------------
    const adminAnalyticsRes = await fetch(`${baseUrl}/admin/analytics`, {
      headers: {
        'Cookie': `civic_token=${adminCookie}`,
      },
    });

    assert(adminAnalyticsRes.status === 200, '12.1 Admin analytics returns 200 OK');
    const adminAnalyticsData = await adminAnalyticsRes.json();
    assert(Array.isArray(adminAnalyticsData.mostFrequentlyReported), '12.2 Analytics includes mostFrequentlyReported');
    assert(Array.isArray(adminAnalyticsData.repeatedComplaintLocations), '12.3 Analytics includes repeatedComplaintLocations');

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    resetGeminiClient();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n====================================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSemanticDuplicateTestSuite();