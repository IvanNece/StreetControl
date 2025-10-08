/**
 * Initialize Local SQLite Database
 * 
 * Creates and initializes the local SQLite database with schema
 * Run with: npm run init-db
 */

import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/street_control.db');
const SCHEMA_PATH = join(__dirname, 'local/init_local_schema.sql');

/**
 * Initialize local SQLite database
 */
async function initLocalDatabase() {
  return new Promise((resolve, reject) => {
    console.log('🗄️  Initializing local SQLite database...\n');

    // Ensure data directory exists
    const dataDir = dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Remove existing database if present
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }

    // Read schema file
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

    // Create new database
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error creating database:', err);
        return reject(err);
      }

      console.log('✅ Database file created');

      // Execute schema (split by semicolon for multiple statements)
      db.exec(schema, (err) => {
        if (err) {
          console.error('❌ Error executing schema:', err);
          db.close();
          return reject(err);
        }

        console.log('Schema executed successfully!');
        console.log('Database initialized at:', DB_PATH);
        console.log('\nNext steps:');
        console.log('   1. Run "npm run seed" to populate with test data');
        console.log('   2. Run "npm run dev" to start the server\n');

        db.close();
        resolve();
      });
    });
  });
}

// Run initialization
initLocalDatabase().catch(err => {
  console.error('❌ Initialization failed:', err);
  process.exit(1);
});
