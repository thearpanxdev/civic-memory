import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { generateGeminiMultimodal } from './geminiService.js';
import { departmentRoutingOutputSchema } from '../validators/departmentRoutingValidators.js';

const ISSUE_CATEGORY_FALLBACK_MAP = {
  'Road damage': 'Roads and Infrastructure',
  'Waterlogging': 'Drainage and Sewerage',
  'Drainage and sewage': 'Drainage and Sewerage',
  'Garbage accumulation': 'Sanitation and Waste Management',
  'Streetlight failure': 'Street Lighting',
  'Street Lighting': 'Street Lighting',
  'Water supply': 'Water Supply',
  'Public infrastructure damage': 'Roads and Infrastructure',
  'Electricity-related civic issues': 'Street Lighting',
  'Roads and Infrastructure': 'Roads and Infrastructure',
  'Sanitation and Waste Management': 'Sanitation and Waste Management',
};

/**
 * Retrieves all currently active municipal departments from SQLite.
 *
 * @param {any} [database=db]
 * @returns {Array<Object>}
 */
export function getActiveDepartments(database = db) {
  try {
    return database
      .prepare(`
        SELECT id, name, code, description, responsibilities, routing_rules, is_active
        FROM departments
        WHERE is_active = 1
        ORDER BY name ASC
      `)
      .all();
  } catch (err) {
    console.error('[RoutingService] Error querying active departments:', err.message);
    return [];
  }
}

/**
 * Builds the dynamic department routing prompt using runtime active departments.
 *
 * @param {Object} complaint
 * @param {Array<Object>} activeDepartments
 * @returns {string}
 */
export function buildDepartmentRoutingPrompt(complaint, activeDepartments) {
  const deptsXml = activeDepartments
    .map(
      (d) => `  <department>
    <id>${d.id}</id>
    <code>${d.code}</code>
    <name>${d.name}</name>
    <description>${d.description || 'N/A'}</description>
    <responsibilities>${d.responsibilities || 'N/A'}</responsibilities>
    <routing_rules>${d.routing_rules || 'N/A'}</routing_rules>
  </department>`
    )
    .join('\n');

  return `You are the Municipal Problem Dispatcher and AI Routing Engine for CivicMemory, an urban civic issue management platform.
Your objective is to accurately classify citizen complaints and assign them to the single most appropriate municipal department based on the currently active departments and their operational jurisdictions.

<available_departments>
${deptsXml}
</available_departments>

<complaint_data>
  <title>${complaint.title || 'Untitled'}</title>
  <description>${complaint.description || ''}</description>
  ${complaint.original_description && complaint.original_description !== complaint.description ? `<original_citizen_description>${complaint.original_description}</original_citizen_description>` : ''}
  <category>${complaint.category || 'General'}</category>
  <address>${complaint.address || 'Not specified'}</address>
  <landmark>${complaint.landmark || 'None'}</landmark>
  <ward>${complaint.ward_name || complaint.ward_zone || 'Unknown'}</ward>
  <coordinates>Lat: ${complaint.latitude || 0}, Lon: ${complaint.longitude || 0}</coordinates>
  ${complaint.ai_summary ? `<existing_ai_summary>${complaint.ai_summary}</existing_ai_summary>` : ''}
</complaint_data>

OPERATIONAL ROUTING RULES:
1. Multilingual Understanding: Complaint content may be in English, Bengali, Hindi, Tamil, Telugu, Marathi, or mixed colloquial text (Hinglish / Benglish). Evaluate the underlying civic defect and classify based on operational jurisdictions regardless of language.
2. ONLY select a department from <available_departments>. Match the exact "name" or "code" of an active department.
3. Examine the complaint description, photographic evidence (if attached), category, and location cues. Match them against the department responsibilities and routing rules.
3. If an issue spans multiple departments or has a secondary contributor (e.g. waterlogging caused by both blocked drains and road depression), provide the primary in "recommended_department" and the other in "secondary_department".
4. Determine the urgency priority based on public safety, structural risk, and environmental hazard:
   - "Critical": Imminent life hazard, live electrical wires on water, open main-road manholes, major water main burst causing flooding.
   - "High": Major road crater blocking traffic, heavy sewage overflowing into residential doorways, dark junction light failure in accident-prone spot.
   - "Medium": Standard potholes, accumulated garbage bags, flickering light, leaking domestic distribution pipe.
   - "Low": Minor sidewalk crack, aesthetic litter, unpainted speed breaker, non-urgent maintenance.
5. Provide a realistic confidence_score between 0 and 100:
   - 80-100: Unambiguous match directly corresponding to clear department responsibilities and evidence.
   - 75-79: Probable match with minor ambiguity.
   - Below 75: Vague description, conflicting cues, or ambiguous responsibility.
6. Ambiguity & Manual Review Flag:
   - Set "requires_manual_review": false ONLY when confidence is >= 75 and the assignment is clear and definite.
   - Set "requires_manual_review": true if the issue is ambiguous, describes multiple conflicting problems, lacks sufficient detail, or confidence is below 75.

OUTPUT SPECIFICATION:
Respond ONLY with a valid JSON object matching this schema:
{
  "recommended_department": "<Department Name or Code from available departments>",
  "secondary_department": "<Secondary department name or code if applicable, or null>",
  "routing_reason": "<1-2 concise sentences explaining why this department was selected based on jurisdiction>",
  "priority": "Low | Medium | High | Critical",
  "confidence_score": <number between 0 and 100>,
  "requires_manual_review": <true | false>
}`;
}

