/**
 * Attempt Model
 * 
 * Database operations for lift attempts
 * Table: attempts (CRITICAL - usato da votingService)
 */

import { get, all, run } from '../config/database-local.js';

class Attempt {
  /**
   * Create new attempt
   * @param {Object} data - Attempt data
   * @returns {Promise<number>} Created attempt ID
   */
  static async create(data) {
    const sql = `
      INSERT INTO attempts (
        reg_id, lift_id, attempt_no, 
        weight_kg, status
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.reg_id,
      data.lift_id,
      data.attempt_no,
      data.weight_kg,
      data.status || 'PENDING'
    ]);
    
    return result.lastID;
  }

  /**
   * Find attempt by ID
   * @param {number} id - Attempt ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT 
        a.*,
        r.athlete_id,
        at.first_name as athlete_first_name,
        at.last_name as athlete_last_name,
        l.name as lift_name
      FROM attempts a
      INNER JOIN registrations r ON a.reg_id = r.id
      INNER JOIN athletes at ON r.athlete_id = at.id
      INNER JOIN lifts l ON a.lift_id = l.id
      WHERE a.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Get all attempts for a registration
   * @param {number} regId - Registration ID
   * @param {string} liftId - Optional: filter by lift
   * @returns {Promise<Array>}
   */
  static async findByRegistration(regId, liftId = null) {
    let sql = `
      SELECT 
        a.*,
        l.name as lift_name
      FROM attempts a
      INNER JOIN lifts l ON a.lift_id = l.id
      WHERE a.reg_id = ?
    `;
    
    const params = [regId];
    if (liftId) {
      sql += ' AND a.lift_id = ?';
      params.push(liftId);
    }
    
    sql += ' ORDER BY a.lift_id, a.attempt_no';
    return await all(sql, params);
  }

  /**
   * Get attempts for a meet
   * @param {number} meetId - Meet ID
   * @returns {Promise<Array>}
   */
  static async findByMeet(meetId) {
    const sql = `
      SELECT 
        a.*,
        r.athlete_id,
        at.first_name as athlete_first_name,
        at.last_name as athlete_last_name,
        l.name as lift_name
      FROM attempts a
      INNER JOIN registrations r ON a.reg_id = r.id
      INNER JOIN athletes at ON r.athlete_id = at.id
      INNER JOIN lifts l ON a.lift_id = l.id
      WHERE r.meet_id = ?
      ORDER BY a.lift_id, a.attempt_no
    `;
    return await all(sql, [meetId]);
  }

  /**
   * Find specific attempt
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @param {number} attemptNo - Attempt number (1, 2, 3, 4)
   * @returns {Promise<Object|null>}
   */
  static async findSpecificAttempt(regId, liftId, attemptNo) {
    const sql = `
      SELECT 
        a.*,
        l.name as lift_name
      FROM attempts a
      INNER JOIN lifts l ON a.lift_id = l.id
      WHERE a.reg_id = ? 
        AND a.lift_id = ? 
        AND a.attempt_no = ?
    `;
    return await get(sql, [regId, liftId, attemptNo]);
  }

  /**
   * Update attempt weight
   * @param {number} id - Attempt ID
   * @param {number} weightKg - New weight in kg
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateWeight(id, weightKg) {
    const sql = 'UPDATE attempts SET weight_kg = ? WHERE id = ?';
    const result = await run(sql, [weightKg, id]);
    return result.changes;
  }

  /**
   * Update attempt status (CRITICAL - chiamato da votingService)
   * @param {number} id - Attempt ID
   * @param {string} status - New status ('PENDING', 'VALID', 'INVALID', 'SKIPPED')
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateStatus(id, status) {
    const sql = 'UPDATE attempts SET status = ? WHERE id = ?';
    const result = await run(sql, [status, id]);
    return result.changes;
  }

  /**
   * Update attempt (weight + status)
   * @param {number} id - Attempt ID
   * @param {Object} data - Updated data
   * @returns {Promise<number>} Number of rows affected
   */
  static async update(id, data) {
    const sql = `
      UPDATE attempts SET
        weight_kg = ?,
        status = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.weight_kg,
      data.status,
      id
    ]);
    
    return result.changes;
  }

  /**
   * Delete attempt
   * @param {number} id - Attempt ID
   * @returns {Promise<number>} Number of rows affected
   */
  static async delete(id) {
    const sql = 'DELETE FROM attempts WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes;
  }

  /**
   * Get best valid attempt for a registration and lift
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<Object|null>}
   */
  static async getBestAttempt(regId, liftId) {
    const sql = `
      SELECT 
        a.*,
        l.name as lift_name
      FROM attempts a
      INNER JOIN lifts l ON a.lift_id = l.id
      WHERE a.reg_id = ? 
        AND a.lift_id = ?
        AND a.status = 'VALID'
      ORDER BY a.weight_kg DESC
      LIMIT 1
    `;
    return await get(sql, [regId, liftId]);
  }

  /**
   * Count attempts by status
   * @param {number} regId - Registration ID
   * @param {string} status - Status to count
   * @returns {Promise<number>}
   */
  static async countByStatus(regId, status) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM attempts 
      WHERE reg_id = ? AND status = ?
    `;
    const result = await get(sql, [regId, status]);
    return result.count;
  }

  /**
   * Get attempt statistics for a registration
   * @param {number} regId - Registration ID
   * @returns {Promise<Object>}
   */
  static async getStatistics(regId) {
    const sql = `
      SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END) as valid_attempts,
        SUM(CASE WHEN status = 'INVALID' THEN 1 ELSE 0 END) as invalid_attempts,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_attempts,
        MAX(CASE WHEN status = 'VALID' THEN weight_kg ELSE 0 END) as best_weight
      FROM attempts
      WHERE reg_id = ?
    `;
    const result = await get(sql, [regId]);
    return result || {
      total_attempts: 0,
      valid_attempts: 0,
      invalid_attempts: 0,
      pending_attempts: 0,
      best_weight: 0
    };
  }

  /**
   * Check if attempt exists
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @param {number} attemptNo - Attempt number
   * @returns {Promise<boolean>}
   */
  static async exists(regId, liftId, attemptNo) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM attempts 
      WHERE reg_id = ? AND lift_id = ? AND attempt_no = ?
    `;
    const result = await get(sql, [regId, liftId, attemptNo]);
    return result.count > 0;
  }

  /**
   * Get total for an athlete (sum of best valid attempts per lift)
   * @param {number} regId - Registration ID
   * @returns {Promise<number>} Total in kg
   */
  static async getTotal(regId) {
    const sql = `
      SELECT 
        COALESCE(SUM(best_weight), 0) as total
      FROM (
        SELECT 
          lift_id,
          MAX(weight_kg) as best_weight
        FROM attempts
        WHERE reg_id = ? AND status = 'VALID'
        GROUP BY lift_id
      )
    `;
    const result = await get(sql, [regId]);
    return result ? result.total : 0;
  }
}

export default Attempt;
