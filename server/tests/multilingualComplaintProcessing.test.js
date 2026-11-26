/**
 * ====================================================================
 * CivicMemory — Multilingual AI Complaint Processing Test Suite
 *
 * Automated verification for:
 * 1. Heuristic Script & Mixed-Language Detection (Bengali, Hindi, Hinglish, Benglish, Tamil, English).
 * 2. Multilingual Prompt Construction & Untrusted Content Isolation.
 * 3. Requirement 4 Structured Output Schema (all 8 mandated fields):
 *    detected_language, original_text, english_translation, issue_category,
 *    issue_summary, severity, recommended_department, translation_confidence.
 * 4. Complaint Analysis API (POST /api/complaints/analyze) with multilingual payload.
 * 5. Citizen Interface & Verbatim Text Preservation:
 *    Original words preserved in description and original_text; never silently overwritten.
 * 6. Multilingual Citizen Notifications (citizen_notifications):
 *    Delivered in citizen's detected/preferred language for:
 *    registration_confirmed, department_assigned, status_changed, work_completed, resolved, reopened.
 * 7. Official Translation Revision (POST /api/official/complaints/:id/revise-translation):
 *    - Manual edit with audit notes, preserving original citizen text verbatim.
 *    - AI regeneration via Gemini.
 *    - RBAC enforcement (Citizen blocked with 403, unauthenticated blocked with 401).
 * 8. Cross-Engine Semantic Duplicate Detection across different languages.
 * 9. Cross-Engine Department Routing based on underlying translated civic defect.
 * ====================================================================
 */

import http from 'http';
import app from '../src/index.js';
import db from '../src/config/database.js';
import {
  setGeminiClient,
  resetGeminiClient,
  analyzeSemanticDuplicates,
  buildSemanticDuplicatePrompt,
} from '../src/services/geminiService.js';
import {
  detectScriptHeuristic,
  buildMultilingualPrompt,
  processMultilingualComplaint,
  createCitizenNotification,
  NOTIFICATION_TEMPLATES,
} from '../src/services/multilingualService.js';
import { classifyAndRouteComplaint } from '../src/services/departmentRoutingService.js';

let server;
let baseUrl;

function parseSetCookie(res) {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/civic_token=([^;]+)/);
  return match ? match[1] : null;
}

function extractPrompt(req) {
  if (typeof req === 'string') return req;
  if (typeof req?.contents === 'string') return req.contents;
  if (Array.isArray(req?.contents)) {
    return req.contents
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.parts) return part.parts.map((p) => p.text || '').join(' ');
        return part?.text || '';
      })
      .join(' ');
  }
  return '';
}

