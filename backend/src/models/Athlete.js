/**
 * Athlete Model
 * 
 * Database operations for athletes
 * Table: athletes
 */

import { get, all, run } from '../config/database-local.js';

class Athlete {
  /**
   * Create new athlete
   * @param {Object} data - Athlete data
   * @returns {Promise<number>} Created athlete ID
   */
  static async create(data) {
    const sql = `
      INSERT INTO athletes (
        cf, first_name, last_name, sex, birth_date
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.cf,
      data.first_name,
      data.last_name,
      data.sex,
      data.birth_date
    ]);
    
    return result.lastID;
  }

  /**
   * Find athlete by ID
   * @param {number} id - Athlete ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = 'SELECT * FROM athletes WHERE id = ?';
    return await get(sql, [id]);
  }

  /**
   * Get all athletes
   * @returns {Promise<Array>}
   */
  static async findAll() {
    const sql = 'SELECT * FROM athletes ORDER BY last_name, first_name';
    return await all(sql);
  }

  /**
   * Search athletes by name/surname/cf
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  static async search(query) {
    const sql = `
      SELECT * FROM athletes 
      WHERE LOWER(first_name) LIKE LOWER(?) 
         OR LOWER(last_name) LIKE LOWER(?)
         OR LOWER(cf) LIKE LOWER(?)
      ORDER BY last_name, first_name
    `;
    const searchPattern = `%${query}%`;
    return await all(sql, [searchPattern, searchPattern, searchPattern]);
  }

  /**
   * Find athlete by Codice Fiscale
   * @param {string} cf - Codice Fiscale
   * @returns {Promise<Object|null>}
   */
  static async findByCF(cf) {
    const sql = 'SELECT * FROM athletes WHERE cf = ?';
    return await get(sql, [cf]);
  }

  /**
   * Find athletes by sex
   * @param {string} sex - Sex ('M' or 'F')
   * @returns {Promise<Array>}
   */
  static async findBySex(sex) {
    const sql = 'SELECT * FROM athletes WHERE sex = ? ORDER BY last_name, first_name';
    return await all(sql, [sex]);
  }

  /**
   * Update athlete
   * @param {number} id - Athlete ID
   * @param {Object} data - Updated data
   * @returns {Promise<number>} Number of rows affected
   */
  static async update(id, data) {
    const sql = `
      UPDATE athletes SET
        cf = ?,
        first_name = ?,
        last_name = ?,
        sex = ?,
        birth_date = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.cf,
      data.first_name,
      data.last_name,
      data.sex,
      data.birth_date,
      id
    ]);
    
    return result.changes;
  }

  /**
   * Partial update of athlete
   * @param {number} id - Athlete ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<number>} Number of rows affected
   */
  static async partialUpdate(id, updates) {
    const allowedFields = ['cf', 'first_name', 'last_name', 'sex', 'birth_date'];
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) {
      return 0; // No valid fields to update
    }
    
    values.push(id);
    const sql = `UPDATE athletes SET ${fields.join(', ')} WHERE id = ?`;
    
    const result = await run(sql, values);
    return result.changes;
  }

  /**
   * Delete athlete
   * @param {number} id - Athlete ID
   * @returns {Promise<number>} Number of rows affected
   */
  static async delete(id) {
    const sql = 'DELETE FROM athletes WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes;
  }

  /**
   * Check if athlete exists
   * @param {number} id - Athlete ID
   * @returns {Promise<boolean>}
   */
  static async exists(id) {
    const sql = 'SELECT COUNT(*) as count FROM athletes WHERE id = ?';
    const result = await get(sql, [id]);
    return result.count > 0;
  }

  /**
   * Count total athletes
   * @returns {Promise<number>}
   */
  static async count() {
    const sql = 'SELECT COUNT(*) as count FROM athletes';
    const result = await get(sql);
    return result.count;
  }

  /**
   * Get athletes registered to a specific meet
   * @param {number} meetId - Meet ID
   * @returns {Promise<Array>} Athletes with registration info
   */
  static async findByMeet(meetId) {
    const sql = `
      SELECT 
        a.*,
        r.id as registration_id,
        r.bodyweight_kg,
        r.rack_height,
        r.belt_height,
        r.out_of_weight,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM athletes a
      INNER JOIN registrations r ON a.id = r.athlete_id
      LEFT JOIN weight_categories wc ON r.weight_cat_id = wc.id
      LEFT JOIN age_categories ac ON r.age_cat_id = ac.id
      WHERE r.meet_id = ?
      ORDER BY a.last_name, a.first_name
    `;
    return await all(sql, [meetId]);
  }
}

export default Athlete;
