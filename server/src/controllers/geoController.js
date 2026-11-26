import { z } from 'zod';
import {
  INDIAN_STATES_AND_UTS,
  DISTRICTS_BY_STATE,
  REPRESENTATIVE_ULBS,
  LOCAL_PINCODE_CACHE,
  isValidState,
  getCanonicalState,
  getDistrictsForState,
  isValidDistrictForState,
  getCanonicalDistrict,
  getUlbsForDistrict,
  isKnownUlb,
} from '../utils/indiaGeoData.js';
import { generateGeminiText } from '../services/geminiService.js';

/**
 * Bounded LRU Cache for postal lookup records.
 * Protects server from memory exhaustion and sets a 24-hour TTL on cached responses.
 */
class BoundedLruCache {
  constructor(maxSize = 1000, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Refresh access order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const dynamicPinCache = new BoundedLruCache(1000, 24 * 60 * 60 * 1000);

// Pluggable fetch for dependency injection in automated tests
let postalFetch = fetch;

export function setPostalFetch(customFetch) {
  postalFetch = customFetch || fetch;
}

export function resetPostalFetch() {
  postalFetch = fetch;
}

export const checkLocalitySchema = z.object({
  locality: z
    .string({ required_error: 'Locality name is required' })
    .trim()
    .min(2, 'Locality must be at least 2 characters')
    .max(100, 'Locality cannot exceed 100 characters'),
  state: z
    .string({ required_error: 'State is required' })
    .trim()
    .min(2, 'State must be at least 2 characters')
    .max(60, 'State cannot exceed 60 characters'),
  district: z
    .string({ required_error: 'District is required' })
    .trim()
    .min(2, 'District must be at least 2 characters')
    .max(60, 'District cannot exceed 60 characters'),
  pin_code: z
    .string({ required_error: 'PIN code is required' })
    .trim()
    .regex(/^\d{6}$/, 'PIN code must be a 6-digit number'),
});

const geminiAssessmentSchema = z.object({
  status: z.enum(['plausible', 'possible_mismatch', 'insufficient_information']),
  message: z.string().max(300),
  suggested_correction: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Returns the list of all 36 Indian States and Union Territories
 */
export function getStates(req, res) {
  res.json({
    success: true,
    states: INDIAN_STATES_AND_UTS,
  });
}

/**
 * Returns all recognized districts for a given state
 */
export function getDistricts(req, res) {
  const { state } = req.query;
  if (!state || typeof state !== 'string' || !state.trim()) {
    return res.status(400).json({
      success: false,
      error: 'State query parameter is required',
    });
  }

  if (!isValidState(state)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Indian State or Union Territory',
    });
  }

  const canonical = getCanonicalState(state);
  const districts = getDistrictsForState(canonical);

  res.json({
    success: true,
    state: canonical,
    districts,
  });
}

/**
 * Returns known representative ULBs for a given state and district
 */
export function getUlbs(req, res) {
  const { state, district } = req.query;
  if (!state || !district) {
    return res.json({
      success: true,
      ulbs: [],
    });
  }

  const ulbs = getUlbsForDistrict(state, district);
  res.json({
    success: true,
    ulbs,
  });
}

/**
 * Looks up postal details for a 6-digit Indian PIN code.
 * Evaluates ALL returned post offices, detects regional conflicts,
 * and caches results in a bounded LRU cache with TTL.
 */
export async function lookupPincode(req, res) {
  const { pincode } = req.params;
  if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
    return res.status(400).json({
      success: false,
      error: 'PIN code must be a 6-digit number',
    });
  }

  const pin = pincode.trim();

  // 1. Check bounded dynamic cache first
  const dynamicCached = dynamicPinCache.get(pin);
  if (dynamicCached) {
    return res.json({
      success: true,
      fromCache: true,
      pincode: pin,
      ...dynamicCached,
    });
  }

  // 2. Attempt upstream postal API fetch with 3500ms timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  let upstreamRes;
  try {
    upstreamRes = await postalFetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CivicMemory-PostalLookup/1.0',
      },
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    // Timeout, DNS error, connection failure, or abort returns 503
    return res.status(503).json({
      success: false,
      error: 'Postal lookup service unavailable. Please enter address manually.',
      networkUnavailable: true,
    });
  }
  clearTimeout(timeoutId);

