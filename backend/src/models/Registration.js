/**
 * Registration Model
 * 
 * Manages athlete registrations to meets and their declared openers
 * Tables: registrations + registration_maxes
 */

import { get, all, run } from '../config/database-local.js';

class Registration {
  /**
   * Create a new registration
   * @param {Object} data - Registration data
   * @returns {Promise<Object>} Created registration with ID
   */
  static async create(data) {
    const {
      meet_id,
      athlete_id,
      bodyweight_kg = null,
      rack_height = 0,
      belt_height = 0,
      out_of_weight = 0,
      weight_cat_id = null,
      age_cat_id = null,
      notes = null
    } = data;

    const sql = `
      INSERT INTO registrations (
        meet_id, athlete_id, bodyweight_kg, rack_height, belt_height,
        out_of_weight, weight_cat_id, age_cat_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await run(sql, [
      meet_id, athlete_id, bodyweight_kg, rack_height, belt_height,
      out_of_weight, weight_cat_id, age_cat_id, notes
    ]);

    return {
      id: result.lastID,
      ...data
    };
  }

  /**
   * Find registration by ID
   * @param {number} id - Registration ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = 'SELECT * FROM registrations WHERE id = ?';
    return await get(sql, [id]);
  }

  /**
   * Find all registrations for a meet with athlete details
   * @param {number} meetId - Meet ID
   * @returns {Promise<Array>}
   */
  static async findByMeet(meetId) {
    const sql = `
      SELECT 
        r.*,
        a.cf,
        a.first_name,
        a.last_name,
        a.sex,
        a.birth_date,
        wc.name as weight_cat_name,
        wc.sex as weight_cat_sex,
        ac.name as age_cat_name
      FROM registrations r
      JOIN athletes a ON r.athlete_id = a.id
      LEFT JOIN weight_categories wc ON r.weight_cat_id = wc.id
      LEFT JOIN age_categories ac ON r.age_cat_id = ac.id
      WHERE r.meet_id = ?
      ORDER BY a.last_name, a.first_name
    `;
    return await all(sql, [meetId]);
  }

  /**
   * Find registration by meet and athlete
   * @param {number} meetId - Meet ID
   * @param {number} athleteId - Athlete ID
   * @returns {Promise<Object|null>}
   */
  static async findByMeetAndAthlete(meetId, athleteId) {
    const sql = `
      SELECT * FROM registrations 
      WHERE meet_id = ? AND athlete_id = ?
    `;
    return await get(sql, [meetId, athleteId]);
  }

  /**
   * Update bodyweight (during weigh-in)
   * @param {number} id - Registration ID
   * @param {number} bodyweightKg - Bodyweight in kg
   * @returns {Promise<Object>}
   */
  static async updateBodyweight(id, bodyweightKg) {
    const sql = `
      UPDATE registrations 
      SET bodyweight_kg = ? 
      WHERE id = ?
    `;
    await run(sql, [bodyweightKg, id]);
    return await this.findById(id);
  }

  /**
   * Update registration data
   * @param {number} id - Registration ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>}
   */
  static async update(id, data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'bodyweight_kg', 'rack_height', 'belt_height', 'out_of_weight',
      'weight_cat_id', 'age_cat_id', 'notes'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const sql = `UPDATE registrations SET ${fields.join(', ')} WHERE id = ?`;
    await run(sql, values);
    return await this.findById(id);
  }

  /**
   * Delete registration
   * @param {number} id - Registration ID
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const sql = 'DELETE FROM registrations WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes > 0;
  }

  /**
   * Set opener (declared starting weight for a lift)
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID (e.g., 'MU', 'PU')
   * @param {number} maxKg - Opener weight in kg
   * @returns {Promise<void>}
   */
  static async setOpener(regId, liftId, maxKg) {
    const sql = `
      INSERT INTO registration_maxes (reg_id, lift_id, max_kg)
      VALUES (?, ?, ?)
      ON CONFLICT (reg_id, lift_id) 
      DO UPDATE SET max_kg = excluded.max_kg
    `;
    await run(sql, [regId, liftId, maxKg]);
  }

  /**
   * Get all openers for a registration
   * @param {number} regId - Registration ID
   * @returns {Promise<Object>} Object with lift_id as keys, max_kg as values
   */
  static async getOpeners(regId) {
    const sql = `
      SELECT lift_id, max_kg 
      FROM registration_maxes 
      WHERE reg_id = ?
    `;
    const rows = await all(sql, [regId]);
    
    // Convert to object: { 'MU': 25, 'PU': 40, ... }
    return rows.reduce((acc, row) => {
      acc[row.lift_id] = row.max_kg;
      return acc;
    }, {});
  }

  /**
   * Get opener for specific lift
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<number|null>}
   */
  static async getOpener(regId, liftId) {
    const sql = `
      SELECT max_kg 
      FROM registration_maxes 
      WHERE reg_id = ? AND lift_id = ?
    `;
    const row = await get(sql, [regId, liftId]);
    return row ? row.max_kg : null;
  }

  /**
   * Delete opener
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<boolean>}
   */
  static async deleteOpener(regId, liftId) {
    const sql = `
      DELETE FROM registration_maxes 
      WHERE reg_id = ? AND lift_id = ?
    `;
    const result = await run(sql, [regId, liftId]);
    return result.changes > 0;
  }

  /**
   * Get registrations by weight category
   * @param {number} meetId - Meet ID
   * @param {number} weightCatId - Weight category ID
   * @returns {Promise<Array>}
   */
  static async findByWeightCategory(meetId, weightCatId) {
    const sql = `
      SELECT 
        r.*,
        a.cf,
        a.first_name,
        a.last_name,
        a.sex
      FROM registrations r
      JOIN athletes a ON r.athlete_id = a.id
      WHERE r.meet_id = ? AND r.weight_cat_id = ?
      ORDER BY r.bodyweight_kg DESC, a.last_name, a.first_name
    `;
    return await all(sql, [meetId, weightCatId]);
  }

  /**
   * Count registrations for a meet
   * @param {number} meetId - Meet ID
   * @returns {Promise<number>}
   */
  static async countByMeet(meetId) {
    const sql = 'SELECT COUNT(*) as count FROM registrations WHERE meet_id = ?';
    const row = await get(sql, [meetId]);
    return row ? row.count : 0;
  }
}

export default Registration;
