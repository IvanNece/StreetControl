/**
 * Federation Model
 * 
 * Database operations for federations (organizations that manage meets)
 * Table: federations
 */

import { get, all, run } from '../config/database-local.js';
import bcrypt from 'bcrypt';

class Federation {
  /**
   * Create a new federation
   * @param {Object} data - Federation data
   * @returns {Promise<Object>} Created federation with ID
   */
  static async create(data) {
    const { username, password } = data;
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    const sql = `
      INSERT INTO federations (username, password_hash)
      VALUES (?, ?)
    `;
    
    const result = await run(sql, [username, password_hash]);
    
    return {
      id: result.lastID,
      username,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Find federation by ID
   * @param {number} id - Federation ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = 'SELECT id, username, created_at FROM federations WHERE id = ?';
    return await get(sql, [id]);
  }

  /**
   * Find federation by username
   * @param {string} username - Federation username
   * @returns {Promise<Object|null>}
   */
  static async findByUsername(username) {
    const sql = 'SELECT * FROM federations WHERE username = ?';
    return await get(sql, [username]);
  }

  /**
   * Get all federations
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const sql = 'SELECT id, username, created_at FROM federations ORDER BY username';
    return await all(sql);
  }

  /**
   * Update federation password
   * @param {number} id - Federation ID
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>}
   */
  static async updatePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 10);
    
    const sql = 'UPDATE federations SET password_hash = ? WHERE id = ?';
    const result = await run(sql, [password_hash, id]);
    
    return result.changes > 0;
  }

  /**
   * Verify password
   * @param {string} username - Federation username
   * @param {string} password - Password to verify
   * @returns {Promise<Object|null>} Federation object if password is correct, null otherwise
   */
  static async verifyPassword(username, password) {
    const federation = await this.findByUsername(username);
    
    if (!federation) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, federation.password_hash);
    
    if (!isValid) {
      return null;
    }
    
    // Return federation without password hash
    const { password_hash, ...federationData } = federation;
    return federationData;
  }

  /**
   * Delete federation
   * @param {number} id - Federation ID
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const sql = 'DELETE FROM federations WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes > 0;
  }

  /**
   * Count meets for a federation
   * @param {number} federationId - Federation ID
   * @returns {Promise<number>}
   */
  static async countMeets(federationId) {
    const sql = 'SELECT COUNT(*) as count FROM meets WHERE federation_id = ?';
    const row = await get(sql, [federationId]);
    return row ? row.count : 0;
  }
}

export default Federation;