  // Handle upstream HTTP errors
  if (!upstreamRes.ok) {
    if (upstreamRes.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'PIN code not found in postal directory',
      });
    }
    return res.status(502).json({
      success: false,
      error: 'Postal lookup service returned an error',
    });
  }

  let data;
  try {
    data = await upstreamRes.json();
  } catch (parseErr) {
    // Malformed JSON / non-JSON response from upstream returns 502
    return res.status(502).json({
      success: false,
      error: 'Invalid response from postal lookup service',
    });
  }

  // Validate upstream array structure
  if (!Array.isArray(data) || data.length === 0 || !data[0] || typeof data[0] !== 'object') {
    return res.status(502).json({
      success: false,
      error: 'Malformed response structure from postal lookup service',
    });
  }

  // India Post returns [{ Status: "Error", Message: "No records found" }] for invalid/non-existent PINs
  if (data[0].Status !== 'Success') {
    return res.status(404).json({
      success: false,
      error: 'PIN code not found in postal directory',
    });
  }

  const postOfficesRaw = data[0].PostOffice;
  if (!Array.isArray(postOfficesRaw) || postOfficesRaw.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No postal offices found for this PIN code',
    });
  }

  // Filter and validate post office objects with valid names
  const validPostOffices = postOfficesRaw.filter(
    (po) => po && typeof po === 'object' && typeof po.Name === 'string' && po.Name.trim().length > 0
  );

  if (validPostOffices.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No valid postal offices found for this PIN code',
    });
  }

  // Collect all distinct post office names (de-duplicated and sorted)
  const postOffices = Array.from(
    new Set(validPostOffices.map((po) => po.Name.trim()))
  ).sort((a, b) => a.localeCompare(b));

  // Map all canonical states and districts across ALL post offices
  const stateDistrictMap = new Map();
  for (const po of validPostOffices) {
    const rawState = typeof po.State === 'string' ? po.State : '';
    const rawDistrict = typeof po.District === 'string' ? po.District : '';
    const canonState = getCanonicalState(rawState);
    if (canonState) {
      const canonDist = getCanonicalDistrict(canonState, rawDistrict);
      if (canonDist) {
        if (!stateDistrictMap.has(canonState)) {
          stateDistrictMap.set(canonState, new Set());
        }
        stateDistrictMap.get(canonState).add(canonDist);
      }
    }
  }

  let detectedState = null;
  let detectedDistrict = null;
  let conflicting = false;
  let conflictingStates = [];
  let conflictingDistricts = [];

  if (stateDistrictMap.size === 1) {
    detectedState = stateDistrictMap.keys().next().value;
    const distSet = stateDistrictMap.get(detectedState);
    if (distSet.size === 1) {
      // Unambiguous single state and single district
      detectedDistrict = distSet.values().next().value;
      conflicting = false;
    } else if (distSet.size > 1) {
      // Spans multiple districts within the same state
      conflicting = true;
      conflictingDistricts = Array.from(distSet).sort();
    }
  } else if (stateDistrictMap.size > 1) {
    // Spans multiple states
    conflicting = true;
    conflictingStates = Array.from(stateDistrictMap.keys()).sort();
    for (const dists of stateDistrictMap.values()) {
      conflictingDistricts.push(...Array.from(dists));
    }
    conflictingDistricts = Array.from(new Set(conflictingDistricts)).sort();
  } else {
    // Inconclusive mapping from post offices (raw state/district could not be canonicalized)
    conflicting = true;
  }

  const suggestedUlbs =
    detectedState && detectedDistrict && !conflicting
      ? getUlbsForDistrict(detectedState, detectedDistrict)
      : [];

  const record = {
    state: detectedState,
    district: detectedDistrict,
    postOffices,
    suggestedUlbs,
    conflicting,
    ...(conflictingStates.length > 0 ? { conflictingStates } : {}),
    ...(conflictingDistricts.length > 0 ? { conflictingDistricts } : {}),
  };

  // Cache valid records with post offices in bounded LRU cache ONLY on success
  if (postOffices.length > 0) {
    dynamicPinCache.set(pin, record);
  }

  return res.json({
    success: true,
    pincode: pin,
    ...record,
  });
}

