
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

const suites = [
  'auth.test.js',
  'complaintSubmission.test.js',
  'officialAdminPortals.test.js',
  'complaintAnalysis.test.js',
  'multimodalComplaintAnalysis.test.js',
  'citizenAuthEnhancements.test.js',
  'registrationSecurityStage1.test.js',
  'geoAddressValidation.test.js',
  'geminiService.test.js',
  'semanticDuplicateDetection.test.js',
  'historicalCivicIntelligence.test.js',
  'departmentRouting.test.js',
  'multilingualComplaintProcessing.test.js',
  'liveGeoTaggedEvidence.test.js',
];

for (const suite of suites) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'civicmemory-test-')
  );

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_PATH: path.join(tempDir, 'civicmemory.test.db'),
    UPLOAD_DIR: path.join(tempDir, 'uploads'),
    STORAGE_DIR: path.join(tempDir, 'storage'),
    PROTECTED_UPLOAD_DIR: path.join(tempDir, 'storage', 'evidence'),
  };

  console.log(`\n=== Preparing isolated environment for ${suite} ===`);

  try {
    // Seed the isolated database before loading the test suite.
    const seed = spawnSync(
      process.execPath,
      ['src/db/seed.js'],
      { cwd: serverDir, env, stdio: 'inherit' }
    );

    if (seed.status !== 0) {
      throw new Error(`Seeding failed for ${suite}`);
    }

    const test = spawnSync(
      process.execPath,
      [`tests/${suite}`],
      { cwd: serverDir, env, stdio: 'inherit' }
    );

    if (test.status !== 0) {
      throw new Error(`${suite} failed`);
    }

    console.log(`=== ${suite} passed ===`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

console.log('\nAll isolated test suites passed.');
