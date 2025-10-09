/**
 * SQLite Local Database Configuration
 * 
 * Provides singleton connection to local SQLite database with helper methods
 */

import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get database path from environment or use default
const DB_PATH = process.env.DATABASE_LOCAL_PATH 
  ? join(process.cwd(), process.env.DATABASE_LOCAL_PATH)
  : join(__dirname, '../../data/street_control.db');

// Singleton database instance
let dbInstance = null;

/**
 * Get database connection (singleton)
 */
export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error connecting to local database:', err.message);
        throw err;
      }
      console.log('✅ Connected to local SQLite database');
      
      // Enable foreign keys and WAL mode
      dbInstance.run('PRAGMA foreign_keys = ON');
      dbInstance.run('PRAGMA journal_mode = WAL');
    });
  }
  return dbInstance;
}

/**
 * Query helper - Get single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object|null>}
 */
export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

/**
 * Query helper - Get multiple rows
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Query helper - Execute statement (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters
 * @returns {Promise<{lastID: number, changes: number}>}
 */
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      }
    });
  });
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
      dbInstance = null;
    });
  }
}

/**
 * Check if database is connected
 */
export function isConnected() {
  return dbInstance !== null;
}

// Export database instance for advanced use cases
export { dbInstance };
