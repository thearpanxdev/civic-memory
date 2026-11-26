import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../src/index.js';
import db from '../src/config/database.js';
import { config } from '../src/config/env.js';
import {
  INDIAN_STATES_AND_UTS,
  DISTRICTS_BY_STATE,
  isValidState,
  isValidDistrictForState,
  getCanonicalState,
  getDistrictsForState,
  getCanonicalDistrict,
  getUlbsForDistrict,
  isKnownUlb,
} from '../src/utils/indiaGeoData.js';
import { setGeminiClient, resetGeminiClient } from '../src/services/geminiService.js';
import { hashOtp } from '../src/services/otpService.js';
import { setPostalFetch, resetPostalFetch, dynamicPinCache } from '../src/controllers/geoController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('CivicMemory — Geographic Address Selection & Backend Validation', async (t) => {
  config.nodeEnv = 'test';
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  t.after(() => {
    resetGeminiClient();
    resetPostalFetch();
    server.close();
  });

  const getUniquePhone = (offset = 0) => '9' + String(Date.now() + offset).slice(-9);
  const getUniqueEmail = (prefix = 'geo') =>
    `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@civicmemory.local`;

  // =========================================================================
  // 1. GEO API ENDPOINTS
  // =========================================================================
  await t.test('1. GET /api/geo/states returns all 36 canonical States and UTs', async () => {
    const res = await fetch(`${baseUrl}/geo/states`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.states), true);
    assert.equal(body.states.length, 36);
    assert.ok(body.states.includes('Karnataka'));
    assert.ok(body.states.includes('Maharashtra'));
    assert.ok(body.states.includes('Delhi'));
    assert.ok(body.states.includes('Tamil Nadu'));
  });

  await t.test('2. GET /api/geo/districts?state=Karnataka returns all Karnataka districts', async () => {
    const res = await fetch(`${baseUrl}/geo/districts?state=Karnataka`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.state, 'Karnataka');
    assert.ok(Array.isArray(body.districts));
    assert.ok(body.districts.includes('Bengaluru Urban'));
    assert.ok(body.districts.includes('Mysuru'));
    assert.ok(body.districts.includes('Dharwad'));
  });

  await t.test('3. GET /api/geo/districts with case-insensitive matching', async () => {
    const res = await fetch(`${baseUrl}/geo/districts?state=karnataka`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.state, 'Karnataka');
    assert.ok(body.districts.includes('Bengaluru Urban'));
  });

  await t.test('4. GET /api/geo/districts rejects invalid state with 400', async () => {
    const res = await fetch(`${baseUrl}/geo/districts?state=Atlantis`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Invalid Indian State'));
  });

  await t.test('5. GET /api/geo/districts rejects missing state with 400', async () => {
    const res = await fetch(`${baseUrl}/geo/districts`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('State query parameter is required'));
  });

  await t.test('6. GET /api/geo/ulbs returns known representative ULBs for district with administrative category', async () => {
    const res = await fetch(
      `${baseUrl}/geo/ulbs?state=Karnataka&district=Bengaluru%20Urban`
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.ulbs));
    assert.ok(body.ulbs.some((u) => u.includes('BBMP') && u.includes('Municipal Corporation')));
  });

  await t.test('7. GET /api/geo/pincode/:pincode returns postal details for 560038', async () => {
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          Status: 'Success',
          PostOffice: [
            { Name: 'Indiranagar', State: 'Karnataka', District: 'Bengaluru Urban' },
            { Name: 'HAL II Stage', State: 'Karnataka', District: 'Bengaluru Urban' },
          ],
        },
      ],
    }));

    const res = await fetch(`${baseUrl}/geo/pincode/560038`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.pincode, '560038');
    assert.equal(body.state, 'Karnataka');
    assert.equal(body.district, 'Bengaluru Urban');
    assert.ok(Array.isArray(body.postOffices));
    assert.ok(body.postOffices.includes('Indiranagar'));
    assert.ok(Array.isArray(body.suggestedUlbs));
    assert.equal(body.conflicting, false);
  });

  await t.test('8. GET /api/geo/pincode/:pincode rejects non-6-digit PIN code with 400', async () => {
    const res1 = await fetch(`${baseUrl}/geo/pincode/56003`);
    assert.equal(res1.status, 400);
    const body1 = await res1.json();
    assert.equal(body1.success, false);

    const res2 = await fetch(`${baseUrl}/geo/pincode/abc123`);
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.equal(body2.success, false);
  });

  // =========================================================================
  // 2. DATA MODULE HELPER VERIFICATIONS & ALIAS NORMALIZATION
  // =========================================================================
  await t.test('9. isValidState correctly identifies all 36 Indian states and UTs', () => {
    assert.equal(isValidState('Karnataka'), true);
    assert.equal(isValidState('karnataka'), true);
    assert.equal(isValidState('Delhi'), true);
    assert.equal(isValidState('Puducherry'), true);
    assert.equal(isValidState('California'), false);
    assert.equal(isValidState('London'), false);
    assert.equal(isValidState(''), false);
    assert.equal(isValidState(null), false);
  });

  await t.test('10. isValidDistrictForState verifies district belongs strictly to parent state', () => {
    assert.equal(isValidDistrictForState('Karnataka', 'Bengaluru Urban'), true);
    assert.equal(isValidDistrictForState('Karnataka', 'Mysuru'), true);
    assert.equal(isValidDistrictForState('Karnataka', 'Pune'), false); // Pune is in Maharashtra
    assert.equal(isValidDistrictForState('Maharashtra', 'Pune'), true);
    assert.equal(isValidDistrictForState('Maharashtra', 'Mumbai City'), true);
    assert.equal(isValidDistrictForState('Delhi', 'New Delhi'), true);
    assert.equal(isValidDistrictForState('Tamil Nadu', 'Chennai'), true);
    assert.equal(isValidDistrictForState('Tamil Nadu', 'Bengaluru Urban'), false);
  });

  await t.test('10b. Resolves state and district aliases accurately to canonical names', () => {
    assert.equal(getCanonicalState('Orissa'), 'Odisha');
    assert.equal(getCanonicalState('pondicherry'), 'Puducherry');
    assert.equal(getCanonicalState('J&K'), 'Jammu and Kashmir');
    assert.equal(getCanonicalDistrict('Karnataka', 'Bangalore'), 'Bengaluru Urban');
    assert.equal(getCanonicalDistrict('Karnataka', 'Mysore'), 'Mysuru');
    assert.equal(getCanonicalDistrict('Haryana', 'Gurgaon'), 'Gurugram');
    assert.equal(getCanonicalDistrict('Uttar Pradesh', 'Allahabad'), 'Prayagraj');
    assert.equal(getCanonicalDistrict('Maharashtra', 'Bombay'), 'Mumbai City');
  });

  // =========================================================================
  // 3. REGISTRATION BACKEND VALIDATION ENFORCEMENT
  // =========================================================================
  await t.test('11. Rejects citizen registration with non-existent Indian state (400)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Invalid State Test',
        email: getUniqueEmail('invstate'),
        phone: getUniquePhone(10),
        password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!',
        state: 'Wonderland',
        district: 'Bengaluru Urban',
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(
      (body.error && body.error.toLowerCase().includes('state')) ||
        (body.details && JSON.stringify(body.details).toLowerCase().includes('state'))
    );
  });

  await t.test('12. Rejects citizen registration when district does not belong to state (400)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Mismatch District Test',
        email: getUniqueEmail('mismatch'),
        phone: getUniquePhone(20),
        password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Pune', // Mismatch: Pune is in Maharashtra!
        ulb: 'BBMP',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(
      (body.error && body.error.includes('District does not belong to the selected State')) ||
        (body.details &&
          JSON.stringify(body.details).includes(
            'District does not belong to the selected State'
          ))
    );
  });

  await t.test('13. Rejects citizen registration with invalid PIN code length/format (400)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Bad Pin Test',
        email: getUniqueEmail('badpin'),
        phone: getUniquePhone(30),
        password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '56003', // 5 digits only!
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(
      (body.error && body.error.toLowerCase().includes('pin code')) ||
        (body.details && JSON.stringify(body.details).toLowerCase().includes('pin code'))
    );
  });

  await t.test('14. Accepts registration with valid state, matching district, and 6-digit PIN', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Valid Geo Citizen',
        email: getUniqueEmail('validgeo'),
        phone: getUniquePhone(40),
        password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)',
        locality: 'Indiranagar',
        street: '100 Feet Road',
        pin_code: '560038',
        house_number: 'Flat 101',
        landmark: 'Near Metro',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.registration_id);
    assert.ok(body.email_masked);
    assert.ok(body.phone_masked);
  });

  // =========================================================================
  // 4. RATE LIMITING & MOCKED UPSTREAM POSTAL LOOKUP TESTS (PHASE 1 INTEGRITY)
  // =========================================================================
  await t.test('15. Geo postal lookup endpoint enforces rate limiting', async () => {
    const headers = { 'x-test-rate-limit': 'true' };
    await fetch(`${baseUrl}/geo/pincode/560038`, { headers });
    await fetch(`${baseUrl}/geo/pincode/560038`, { headers });
    await fetch(`${baseUrl}/geo/pincode/560038`, { headers });
    const res = await fetch(`${baseUrl}/geo/pincode/560038`, { headers });
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Too many postal lookup requests'));
  });

  await t.test('16.1 Valid postal API response with one post office returns 200 unambiguous', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          Status: 'Success',
          PostOffice: [
            { Name: 'Vasant Vihar', State: 'Delhi', District: 'New Delhi' },
          ],
        },
      ],
    }));

    const res = await fetch(`${baseUrl}/geo/pincode/110057`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.pincode, '110057');
    assert.equal(body.state, 'Delhi');
    assert.equal(body.district, 'New Delhi');
    assert.deepEqual(body.postOffices, ['Vasant Vihar']);
    assert.equal(body.conflicting, false);
    assert.ok(dynamicPinCache.get('110057'), 'Valid result must be cached in dynamicPinCache');
  });

  await t.test('16.2 Valid response with multiple post offices in the same district de-duplicates and sorts', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          Status: 'Success',
          PostOffice: [
            { Name: 'Indiranagar', State: 'Karnataka', District: 'Bengaluru Urban' },
            { Name: 'HAL II Stage', State: 'Karnataka', District: 'Bengaluru Urban' },
            { Name: 'Indiranagar', State: 'Karnataka', District: 'Bengaluru Urban' }, // Duplicate
          ],
        },
      ],
    }));

    const res = await fetch(`${baseUrl}/geo/pincode/560038`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.state, 'Karnataka');
    assert.equal(body.district, 'Bengaluru Urban');
    assert.deepEqual(body.postOffices, ['HAL II Stage', 'Indiranagar']);
    assert.equal(body.conflicting, false);
  });

  await t.test('16.3 Response containing multiple districts marks conflicting and clears district', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          Status: 'Success',
          PostOffice: [
            { Name: 'Noida Sub PO', State: 'Uttar Pradesh', District: 'Gautam Buddha Nagar' },
            { Name: 'Ghaziabad Sub PO', State: 'Uttar Pradesh', District: 'Ghaziabad' },
          ],
        },
      ],
    }));

    const res = await fetch(`${baseUrl}/geo/pincode/201301`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.state, 'Uttar Pradesh');
    assert.equal(body.district, null, 'Conflicting districts must not arbitrarily select one');
    assert.equal(body.conflicting, true);
    assert.deepEqual(body.conflictingDistricts, ['Gautam Buddha Nagar', 'Ghaziabad']);
    assert.deepEqual(body.postOffices, ['Ghaziabad Sub PO', 'Noida Sub PO']);
  });

  await t.test('16.4 Response containing conflicting states marks conflicting and clears state & district', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          Status: 'Success',
          PostOffice: [
            { Name: 'Badarpur Border', State: 'Delhi', District: 'South Delhi' },
            { Name: 'Faridabad Border', State: 'Haryana', District: 'Faridabad' },
          ],
        },
      ],
    }));

    const res = await fetch(`${baseUrl}/geo/pincode/110044`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.state, null, 'Conflicting states must not arbitrarily select one');
    assert.equal(body.district, null);
    assert.equal(body.conflicting, true);
    assert.deepEqual(body.conflictingStates, ['Delhi', 'Haryana']);
  });

  await t.test('16.5 Invalid PIN / empty PostOffice result returns 404', async () => {
    dynamicPinCache.clear();
    // 5a. India Post Status: Error
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ Status: 'Error', Message: 'No records found' }],
    }));

    const res1 = await fetch(`${baseUrl}/geo/pincode/999999`);
    assert.equal(res1.status, 404);
    const body1 = await res1.json();
    assert.equal(body1.success, false);
    assert.ok(body1.error.includes('PIN code not found in postal directory'));

    // 5b. Empty PostOffice array
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ Status: 'Success', PostOffice: [] }],
    }));

    const res2 = await fetch(`${baseUrl}/geo/pincode/999998`);
    assert.equal(res2.status, 404);
    const body2 = await res2.json();
    assert.equal(body2.success, false);
    assert.ok(body2.error.includes('No postal offices found'));
  });

  await t.test('16.6 Upstream HTTP error returns 502 Bad Gateway', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    }));

    const res = await fetch(`${baseUrl}/geo/pincode/560002`);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Postal lookup service returned an error'));
  });

  await t.test('16.7 Network failure returns 503 Service Unavailable', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => {
      const err = new Error('getaddrinfo ENOTFOUND api.postalpincode.in');
      err.code = 'ENOTFOUND';
      throw err;
    });

    const res = await fetch(`${baseUrl}/geo/pincode/560003`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.networkUnavailable, true);
    assert.ok(body.error.includes('Postal lookup service unavailable'));
  });

  await t.test('16.8 3500 ms timeout or abort returns 503 Service Unavailable', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });

    const res = await fetch(`${baseUrl}/geo/pincode/560004`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.networkUnavailable, true);
    assert.ok(body.error.includes('Postal lookup service unavailable'));
  });

  await t.test('16.9 Malformed JSON returns 502 Bad Gateway', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }));

    const res = await fetch(`${baseUrl}/geo/pincode/560005`);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Invalid response from postal lookup service'));
  });

  await t.test('16.10 Missing or malformed response fields handled safely (502 or 404)', async () => {
    dynamicPinCache.clear();
    // 10a. Non-array response
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ invalid: true }),
    }));
    const res1 = await fetch(`${baseUrl}/geo/pincode/560006`);
    assert.equal(res1.status, 502);

    // 10b. Post offices with null/invalid entries filtered; if all invalid, 404
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          Status: 'Success',
          PostOffice: [null, { Name: '' }, { MissingName: true }],
        },
      ],
    }));
    const res2 = await fetch(`${baseUrl}/geo/pincode/560007`);
    assert.equal(res2.status, 404);
  });

  await t.test('16.11 Ensure no failed or malformed result is cached in dynamicPinCache', async () => {
    dynamicPinCache.clear();

    // Trigger failure
    setPostalFetch(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await fetch(`${baseUrl}/geo/pincode/777888`);
    assert.equal(dynamicPinCache.get('777888'), null, 'Failed 502/503 response must not be cached');

    // Trigger 404
    setPostalFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ Status: 'Error', Message: 'No records found' }],
    }));
    await fetch(`${baseUrl}/geo/pincode/777889`);
    assert.equal(dynamicPinCache.get('777889'), null, '404 not-found response must not be cached');
  });

  await t.test('16.12 Ensure no network failure produces a successful estimated state (No Prefix Fallback)', async () => {
    dynamicPinCache.clear();
    setPostalFetch(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    // Test with PINs whose prefixes match historical prefix patterns (e.g. 11 = Delhi, 56 = Karnataka)
    const resDelhi = await fetch(`${baseUrl}/geo/pincode/110001`);
    assert.equal(resDelhi.status, 503);
    const bodyDelhi = await resDelhi.json();
    assert.equal(bodyDelhi.success, false);
    assert.equal(bodyDelhi.state, undefined, 'Must not estimate Delhi from prefix 11 on network failure');

    const resBlr = await fetch(`${baseUrl}/geo/pincode/560001`);
    assert.equal(resBlr.status, 503);
    const bodyBlr = await resBlr.json();
    assert.equal(bodyBlr.success, false);
    assert.equal(bodyBlr.state, undefined, 'Must not estimate Karnataka from prefix 56 on network failure');
  });

  // =========================================================================
  // 5. AI-ASSISTED LOCALITY ASSESSMENT ENDPOINT
  // =========================================================================
  await t.test('17. POST /api/geo/check-locality validates mandatory fields', async () => {
    const res = await fetch(`${baseUrl}/geo/check-locality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locality: '' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  await t.test('18. POST /api/geo/check-locality matches cached postal locality immediately as postal_matched', async () => {
    dynamicPinCache.set('560038', {
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      postOffices: ['Indiranagar', 'HAL II Stage'],
    });

    const res = await fetch(`${baseUrl}/geo/check-locality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'Indiranagar',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        pin_code: '560038',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.assessment.status, 'plausible');
    assert.equal(body.verification_level, 'postal_matched');
    assert.equal(body.assessment.confidence, 1.0);
  });

  await t.test('19. POST /api/geo/check-locality evaluates plausible manual locality using Gemini', async () => {
    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            status: 'plausible',
            message: 'Defence Colony is a known residential layout in Indiranagar, Bengaluru.',
            suggested_correction: null,
            confidence: 0.92,
          }),
        }),
      },
    });

    const res = await fetch(`${baseUrl}/geo/check-locality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'Defence Colony',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        pin_code: '560038',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.assessment.status, 'plausible');
    assert.equal(body.verification_level, 'ai_assessed');
    assert.equal(body.assessment.confidence, 0.92);
  });

  await t.test('20. POST /api/geo/check-locality detects possible regional mismatch', async () => {
    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            status: 'possible_mismatch',
            message: 'Connaught Place is an iconic commercial hub located in New Delhi, not Bengaluru.',
            suggested_correction: null,
            confidence: 0.98,
          }),
        }),
      },
    });

    const res = await fetch(`${baseUrl}/geo/check-locality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'Connaught Place',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        pin_code: '560038',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.assessment.status, 'possible_mismatch');
    assert.equal(body.verification_level, 'manual_unverified');
  });

  await t.test('21. POST /api/geo/check-locality handles spelling variation with suggested correction', async () => {
    setGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            status: 'plausible',
            message: 'Plausible locality with slight spelling correction.',
            suggested_correction: 'Defence Colony',
            confidence: 0.88,
          }),
        }),
      },
    });

    const res = await fetch(`${baseUrl}/geo/check-locality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'Defenc Colny',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        pin_code: '560038',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.assessment.suggested_correction, 'Defence Colony');
    assert.equal(body.verification_level, 'ai_assessed');
  });

  await t.test('22. POST /api/geo/check-locality gracefully falls back on Gemini timeout or malformed response', async () => {
    setGeminiClient({
      models: {
        generateContent: async () => {
          const err = new Error('Request timed out');
          err.name = 'TimeoutError';
          throw err;
        },
      },
    });

    const res = await fetch(`${baseUrl}/geo/check-locality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locality: 'Some Village',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        pin_code: '560038',
      }),
    });

    // Does not fail with 500; returns 200 with insufficient_information and unblocked manual entry
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.assessment.status, 'insufficient_information');
    assert.equal(body.verification_level, 'manual_unverified');
  });

  await t.test('23. POST /api/geo/check-locality enforces strict rate limiting', async () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-test-rate-limit': 'true',
    };
    const payload = JSON.stringify({
      locality: 'Indiranagar',
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      pin_code: '560038',
    });

    await fetch(`${baseUrl}/geo/check-locality`, { method: 'POST', headers, body: payload });
    await fetch(`${baseUrl}/geo/check-locality`, { method: 'POST', headers, body: payload });
    const res = await fetch(`${baseUrl}/geo/check-locality`, { method: 'POST', headers, body: payload });

    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Too many locality assessment requests'));
  });

  // =========================================================================
  // 6. SERVER-SIDE VERIFICATION STATUS INTEGRITY & ANTI-SPOOFING
  // =========================================================================
  await t.test('24. Server determines authoritative ULB and Locality verification status and prevents frontend spoofing', async () => {
    const email = getUniqueEmail('verifcheck');
    const phone = getUniquePhone(50);

    // Frontend attempts to spoof `postal_matched` for an unlisted custom locality and custom ULB
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Anti Spoof Citizen',
        email,
        phone,
        password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'Completely Custom Town Council', // Custom, not in LGD
        locality: 'Unknown Fantasy Colony',    // Custom, not in postal records
        street: 'Random Road',
        pin_code: '560038',
        locality_verification_level: 'postal_matched', // SPOOF ATTEMPT
        ulb_verification_status: 'VERIFIED',          // SPOOF ATTEMPT
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    const regId = body.registration_id;

    // Inspect pending registration record in database directly
    const pending = db.prepare('SELECT * FROM citizen_pending_registrations WHERE id = ?').get(regId);
    assert.ok(pending);
    // Server must have rejected spoofed values and assigned real verification levels:
    assert.equal(pending.ulb_verification_status, 'CUSTOM');
    assert.equal(pending.locality_verification_level, 'manual_unverified');
  });

  await t.test('25. Dual verification transfers server-verified levels into active users table', async () => {
    const email = getUniqueEmail('activeverif');
    const phone = getUniquePhone(60);

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        full_name: 'Active Verified Citizen',
        email,
        phone,
        password: 'ValidPassword123!',
        confirm_password: 'ValidPassword123!',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        ulb: 'Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)', // Recognized!
        locality: 'Indiranagar', // Matches postal records for 560038!
        street: '100 Feet Road',
        pin_code: '560038',
      }),
    });

    assert.equal(regRes.status, 200);
    const regBody = await regRes.json();
    const regId = regBody.registration_id;

    // Verify OTP hashes in pending table
    const pending = db.prepare('SELECT * FROM citizen_pending_registrations WHERE id = ?').get(regId);
    assert.equal(pending.ulb_verification_status, 'VERIFIED');
    assert.equal(pending.locality_verification_level, 'postal_matched');

    // Manually set known OTPs for verification
    const testOtp = '882211';
    const testHash = hashOtp(testOtp);
    db.prepare('UPDATE citizen_pending_registrations SET email_otp_hash = ?, mobile_otp_hash = ? WHERE id = ?').run(
      testHash,
      testHash,
      regId
    );

    const verifyRes = await fetch(`${baseUrl}/auth/register/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        registration_id: regId,
        email_otp: testOtp,
        mobile_otp: testOtp,
      }),
    });

    assert.equal(verifyRes.status, 201);

    // Verify user record in users table
    const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
    assert.ok(user);
    assert.equal(user.ulb_verification_status, 'VERIFIED');
    assert.equal(user.locality_verification_level, 'postal_matched');
  });

  // =========================================================================
  // 7. CLIENT & SERVER GEOGRAPHY DATASET SYNCHRONIZATION PARITY
  // =========================================================================
  await t.test('26. Client and Server geography datasets are identical and in sync', () => {
    const serverPath = path.resolve(__dirname, '../src/utils/indiaGeoData.js');
    const clientPath = path.resolve(__dirname, '../../client/src/utils/indiaGeoData.js');

    assert.ok(fs.existsSync(serverPath), 'Server indiaGeoData.js must exist');
    assert.ok(fs.existsSync(clientPath), 'Client indiaGeoData.js must exist');

    const serverContent = fs.readFileSync(serverPath, 'utf8');
    const clientContent = fs.readFileSync(clientPath, 'utf8');

    assert.equal(
      serverContent,
      clientContent,
      'Client and Server indiaGeoData.js must be identical and synchronized'
    );
  });
});
