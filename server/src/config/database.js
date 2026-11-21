import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data and upload directories exist
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
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