export async function runMultilingualTestSuite() {
  console.log('====================================================================');
  console.log('CivicMemory — Multilingual AI Complaint Processing Test Suite');
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
      console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  const authHeaders = (token) => ({
    Cookie: `civic_token=${token}`,
    Origin: 'http://localhost:5173',
    'X-Requested-With': 'XMLHttpRequest',
  });

  try {
    // ---------------------------------------------------------------
    // 0. User Session Setup
    // ---------------------------------------------------------------
    console.log('--- Phase 0: User Authentication & Persona Setup ---');

    // Citizen Arjun
    const citizenLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'citizen.arjun@civicmemory.local', password: 'Citizen@Civic2026!' }),
    });
    const citizenToken = parseSetCookie(citizenLoginRes);
    assert(citizenLoginRes.status === 200 && citizenToken, 'Citizen logs in successfully');

    // Official Roads
    const roadsLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'official.roads@civicmemory.local', password: 'Official@Civic2026!' }),
    });
    const roadsToken = parseSetCookie(roadsLoginRes);
    assert(roadsLoginRes.status === 200 && roadsToken, 'Roads Official logs in successfully');

    // Official Drainage
    const drainageLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'official.drainage@civicmemory.local', password: 'Official@Civic2026!' }),
    });
    const drainageToken = parseSetCookie(drainageLoginRes);
    assert(drainageLoginRes.status === 200 && drainageToken, 'Drainage Official logs in successfully');

    // ---------------------------------------------------------------
    // 1. Script & Mixed-Language Detection Heuristics
    // ---------------------------------------------------------------
    console.log('\n--- Phase 1: Script & Mixed-Language Detection Heuristics ---');

    const bengaliText = 'আমাদের রাস্তার পাশে অনেক জল জমে আছে এবং নিকাশি ব্যবস্থা খারাপ।';
    const hindiText = 'सड़क पर गहरा गड्ढा है और भारी बारिश के बाद पानी भरा हुआ है।';
    const hinglishText = 'Station ke pass road pe bahut bada pothole hai and accident hone ka risk hai';
    const benglishText = 'Amader parar rastay jal jome ache khub boro gorto';
    const englishText = 'Open manhole cover on main road causing serious traffic hazard';
    const tamilText = 'சாலையில் பெரிய பள்ளம் உள்ளது மற்றும் நீர் தேங்கியுள்ளது';

    assert(detectScriptHeuristic(bengaliText) === 'Bengali', 'Heuristic identifies Bengali script correctly');
    assert(detectScriptHeuristic(hindiText) === 'Hindi', 'Heuristic identifies Devanagari (Hindi) script correctly');
    assert(detectScriptHeuristic(hinglishText) === 'Mixed (Hinglish)', 'Heuristic identifies Hinglish romanized markers');
    assert(detectScriptHeuristic(benglishText) === 'Mixed (Benglish)', 'Heuristic identifies Benglish romanized markers');
    assert(detectScriptHeuristic(englishText) === 'English', 'Heuristic identifies standard English correctly');
    assert(detectScriptHeuristic(tamilText) === 'Tamil', 'Heuristic identifies Tamil script correctly');

    // ---------------------------------------------------------------
    // 2. Multilingual Prompt Construction & Untrusted Isolation
    // ---------------------------------------------------------------
    console.log('\n--- Phase 2: Multilingual Prompt Construction & Schema Requirements ---');

    const promptSample = buildMultilingualPrompt({
      title: 'रास्ते में बड़ा गड्ढा',
      description: 'सड़क पर गहरा गड्ढा है',
      languagePreference: 'hi',
      context: { category: 'Road damage', address: 'MG Road', landmark: 'Near Metro Pillar 42' },
    });

    assert(promptSample.includes('<complaint_title>'), 'Prompt wraps title in XML tags');
    assert(promptSample.includes('<complaint_description>'), 'Prompt wraps description in XML tags');
    assert(promptSample.includes('SECURITY INSTRUCTION'), 'Prompt warns that user content is untrusted');
    assert(promptSample.includes('detected_language'), 'Prompt requires detected_language in output schema');
    assert(promptSample.includes('original_text'), 'Prompt requires original_text in output schema');
    assert(promptSample.includes('english_translation'), 'Prompt requires english_translation in output schema');
    assert(promptSample.includes('issue_category'), 'Prompt requires issue_category in output schema');
    assert(promptSample.includes('issue_summary'), 'Prompt requires issue_summary in output schema');
    assert(promptSample.includes('severity'), 'Prompt requires severity in output schema');
    assert(promptSample.includes('recommended_department'), 'Prompt requires recommended_department in output schema');
    assert(promptSample.includes('translation_confidence'), 'Prompt requires translation_confidence in output schema');

    // ---------------------------------------------------------------
    // 3. Requirement 4: Structured Output Validation with Gemini
    // ---------------------------------------------------------------
    console.log('\n--- Phase 3: Requirement 4 Structured Output & Language Processing ---');

    // Scenario 3A: Bengali Complaint
    const mockBengaliResponse = {
      detected_language: 'Bengali',
      original_text: bengaliText,
      english_translation: 'There is significant waterlogging alongside our road and the drainage system is malfunctioning.',
      issue_category: 'Waterlogging',
      issue_summary: 'Severe road waterlogging and drainage blockage causing public inconvenience.',
      severity: 'High',
      recommended_department: 'Drainage and Sewerage',
      translation_confidence: 96,
    };

    const mockBengaliClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify(mockBengaliResponse),
        }),
      },
    };

    setGeminiClient(mockBengaliClient);

    const bengaliResult = await processMultilingualComplaint({
      title: 'রাস্তায় জল জমা',
      description: bengaliText,
      languagePreference: 'bn',
    });

    assert(bengaliResult.detected_language === 'Bengali', 'Bengali: detected_language is Bengali');
    assert(bengaliResult.original_text === bengaliText, 'Bengali: original_text preserved verbatim');
    assert(bengaliResult.english_translation === mockBengaliResponse.english_translation, 'Bengali: english_translation standardized');
    assert(bengaliResult.issue_category === 'Waterlogging', 'Bengali: issue_category classified as Waterlogging');
    assert(bengaliResult.severity === 'High', 'Bengali: severity classified as High');
    assert(bengaliResult.recommended_department === 'Drainage and Sewerage', 'Bengali: recommended_department is Drainage and Sewerage');
    assert(bengaliResult.translation_confidence === 96, 'Bengali: translation_confidence returned accurately (96)');

    // Scenario 3B: Hindi Complaint
    const mockHindiResponse = {
      detected_language: 'Hindi',
      original_text: hindiText,
      english_translation: 'There is a deep pothole on the road filled with water following heavy rain.',
      issue_category: 'Road damage',
      issue_summary: 'Deep water-filled road pothole creating hazardous driving conditions.',
      severity: 'High',
      recommended_department: 'Roads and Infrastructure',
      translation_confidence: 94,
    };

    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify(mockHindiResponse),
        }),
      },
    });

    const hindiResult = await processMultilingualComplaint({
      title: 'सड़क पर गड्ढा',
      description: hindiText,
      languagePreference: 'hi',
    });

    assert(hindiResult.detected_language === 'Hindi', 'Hindi: detected_language is Hindi');
    assert(hindiResult.original_text === hindiText, 'Hindi: original_text preserved verbatim');
    assert(hindiResult.english_translation === mockHindiResponse.english_translation, 'Hindi: english_translation standardized');
    assert(hindiResult.issue_category === 'Road damage', 'Hindi: issue_category classified as Road damage');
    assert(hindiResult.recommended_department === 'Roads and Infrastructure', 'Hindi: recommended_department is Roads and Infrastructure');

    // Scenario 3C: Mixed (Hinglish) Complaint
    const mockHinglishResponse = {
      detected_language: 'Mixed (Hinglish)',
      original_text: hinglishText,
      english_translation: 'There is a very large pothole on the road near the station creating a severe accident hazard.',
      issue_category: 'Road damage',
      issue_summary: 'Major pothole near railway station creating severe accident risk.',
      severity: 'Critical',
      recommended_department: 'Roads and Infrastructure',
      translation_confidence: 89,
    };

    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify(mockHinglishResponse),
        }),
      },
    });

    const hinglishResult = await processMultilingualComplaint({
      title: 'Station road pothole',
      description: hinglishText,
      languagePreference: 'auto',
    });

    assert(hinglishResult.detected_language === 'Mixed (Hinglish)', 'Hinglish: detected_language is Mixed (Hinglish)');
    assert(hinglishResult.original_text === hinglishText, 'Hinglish: original_text preserved verbatim');
    assert(hinglishResult.english_translation === mockHinglishResponse.english_translation, 'Hinglish: english_translation standardized');
    assert(hinglishResult.severity === 'Critical', 'Hinglish: severity classified as Critical');

    // ---------------------------------------------------------------
    // 4. Complaint Analysis API Endpoint (/api/complaints/analyze)
    // ---------------------------------------------------------------
    console.log('\n--- Phase 4: Multilingual Complaint Analysis API Endpoint ---');

    setGeminiClient({
      models: {
        generateContent: async (req) => {
          const prompt = extractPrompt(req);
          if (prompt.includes('multilingual civic intelligence linguist')) {
            return { text: JSON.stringify(mockBengaliResponse) };
          }
          return {
            text: JSON.stringify({
              issue_category: 'Waterlogging',
              issue_subcategory: 'Submerged Road',
              description_summary: 'Severe road waterlogging and drainage blockage causing public inconvenience.',
              severity: 'High',
              detected_objects: ['Stagnant rainwater', 'Submerged curb'],
              visible_evidence: ['Submerged road surface'],
              potential_public_safety_risk: 'High risk of skidding and vehicle stalling in flooded street.',
              recommended_department: 'Drainage and Sewerage',
              confidence_score: 96,
              additional_information_required: [],
            }),
          };
        },
      },
    });

    const analyzeRes = await fetch(`${baseUrl}/complaints/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(citizenToken),
      },
      body: JSON.stringify({
        title: 'রাস্তায় জল জমা',
        description: bengaliText,
        language_preference: 'bn',
      }),
    });

    const analyzeData = await analyzeRes.json();
    assert(analyzeRes.status === 200, 'Analyze endpoint returns 200 OK');
    assert(analyzeData.detected_language === 'Bengali', 'Analyze returns detected_language: Bengali');
    assert(analyzeData.original_text === bengaliText, 'Analyze returns verbatim original_text');
    assert(analyzeData.english_translation === mockBengaliResponse.english_translation, 'Analyze returns english_translation');
    assert(analyzeData.issue_category === 'Waterlogging', 'Analyze returns issue_category');
    assert(analyzeData.issue_summary !== undefined, 'Analyze returns issue_summary');
    assert(analyzeData.severity === 'High', 'Analyze returns severity');
    assert(analyzeData.recommended_department === 'Drainage and Sewerage', 'Analyze returns recommended_department');
    assert(analyzeData.translation_confidence === 96, 'Analyze returns translation_confidence');

    // ---------------------------------------------------------------
    // 5. Citizen Interface & Verbatim Storage Integrity on Submission
    // ---------------------------------------------------------------
    console.log('\n--- Phase 5: Citizen Submission & Verbatim Storage Invariant ---');

    setGeminiClient({
      models: {
        generateContent: async (req) => {
          const prompt = extractPrompt(req);
          if (prompt.includes('multilingual civic intelligence linguist')) {
            return { text: JSON.stringify(mockBengaliResponse) };
          }
          if (prompt.includes('Department Routing Prompt') || prompt.includes('available_departments')) {
            return {
              text: JSON.stringify({
                recommended_department: 'Drainage and Sewerage',
                secondary_department: null,
                routing_reason: 'Waterlogging caused by drainage blockage.',
                priority: 'High',
                confidence_score: 95,
                requires_manual_review: false,
              }),
            };
          }
          return { text: JSON.stringify(mockBengaliResponse) };
        },
      },
    });

    const submitRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(citizenToken),
      },
      body: JSON.stringify({
        title: 'রাস্তায় জল জমা ও নর্দমা উপচে পড়া',
        description: bengaliText,
        category: 'Waterlogging',
        language_preference: 'bn',
        ward_id: 'ward-indiranagar',
        address: 'Ballygunge Circular Road, Kolkata',
        latitude: 22.528,
        longitude: 88.365,
      }),
    });

    const submitData = await submitRes.json();
    assert(submitRes.status === 201, 'Complaint submitted successfully (201 Created)');
    const complaintId = submitData.complaint?.id;
    assert(complaintId, 'Returned created complaint ID');

    // Inspect Database Record Directly
    const savedComplaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
    assert(savedComplaint, 'Complaint retrieved from SQLite database');
    assert(savedComplaint.original_text === bengaliText, 'CRITICAL: original_text stored verbatim in Bengali');
    assert(savedComplaint.description === bengaliText, 'CRITICAL: description NEVER overwritten by translation');
    assert(savedComplaint.detected_language === 'Bengali', 'detected_language saved as Bengali');
    assert(savedComplaint.language_preference === 'bn', 'language_preference saved as bn');
    assert(savedComplaint.english_translation === mockBengaliResponse.english_translation, 'english_translation stored for official use');
    assert(savedComplaint.translation_confidence === 96, 'translation_confidence saved correctly');
    assert(savedComplaint.department_id === 'dept-drainage', 'Cross-engine: routed to Drainage and Sewerage based on translated semantics');

    // ---------------------------------------------------------------
    // 6. Multilingual Citizen Notifications Delivery
    // ---------------------------------------------------------------
    console.log('\n--- Phase 6: Multilingual Citizen Notifications Delivery ---');

    // Inspect initial notifications created during submission
    const notifs = db.prepare('SELECT * FROM citizen_notifications WHERE complaint_id = ? ORDER BY created_at ASC').all(complaintId);
    assert(notifs.length >= 2, 'Initial submission created at least 2 notifications (registration + routing)', `Count: ${notifs.length}`);

    const regNotif = notifs.find((n) => n.event_type === 'registration_confirmed');
    assert(regNotif, 'Found registration_confirmed notification');
    assert(regNotif.target_language === 'Bengali', 'registration_confirmed delivered in Bengali');
    assert(regNotif.title === 'অভিযোগ নথিভুক্ত হয়েছে', 'registration_confirmed has Bengali title');
    assert(regNotif.message.includes(savedComplaint.ticket_number), 'registration_confirmed message includes ticket number in Bengali');
    assert(regNotif.english_message.includes('registered with ticket number'), 'registration_confirmed includes English administrative mirror');

    const deptNotif = notifs.find((n) => n.event_type === 'department_assigned');
    assert(deptNotif, 'Found department_assigned notification');
    assert(deptNotif.target_language === 'Bengali', 'department_assigned delivered in Bengali');
    assert(deptNotif.title === 'বিভাগ বরাদ্দ করা হয়েছে', 'department_assigned has Bengali title');

    // Test official status change to In Progress triggers multilingual notification
    const updateStatusRes = await fetch(`${baseUrl}/official/complaints/${complaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(drainageToken),
      },
      body: JSON.stringify({
        status: 'In Progress',
        notes: 'Drainage crew dispatched to site with pump.',
      }),
    });
    assert(updateStatusRes.status === 200, 'Official updates complaint status to In Progress');

    // Check status_changed notification
    const statusNotif = db.prepare(
      'SELECT * FROM citizen_notifications WHERE complaint_id = ? AND event_type = ?'
    ).get(complaintId, 'status_changed');
    assert(statusNotif, 'status_changed notification created');
    assert(statusNotif.target_language === 'Bengali', 'status_changed delivered in Bengali');
    assert(statusNotif.title === 'স্থিতি পরিবর্তন', 'status_changed has Bengali title');
    assert(statusNotif.message.includes('In Progress'), 'status_changed message includes updated status');

    // Test mark work completed triggers work_completed notification
    const completeRes = await fetch(`${baseUrl}/official/complaints/${complaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(drainageToken),
      },
      body: JSON.stringify({
        status: 'Work Completed',
        notes: 'Silt removed from drain. Flow restored.',
      }),
    });
    assert(completeRes.status === 200, 'Official marks complaint Work Completed');

    const workDoneNotif = db.prepare(
      'SELECT * FROM citizen_notifications WHERE complaint_id = ? AND event_type = ?'
    ).get(complaintId, 'work_completed');
    assert(workDoneNotif, 'work_completed notification created');
    assert(workDoneNotif.target_language === 'Bengali', 'work_completed delivered in Bengali');
    assert(workDoneNotif.title === 'কাজ সম্পন্ন — যাচাইকরণ প্রয়োজন', 'work_completed has Bengali title');

    // Test citizen verifies resolution triggers resolved notification
    const verifyRes = await fetch(`${baseUrl}/complaints/${complaintId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(citizenToken),
      },
      body: JSON.stringify({
        is_satisfactory: true,
        feedback: 'Road is now dry and drain flow restored.',
      }),
    });
    assert(verifyRes.status === 200, 'Citizen confirms resolution via /verify (200 OK)');

    const resolvedNotif = db.prepare(
      'SELECT * FROM citizen_notifications WHERE complaint_id = ? AND event_type = ?'
    ).get(complaintId, 'resolved');
    assert(resolvedNotif, 'resolved notification created');
    assert(resolvedNotif.target_language === 'Bengali', 'resolved delivered in Bengali');
    assert(resolvedNotif.title === 'অভিযোগ নিষ্পত্তি হয়েছে', 'resolved has Bengali title');

    // Test Citizen Notification API endpoints
    const myNotifsRes = await fetch(`${baseUrl}/complaints/notifications/me`, {
      headers: { ...authHeaders(citizenToken) },
    });
    const myNotifsData = await myNotifsRes.json();
    assert(myNotifsRes.status === 200, 'GET /notifications/me returns 200');
    assert(Array.isArray(myNotifsData.notifications), 'Returns notifications array');
    assert(myNotifsData.notifications.length >= 4, 'Citizen has all multilingual notifications');

    // Mark notification as read
    const notifToRead = myNotifsData.notifications[0];
    const readRes = await fetch(`${baseUrl}/complaints/notifications/${notifToRead.id}/read`, {
      method: 'PATCH',
      headers: { ...authHeaders(citizenToken) },
    });
    const readData = await readRes.json();
    assert(readRes.status === 200 && readData.success === true, 'PATCH /notifications/:id/read marks notification read');

    // ---------------------------------------------------------------
    // 7. Official Translation Revision Workflow
    // ---------------------------------------------------------------
    console.log('\n--- Phase 7: Official Translation Revision Workflow ---');

    // 7A: Citizen attempt to revise translation should be blocked (403 Forbidden)
    const citizenReviseRes = await fetch(`${baseUrl}/official/complaints/${complaintId}/revise-translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(citizenToken),
      },
      body: JSON.stringify({
        action: 'manual_edit',
        revised_translation: 'Malicious modification attempt',
      }),
    });
    assert(citizenReviseRes.status === 403, 'Citizen blocked from revising official translation (403 Forbidden)');

    // 7B: Unauthenticated attempt should be blocked (401 Unauthorized)
    const unauthReviseRes = await fetch(`${baseUrl}/official/complaints/${complaintId}/revise-translation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'manual_edit',
        revised_translation: 'Unauthenticated edit',
      }),
    });
    assert(unauthReviseRes.status === 401, 'Unauthenticated user blocked from translation revision (401 Unauthorized)');

    // 7C: Authorized Official Manual Edit
    const revisedText = 'Severe waterlogging along roadside curb and stormwater culvert blocked with debris.';
    const revisionNotes = 'Refined technical terminology to highlight culvert debris obstruction for pump crew.';

    const officialReviseRes = await fetch(`${baseUrl}/official/complaints/${complaintId}/revise-translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(drainageToken),
      },
      body: JSON.stringify({
        action: 'manual_edit',
        revised_translation: revisedText,
        revision_notes: revisionNotes,
      }),
    });

    const officialReviseData = await officialReviseRes.json();
    assert(officialReviseRes.status === 200, 'Official manual translation edit succeeds (200 OK)');
    assert(officialReviseData.english_translation === revisedText, 'Response returns updated english_translation');
    assert(officialReviseData.translation_notes === revisionNotes, 'Response returns updated revision_notes');

    // Verify in database: English translation updated, BUT verbatim Bengali text is still 100% UNTOUCHED
    const revisedDbComplaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
    assert(revisedDbComplaint.english_translation === revisedText, 'DB english_translation reflects official manual edit');
    assert(revisedDbComplaint.translation_notes === revisionNotes, 'DB translation_notes saved');
    assert(revisedDbComplaint.translation_revised_by_user_id !== null, 'DB translation_revised_by_user_id recorded');
    assert(revisedDbComplaint.translation_revised_at !== null, 'DB translation_revised_at recorded');
    assert(revisedDbComplaint.original_text === bengaliText, 'CRITICAL INVARIANT: original_text is STILL intact in Bengali');
    assert(revisedDbComplaint.description === bengaliText, 'CRITICAL INVARIANT: description is STILL intact in Bengali');

    // 7D: Authorized Official AI Regeneration
    const retranslatedResponse = {
      detected_language: 'Bengali',
      original_text: bengaliText,
      english_translation: 'Continuous waterlogging along the roadside with severe drainage blockages hindering pedestrian transit.',
      issue_category: 'Waterlogging',
      issue_summary: 'Roadside water accumulation and drainage failure.',
      severity: 'High',
      recommended_department: 'Drainage and Sewerage',
      translation_confidence: 98,
    };

    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify(retranslatedResponse),
        }),
      },
    });

    const regenRes = await fetch(`${baseUrl}/official/complaints/${complaintId}/revise-translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(drainageToken),
      },
      body: JSON.stringify({
        action: 'regenerate',
        revision_notes: 'Re-translated using enhanced model prompt.',
      }),
    });

    const regenData = await regenRes.json();
    assert(regenRes.status === 200, 'Official AI regeneration succeeds (200 OK)');
    const finalTranslation = regenData.english_translation || regenData.complaint?.english_translation;
    assert(finalTranslation === retranslatedResponse.english_translation, 'Response returns regenerated translation');
    const finalConfidence = regenData.translation_confidence || regenData.complaint?.translation_confidence;
    assert(finalConfidence === 98, 'Response returns updated translation_confidence (98)');

    // ---------------------------------------------------------------
    // 8. Cross-Engine Semantic Duplicate Detection
    // ---------------------------------------------------------------
    console.log('\n--- Phase 8: Cross-Engine Multilingual Duplicate Detection ---');

    // Candidate complaint in English
    const candidateEnglishComplaint = {
      id: 'cmp-candidate-roads-1',
      ticket_number: 'ROAD-EN-001',
      title: 'Pothole on Station Road',
      description: 'Massive pothole on Station Road near railway station causing vehicle damage.',
      issue_category: 'Road damage',
      latitude: 22.572,
      longitude: 88.363,
      distance_meters: 25,
      status: 'submitted',
    };

    // Incoming new complaint in Hindi describing the same issue
    const incomingHindiComplaint = {
      title: 'स्टेशन रोड पर बड़ा गड्ढा',
      description: 'रेलवे स्टेशन के पास सड़क पर बहुत बड़ा गड्ढा है और गाड़ियां टकरा रही हैं।',
      category: 'Road damage',
      latitude: 22.5721,
      longitude: 88.3631,
      ward_id: 'ward-01',
    };

    // Mock Gemini duplicate response conforming to semanticDuplicateOutputSchema
    const mockCrossLingualDupClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            new_complaint_features: {
              issue_category: 'Road damage',
              issue_description: 'Large pothole on road near station damaging vehicles.',
              infrastructure_type: 'Asphalt road pavement',
              location_description: 'Station Road near railway station',
              specific_landmarks: 'Railway station',
              nature_of_damage: 'Deep pothole',
              relevant_context: 'Vehicle collision hazard',
            },
            candidate_evaluations: [
              {
                candidate_id: candidateEnglishComplaint.id,
                semantic_similarity_score: 93,
                is_semantic_match: true,
                match_reasoning: 'The Hindi complaint describes a large pothole near the railway station damaging vehicles, which exactly matches the English complaint at the identical location.',
                infrastructure_type: 'Asphalt road pavement',
                nature_of_damage: 'Deep crater pothole',
              },
            ],
          }),
        }),
      },
    };

    setGeminiClient(mockCrossLingualDupClient);

    const prompt = buildSemanticDuplicatePrompt(incomingHindiComplaint, [candidateEnglishComplaint]);
    assert(prompt.toLowerCase().includes('multilingual'), 'Semantic duplicate prompt includes cross-lingual / multilingual instructions');

    const dupCheckResult = await analyzeSemanticDuplicates(
      incomingHindiComplaint,
      [candidateEnglishComplaint]
    );

    assert(dupCheckResult.candidate_evaluations.length === 1, 'Evaluates candidate complaint');
    const evaluation = dupCheckResult.candidate_evaluations[0];
    assert(evaluation.candidate_id === candidateEnglishComplaint.id, 'Identifies candidate complaint ID correctly');
    assert(evaluation.is_semantic_match === true, 'Cross-engine: Detects duplicate between Hindi complaint and English candidate');
    assert(evaluation.semantic_similarity_score >= 90, 'High semantic similarity confidence across languages', `Score: ${evaluation.semantic_similarity_score}`);

    // ---------------------------------------------------------------
    // 9. Cross-Engine Department Routing for Non-English Complaints
    // ---------------------------------------------------------------
    console.log('\n--- Phase 9: Cross-Engine Multilingual Department Routing ---');

    // Routing an incoming Tamil complaint about broken streetlights
    const tamilComplaint = {
      title: 'தெரு விளக்கு எரியவில்லை',
      description: 'எங்கள் தெருவில் விளக்குகள் பல நாட்களாக எரியவில்லை, இரவு நேரத்தில் மிகவும் இருட்டாக உள்ளது.',
      original_citizen_description: 'எங்கள் தெருவில் விளக்குகள் பல நாட்களாக எரியவில்லை, இரவு நேரத்தில் மிகவும் இருட்டாக உள்ளது.',
      category: 'Streetlight failure',
      address: 'Anna Salai, Ward 4',
    };

    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            recommended_department: 'Street Lighting',
            secondary_department: null,
            routing_reason: 'Issue concerns street lights not functioning causing complete darkness at night.',
            priority: 'Medium',
            confidence_score: 94,
            requires_manual_review: false,
          }),
        }),
      },
    });

    const routingResult = await classifyAndRouteComplaint(tamilComplaint);
    assert(routingResult.routing_status === 'auto_routed', 'Department routing handles non-English complaint with auto-routing');
    assert(routingResult.recommended_department_name === 'Street Lighting', 'Routes Tamil lighting complaint to Street Lighting department');
    assert(routingResult.assigned_department_id === 'dept-lighting', 'Assigns dept-lighting ID correctly');

    console.log('\n====================================================================');
    console.log(`Multilingual Test Suite Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================================\n');
  } finally {
    resetGeminiClient();
    if (server) {
      server.close();
    }
  }

  return { passed, failed };
}

// Direct execution support
if (process.argv[1]?.endsWith('multilingualComplaintProcessing.test.js')) {
  runMultilingualTestSuite()
    .then(({ failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal error running multilingual test suite:', err);
      process.exit(1);
    });
}
