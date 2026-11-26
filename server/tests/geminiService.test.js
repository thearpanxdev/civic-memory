import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateGeminiText,
  extractStatusCode,
  isTimeoutError,
  sanitizeErrorMessage,
} from '../src/services/geminiService.js';

/**
 * CivicMemory — Automated Gemini Service Test Suite
 *
 * NOTE: All tests in this file strictly mock the Gemini client.
 * No real API requests are made and zero quota is consumed.
 * Live API connectivity is maintained separately in tests/geminiConnectivity.manual.js.
 */

test('Gemini Service — Status code extraction utility', () => {
  assert.equal(extractStatusCode({ status: 503 }), 503);
  assert.equal(extractStatusCode({ statusCode: 429 }), 429);
  assert.equal(extractStatusCode({ code: 404 }), 404);
  assert.equal(extractStatusCode({ error: { code: 400 } }), 400);
  assert.equal(
    extractStatusCode(new Error('{"error":{"code":503,"message":"high demand"}}')),
    503
  );
  assert.equal(
    extractStatusCode(new Error('Fetch failed with status 429 Too Many Requests')),
    429
  );
  assert.equal(extractStatusCode(new Error('Random unclassified network failure')), null);
});

test('Gemini Service — Timeout error detection helper', () => {
  const abortErr = new Error('This operation was aborted');
  abortErr.name = 'AbortError';
  assert.equal(isTimeoutError(abortErr), true);

  const timeoutErr = new Error('Request timed out');
  timeoutErr.name = 'TimeoutError';
  assert.equal(isTimeoutError(timeoutErr), true);

  const netTimeoutErr = new Error('Connection timeout');
  netTimeoutErr.code = 'ETIMEDOUT';
  assert.equal(isTimeoutError(netTimeoutErr), true);

  const standardErr = new Error('Invalid JSON payload');
  assert.equal(isTimeoutError(standardErr), false);
});

test('Gemini Service — Configurable request timeout handling with SDK options', async () => {
  let capturedConfig = null;
  const mockClient = {
    models: {
      generateContent: async ({ config }) => {
        capturedConfig = config;
        const err = new Error('This operation was aborted');
        err.name = 'AbortError';
        throw err;
      },
    },
  };

  const configuredTimeoutMs = 2500;

  await assert.rejects(
    async () => {
      await generateGeminiText('Summarize this civic issue', {
        client: mockClient,
        timeoutMs: configuredTimeoutMs,
      });
    },
    (err) => {
      assert.match(err.message, /Gemini API request timed out after 2500ms/);
      return true;
    }
  );

  // Verify the timeout was forwarded to @google/genai httpOptions
  assert.ok(capturedConfig, 'generateContent must receive a configuration object');
  assert.equal(
    capturedConfig?.httpOptions?.timeout,
    configuredTimeoutMs,
    'httpOptions.timeout must match configured timeoutMs'
  );
});

test('Gemini Service — Non-retryable errors fail immediately on first attempt without retry', async () => {
  const nonRetryableCodes = [400, 401, 403, 404];

  for (const statusCode of nonRetryableCodes) {
    let callCount = 0;
    const mockClient = {
      models: {
        generateContent: async () => {
          callCount++;
          const err = new Error(`Permanent error with status ${statusCode}`);
          err.status = statusCode;
          throw err;
        },
      },
    };

    await assert.rejects(
      async () => {
        await generateGeminiText('Categorize complaint', {
          client: mockClient,
          maxRetries: 3,
          initialDelayMs: 10,
        });
      },
      (err) => {
        assert.match(err.message, new RegExp(`non-retryable status ${statusCode}`));
        return true;
      }
    );

    // Strictly 1 attempt, zero retries
    assert.equal(callCount, 1, `Status ${statusCode} should not trigger any retries`);
  }
});

test('Gemini Service — Retries on transient HTTP 503 and succeeds on subsequent attempt', async () => {
  let callCount = 0;
  const mockClient = {
    models: {
      generateContent: async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('{"error":{"code":503,"message":"This model is experiencing high demand."}}');
          err.status = 503;
          throw err;
        }
        return { text: 'Suggested Category: Roads and Infrastructure' };
      },
    },
  };

  const result = await generateGeminiText('Damaged asphalt on 4th cross road', {
    client: mockClient,
    maxRetries: 2,
    initialDelayMs: 10,
    maxDelayMs: 50,
  });

  assert.equal(result, 'Suggested Category: Roads and Infrastructure');
  assert.equal(callCount, 2, 'Should succeed on attempt 2 after initial 503 failure');
});

test('Gemini Service — Retries on transient HTTP 429 and succeeds on subsequent attempt', async () => {
  let callCount = 0;
  const mockClient = {
    models: {
      generateContent: async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Resource exhausted / quota rate limit reached');
          err.status = 429;
          throw err;
        }
        return { text: 'Suggested Department: Sanitation and Waste Management' };
      },
    },
  };

  const result = await generateGeminiText('Overflowing community garbage bin', {
    client: mockClient,
    maxRetries: 2,
    initialDelayMs: 10,
    maxDelayMs: 50,
  });

  assert.equal(result, 'Suggested Department: Sanitation and Waste Management');
  assert.equal(callCount, 2, 'Should succeed on attempt 2 after initial 429 failure');
});

test('Gemini Service — Retry exhaustion: fails after max retries when 503 persists', async () => {
  let callCount = 0;
  const mockClient = {
    models: {
      generateContent: async () => {
        callCount++;
        const err = new Error('Backend service unavailable');
        err.status = 503;
        throw err;
      },
    },
  };

  await assert.rejects(
    async () => {
      await generateGeminiText('Persistent sewer leakage', {
        client: mockClient,
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });
    },
    (err) => {
      assert.match(err.message, /failed after 3 attempt\(s\) \[Status: 503\]/);
      return true;
    }
  );

  // 1 initial attempt + 2 retries = 3 total attempts
  assert.equal(callCount, 3, 'Must attempt exactly maxRetries + 1 times before failing');
});

test('Gemini Service — Privacy & Security: Errors never expose API key or raw complaint descriptions', async () => {
  const sensitiveComplaintDescription = 'Citizen John Doe (Phone: +91-9876543210, Address: Flat 402, Lotus Apts) reports severe sewage burst';
  const fakeSecretKey = 'AIzaSyFakeSecretKeyPatternHere12345';

  const mockClient = {
    models: {
      generateContent: async () => {
        const err = new Error(`Google API backend rejected key ${fakeSecretKey} for request`);
        err.status = 503;
        throw err;
      },
    },
  };

  await assert.rejects(
    async () => {
      await generateGeminiText(sensitiveComplaintDescription, {
        client: mockClient,
        maxRetries: 1,
        initialDelayMs: 10,
        maxDelayMs: 20,
      });
    },
    (err) => {
      // 1. Ensure API key is scrubbed
      assert.doesNotMatch(err.message, /AIzaSyFakeSecretKeyPatternHere12345/);
      assert.match(err.message, /\[REDACTED_API_KEY\]/);

      // 2. Ensure raw complaint description is not leaked into the thrown error
      assert.doesNotMatch(err.message, /John Doe/);
      assert.doesNotMatch(err.message, /9876543210/);
      assert.doesNotMatch(err.message, /Lotus Apts/);

      return true;
    }
  );
});
