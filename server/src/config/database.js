import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data, upload, and protected storage directories exist
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

if (!fs.existsSync(config.storageDir)) {
  fs.mkdirSync(config.storageDir, { recursive: true });
}

if (!fs.existsSync(config.protectedUploadDir)) {
  fs.mkdirSync(config.protectedUploadDir, { recursive: true });
}

// Initialize Native Node.js SQLite Database connection
const db = new DatabaseSync(config.dbPath);

// Enable foreign keys and WAL mode
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize schema and apply non-destructive column migrations
export function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    // 1. If complaints table already exists, ensure new columns are present before executing index statements
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='complaints'").get();
    if (tableExists) {
      const columns = db.prepare('PRAGMA table_info(complaints)').all().map((c) => c.name);
      if (!columns.includes('ward_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN ward_id TEXT;');
      }
      if (!columns.includes('duplicate_of_id')) {
        db.exec('ALTER TABLE complaints ADD COLUMN duplicate_of_id TEXT;');
      }
      if (!columns.includes('relation_type')) {
        db.exec("ALTER TABLE complaints ADD COLUMN relation_type TEXT DEFAULT 'standalone';");
      }
    }

    // Ensure complaint_images table has metadata columns for secure uploads
    const imagesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='complaint_images'").get();
    if (imagesTableExists) {
      const imgColumns = db.prepare('PRAGMA table_info(complaint_images)').all().map((c) => c.name);
      if (!imgColumns.includes('file_name')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN file_name TEXT;');
      }
      if (!imgColumns.includes('file_path')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN file_path TEXT;');
      }
      if (!imgColumns.includes('mime_type')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN mime_type TEXT;');
      }
      if (!imgColumns.includes('file_size')) {
        db.exec('ALTER TABLE complaint_images ADD COLUMN file_size INTEGER;');
      }
    }

    // 2. Execute full schema SQL
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);

    console.log('[CivicMemory DB] Database schema and indexes verified using native node:sqlite.');
  } else {
    console.warn('[CivicMemory DB] schema.sql not found at:', schemaPath);
  }
  return db;
}

export default db;