/**
 * Matches a raw department string (name, code, or substring) against active departments.
 *
 * @param {string} raw
 * @param {Array<Object>} activeDepartments
 * @returns {Object | null}
 */
export function matchDepartment(raw, activeDepartments) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase();

  // 1. Match by ID
  let match = activeDepartments.find((d) => d.id.toLowerCase() === cleaned);
  if (match) return match;

  // 2. Match by Code
  match = activeDepartments.find((d) => d.code.toLowerCase() === cleaned);
  if (match) return match;

  // 3. Match by exact Name
  match = activeDepartments.find((d) => d.name.toLowerCase() === cleaned);
  if (match) return match;

  // 4. Match by includes / substring
  match = activeDepartments.find(
    (d) => cleaned.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(cleaned)
  );
  if (match) return match;

  // 5. Match by partial keyword
  match = activeDepartments.find((d) => {
    const code = d.code.toLowerCase();
    return cleaned.includes(code) || code.includes(cleaned);
  });
  if (match) return match;

  return null;
}

/**
 * Classifies a complaint and determines its recommended and assigned department.
 *
 * @param {Object} complaintData
 * @param {Object} [options]
 * @param {any} [options.client] - Override Gemini client
 * @param {Array<Object>} [options.files] - Uploaded evidence files { buffer, mimeType }
 * @param {any} [options.database=db]
 * @returns {Promise<Object>}
 */