/**
 * Dedicated rate-limited endpoint for advisory AI-assisted locality assessment.
 * Reuses server-side Gemini service with strict structured validation and privacy.
 */
export async function checkLocality(req, res) {
  const parseResult = checkLocalitySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { locality, state, district, pin_code } = parseResult.data;

  // Validate state and district
  if (!isValidState(state)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Indian State or Union Territory',
    });
  }

  const canonicalState = getCanonicalState(state);
  const canonicalDistrict = getCanonicalDistrict(canonicalState, district);
  if (!canonicalDistrict) {
    return res.status(400).json({
      success: false,
      error: 'Selected District does not belong to the selected State',
    });
  }

  // 1. Check if the locality matches any post office in cache for this PIN
  const cachedPin = dynamicPinCache.get(pin_code) || LOCAL_PINCODE_CACHE[pin_code];
  if (cachedPin && Array.isArray(cachedPin.postOffices)) {
    const cleanLoc = locality.toLowerCase();
    const matchedPo = cachedPin.postOffices.find((po) => po.toLowerCase() === cleanLoc);
    if (matchedPo) {
      return res.json({
        success: true,
        assessment: {
          status: 'plausible',
          message: `Locality matches official postal directory records (${matchedPo}) for PIN ${pin_code}.`,
          suggested_correction: null,
          confidence: 1.0,
        },
        verification_level: 'postal_matched',
      });
    }
  }

  // 2. Call Gemini for advisory plausibility assessment
  try {
    const prompt = `You are a geographic verification assistant for India's civic portal CivicMemory.
Assess whether the locality name "${locality}" is plausible within:
District: ${canonicalDistrict}
State: ${canonicalState}
PIN Code: ${pin_code}

Rules:
1. status MUST be one of: "plausible", "possible_mismatch", "insufficient_information"
   - "plausible": if the locality is a known or plausible neighborhood, sector, colony, nagar, layout, mohalla, or village in or around this district.
   - "possible_mismatch": if the locality name is famous or known to belong to an entirely different district or state in India (e.g., Connaught Place in Bengaluru, or Indiranagar in Kolkata).
   - "insufficient_information": if there is no evidence or you cannot determine plausibility.
2. message: concise 1-2 sentence explanation.
3. suggested_correction: provide a corrected spelling only if it is an obvious minor typo; otherwise null.
4. confidence: float between 0.0 and 1.0.

Respond strictly with valid JSON without markdown fences:
{
  "status": "plausible",
  "message": "Locality is recognized as a residential area in this district.",
  "suggested_correction": null,
  "confidence": 0.85
}`;

    const textResponse = await generateGeminiText(prompt, {
      timeoutMs: 8000,
      maxRetries: 1,
    });

    let parsedData = null;
    const cleanJson = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (_) {
      const jsonMatch = textResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    }

    const validated = geminiAssessmentSchema.safeParse(parsedData);
    if (!validated.success) {
      throw new Error('Gemini response did not conform to assessment schema');
    }

    const assessment = validated.data;
    const verificationLevel = assessment.status === 'plausible' ? 'ai_assessed' : 'manual_unverified';

    return res.json({
      success: true,
      assessment: {
        status: assessment.status,
        message: assessment.message,
        suggested_correction: assessment.suggested_correction || null,
        confidence: assessment.confidence !== undefined ? assessment.confidence : 0.75,
      },
      verification_level: verificationLevel,
    });
  } catch (err) {
    // Graceful fallback on Gemini timeout, provider error, sandboxed offline, or parse failure
    return res.json({
      success: true,
      assessment: {
        status: 'insufficient_information',
        message: 'AI locality assessment is temporarily unavailable. Manual entry is accepted.',
        suggested_correction: null,
        confidence: 0.5,
      },
      verification_level: 'manual_unverified',
    });
  }
}
