/**
 * Judge Model
 * 
 * Database operations for judges
 * Table: judges
 */

import { get, all, run } from '../config/database-local.js';

class Judge {
  /**
   * Create new judge
   * @param {Object} data - Judge data
   * @returns {Promise<number>} Created judge ID
   */
  static async create(data) {
    const sql = `
      INSERT INTO judges (
        name, surname, role, federation_id, 
        membership_code, email, phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.name,
      data.surname,
      data.role || 'JUDGE',
      data.federation_id || null,
      data.membership_code || null,
      data.email || null,
      data.phone || null
    ]);
    
    return result.lastID;
  }

  /**
   * Find judge by ID
   * @param {number} id - Judge ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT 
        j.*,
        f.name as federation_name,
        f.abbrev as federation_abbrev
      FROM judges j
      LEFT JOIN federations f ON j.federation_id = f.id
      WHERE j.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Get all judges
   * @param {string} role - Optional: filter by role
   * @returns {Promise<Array>}
   */
  static async findAll(role = null) {
    let sql = `
      SELECT 
        j.*,
        f.name as federation_name,
        f.abbrev as federation_abbrev
      FROM judges j
      LEFT JOIN federations f ON j.federation_id = f.id
    `;
    
    const params = [];
    if (role) {
      sql += ' WHERE j.role = ?';
      params.push(role);
    }
    
    sql += ' ORDER BY j.surname, j.name';
    return await all(sql, params);
  }

  /**
   * Find judge by membership code
   * @param {string} code - Membership code
   * @returns {Promise<Object|null>}
   */
  static async findByMembershipCode(code) {
    const sql = `
      SELECT 
        j.*,
        f.name as federation_name,
        f.abbrev as federation_abbrev
      FROM judges j
      LEFT JOIN federations f ON j.federation_id = f.id
      WHERE j.membership_code = ?
    `;
    return await get(sql, [code]);
  }

  /**
   * Search judges by name/surname
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  static async search(query) {
    const sql = `
      SELECT 
        j.*,
        f.name as federation_name
      FROM judges j
      LEFT JOIN federations f ON j.federation_id = f.id
      WHERE LOWER(j.name) LIKE LOWER(?) 
         OR LOWER(j.surname) LIKE LOWER(?)
         OR LOWER(j.membership_code) LIKE LOWER(?)
      ORDER BY j.surname, j.name
    `;
    const searchPattern = `%${query}%`;
    return await all(sql, [searchPattern, searchPattern, searchPattern]);
  }

  /**
   * Find judges by federation
   * @param {number} federationId - Federation ID
   * @returns {Promise<Array>}
   */
  static async findByFederation(federationId) {
    const sql = `
      SELECT j.*
      FROM judges j
      WHERE j.federation_id = ?
      ORDER BY j.surname, j.name
    `;
    return await all(sql, [federationId]);
  }

  /**
   * Update judge
   * @param {number} id - Judge ID
   * @param {Object} data - Updated data
   * @returns {Promise<number>} Number of rows affected
   */
  static async update(id, data) {
    const sql = `
      UPDATE judges SET
        name = ?,
        surname = ?,
        role = ?,
        federation_id = ?,
        membership_code = ?,
        email = ?,
        phone = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.name,
      data.surname,
      data.role,
      data.federation_id || null,
      data.membership_code || null,
      data.email || null,
      data.phone || null,
      id
    ]);
    
    return result.changes;
  }

  /**
   * Delete judge
   * @param {number} id - Judge ID
   * @returns {Promise<number>} Number of rows affected
   */
  static async delete(id) {
    const sql = 'DELETE FROM judges WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes;
  }

  /**
   * Verify judge credentials (for authentication)
   * @param {string} membershipCode - Membership code
   * @returns {Promise<Object|null>} Judge if valid, null otherwise
   */
  static async verifyCredentials(membershipCode) {
    return await this.findByMembershipCode(membershipCode);
  }

  /**
   * Check if judge exists
   * @param {number} id - Judge ID
   * @returns {Promise<boolean>}
   */
  static async exists(id) {
    const sql = 'SELECT COUNT(*) as count FROM judges WHERE id = ?';
    const result = await get(sql, [id]);
    return result.count > 0;
  }

  /**
   * Count judges by role
   * @param {string} role - Judge role
   * @returns {Promise<number>}
   */
  static async countByRole(role) {
    const sql = 'SELECT COUNT(*) as count FROM judges WHERE role = ?';
    const result = await get(sql, [role]);
    return result.count;
  }

  /**
   * Get total judge count
   * @returns {Promise<number>}
   */
  static async count() {
    const sql = 'SELECT COUNT(*) as count FROM judges';
    const result = await get(sql);
    return result.count;
  }
}

export default Judge;