export async function classifyAndRouteComplaint(complaintData, options = {}) {
  const database = options.database || db;
  const activeDepartments = getActiveDepartments(database);

  // If no active departments are configured in the system, flag for manual review
  if (!activeDepartments || activeDepartments.length === 0) {
    return {
      recommended_department_id: null,
      recommended_department_name: 'Unassigned',
      secondary_department_id: null,
      secondary_department_name: null,
      assigned_department_id: null,
      routing_reason: 'No active municipal departments configured in the platform.',
      priority: 'Medium',
      confidence_score: 0,
      requires_manual_review: 1,
      routing_status: 'manual_review_required',
      raw_ai_response: null,
    };
  }

  const prompt = buildDepartmentRoutingPrompt(complaintData, activeDepartments);

  // Prepare multimodal content parts
  const contents = [prompt];
  if (Array.isArray(options.files)) {
    for (const f of options.files) {
      if (f.buffer && f.mimeType) {
        contents.push({
          inlineData: {
            mimeType: f.mimeType,
            data: f.buffer.toString('base64'),
          },
        });
      }
    }
  }

  let rawText = '';
  try {
    rawText = await generateGeminiMultimodal(contents, {
      client: options.client,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const parsedJson = JSON.parse(cleaned);
    const validated = departmentRoutingOutputSchema.parse(parsedJson);

    // Match departments
    const primaryDept = matchDepartment(validated.recommended_department, activeDepartments);
    const secondaryDept = validated.secondary_department
      ? matchDepartment(validated.secondary_department, activeDepartments)
      : null;

    const confidenceScore = validated.confidence_score;
    // Rule: confidence >= 75 AND requires_manual_review === false AND primary department matched
    const isConfident = confidenceScore >= 75 && !validated.requires_manual_review && !!primaryDept;

    const routingStatus = isConfident ? 'auto_routed' : 'manual_review_required';
    const requiresManualReview = isConfident ? 0 : 1;
    const assignedDepartmentId = primaryDept ? primaryDept.id : null;

    return {
      recommended_department_id: primaryDept ? primaryDept.id : null,
      recommended_department_name: primaryDept ? primaryDept.name : validated.recommended_department,
      secondary_department_id: secondaryDept ? secondaryDept.id : null,
      secondary_department_name: secondaryDept ? secondaryDept.name : (validated.secondary_department || null),
      assigned_department_id: assignedDepartmentId,
      routing_reason: validated.routing_reason,
      priority: validated.priority,
      confidence_score: confidenceScore,
      requires_manual_review: requiresManualReview,
      routing_status: routingStatus,
      raw_ai_response: validated,
    };
  } catch (err) {
    console.warn('[RoutingService] Gemini department classification failed or timed out:', err.message);

    // Graceful fallback: Identify best matching department by category or first active department
    const cat = complaintData.category || '';
    const mappedTarget = ISSUE_CATEGORY_FALLBACK_MAP[cat] || cat;
    const fallbackDept =
      activeDepartments.find((d) =>
        (mappedTarget && (d.name.toLowerCase() === mappedTarget.toLowerCase() || d.name.toLowerCase().includes(mappedTarget.toLowerCase()))) ||
        (cat && d.name.toLowerCase().includes(cat.toLowerCase())) ||
        (cat && cat.toLowerCase().includes(d.name.toLowerCase())) ||
        (cat && d.routing_rules && d.routing_rules.toLowerCase().includes(cat.toLowerCase()))
      ) || activeDepartments[0];

    return {
      recommended_department_id: fallbackDept ? fallbackDept.id : null,
      recommended_department_name: fallbackDept ? fallbackDept.name : 'Unknown Department',
      secondary_department_id: null,
      secondary_department_name: null,
      assigned_department_id: fallbackDept ? fallbackDept.id : null,
      routing_reason: `Automatic routing fallback applied (${err.message.includes('timeout') ? 'AI request timed out' : 'AI service unavailable'}). Manual verification recommended.`,
      priority: 'Medium',
      confidence_score: 50,
      requires_manual_review: 1,
      routing_status: 'manual_review_required',
      raw_ai_response: null,
    };
  }
}

/**
 * Records an entry into the immutable department_routing_audit table.
 *
 * @param {string} complaintId
 * @param {Object} routingData
 * @param {Object} assignedBy - { type: 'system_ai' | 'official' | 'admin', userId: string | null }
 * @param {string | null} [reassignmentReason=null]
 * @param {any} [database=db]
 */
export function recordRoutingAudit(
  complaintId,
  routingData,
  assignedBy = { type: 'system_ai', userId: null },
  reassignmentReason = null,
  database = db
) {
  try {
    const auditId = `dra-${uuidv4()}`;
    database
      .prepare(`
        INSERT INTO department_routing_audit (
          id, complaint_id,
          recommended_department_id, recommended_department_name,
          secondary_department_id, secondary_department_name,
          assigned_department_id, assigned_department_name,
          assigned_by_user_id, assigned_by_type,
          confidence_score, routing_reason, reassignment_reason,
          requires_manual_review
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        auditId,
        complaintId,
        routingData.recommended_department_id || null,
        routingData.recommended_department_name || null,
        routingData.secondary_department_id || null,
        routingData.secondary_department_name || null,
        routingData.assigned_department_id || null,
        routingData.assigned_department_name || null,
        assignedBy.userId || null,
        assignedBy.type || 'system_ai',
        routingData.confidence_score !== undefined ? routingData.confidence_score : null,
        routingData.routing_reason || null,
        reassignmentReason || null,
        routingData.requires_manual_review ? 1 : 0
      );
    return auditId;
  } catch (err) {
    console.error('[RoutingService] Failed to record routing audit log:', err.message);
    return null;
  }
}
