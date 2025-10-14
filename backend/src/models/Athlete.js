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
        name, surname, birth_date, sex, nation, 
        membership_code, email, phone, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.name,
      data.surname,
      data.birth_date,
      data.sex,
      data.nation || null,
      data.membership_code || null,
      data.email || null,
      data.phone || null,
      data.notes || null
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
    const sql = 'SELECT * FROM athletes ORDER BY surname, name';
    return await all(sql);
  }

  /**
   * Search athletes by name/surname
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  static async search(query) {
    const sql = `
      SELECT * FROM athletes 
      WHERE LOWER(name) LIKE LOWER(?) 
         OR LOWER(surname) LIKE LOWER(?)
         OR LOWER(membership_code) LIKE LOWER(?)
      ORDER BY surname, name
    `;
    const searchPattern = `%${query}%`;
    return await all(sql, [searchPattern, searchPattern, searchPattern]);
  }

  /**
   * Find athlete by membership code
   * @param {string} code - Membership code
   * @returns {Promise<Object|null>}
   */
  static async findByMembershipCode(code) {
    const sql = 'SELECT * FROM athletes WHERE membership_code = ?';
    return await get(sql, [code]);
  }

  /**
   * Find athletes by sex
   * @param {string} sex - Sex ('M' or 'F')
   * @returns {Promise<Array>}
   */
  static async findBySex(sex) {
    const sql = 'SELECT * FROM athletes WHERE sex = ? ORDER BY surname, name';
    return await all(sql, [sex]);
  }

  /**
   * Find athletes by nation
   * @param {string} nation - Nation code (e.g., 'ITA')
   * @returns {Promise<Array>}
   */
  static async findByNation(nation) {
    const sql = 'SELECT * FROM athletes WHERE nation = ? ORDER BY surname, name';
    return await all(sql, [nation]);
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
        name = ?,
        surname = ?,
        birth_date = ?,
        sex = ?,
        nation = ?,
        membership_code = ?,
        email = ?,
        phone = ?,
        notes = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.name,
      data.surname,
      data.birth_date,
      data.sex,
      data.nation || null,
      data.membership_code || null,
      data.email || null,
      data.phone || null,
      data.notes || null,
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
    const allowedFields = ['name', 'surname', 'birth_date', 'sex', 'nation', 
                           'membership_code', 'email', 'phone', 'notes'];
    
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
        r.team,
        r.lot_number,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM athletes a
      INNER JOIN registrations r ON a.id = r.athlete_id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
      WHERE r.meet_id = ?
      ORDER BY a.surname, a.name
    `;
    return await all(sql, [meetId]);
  }
}

export default Athlete;
