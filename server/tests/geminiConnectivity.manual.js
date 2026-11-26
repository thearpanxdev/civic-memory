import { generateGeminiText } from '../src/services/geminiService.js';
import { config } from '../src/config/env.js';

/**
 * CivicMemory — Manual Live Gemini API Connectivity Verification
 *
 * Usage:
 *   node tests/geminiConnectivity.manual.js
 *
 * NOTE: This is a standalone manual script that communicates directly with
 * Google's Gemini Developer API. It is separated from automated test runs
 * to prevent quota consumption and ensure offline test reliability.
 */
async function runManualConnectivityCheck() {
  console.log('====================================================================');
  console.log('CivicMemory — Manual Gemini Live Connectivity Verification');
  console.log('====================================================================');

  if (!config.geminiApiKey) {
    console.error('ERROR: GEMINI_API_KEY is not configured in server/.env');
    process.exit(1);
  }

  console.log(`[Config] Model: ${config.geminiModel}`);
  console.log(`[Config] Timeout: ${config.geminiTimeoutMs}ms`);
  console.log(`[Config] API Key Configured: ${Boolean(config.geminiApiKey && config.geminiApiKey.length > 5)}`);
  console.log('\nSending test prompt to Gemini API ("Respond with the single word PONG.")...');

  const startTime = Date.now();
  try {
    const response = await generateGeminiText('Respond with the single word PONG.', {
      timeoutMs: config.geminiTimeoutMs,
    });
    const elapsedMs = Date.now() - startTime;

    console.log('\n--- Connectivity Result ---');
    console.log(`Status: SUCCESS`);
    console.log(`Duration: ${elapsedMs}ms`);
    console.log(`Raw Response: "${response.trim()}"`);

    if (response.toUpperCase().includes('PONG')) {
      console.log('Verification: PASS (Response matches expected "PONG" token)');
      console.log('====================================================================');
      process.exit(0);
    } else {
      console.warn('Verification: WARNING (Unexpected response text received)');
      console.log('====================================================================');
      process.exit(0);
    }
  } catch (err) {
    const elapsedMs = Date.now() - startTime;
    console.error('\n--- Connectivity Result ---');
    console.error(`Status: FAILED after ${elapsedMs}ms`);
    console.error(`Error: ${err.message}`);
    console.log('====================================================================');
    process.exit(1);
  }
}

runManualConnectivityCheck();
