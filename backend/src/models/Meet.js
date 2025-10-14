/**
 * Meet Model
 * 
 * Database operations for competition meets
 * Table: meets
 */

import { get, all, run } from '../config/database-local.js';

class Meet {
  /**
   * Create new meet
   * @param {Object} data - Meet data
   * @returns {Promise<number>} Created meet ID
   */
  static async create(data) {
    const sql = `
      INSERT INTO meets (
        code, name, location, start_date, end_date,
        meet_type_id, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.code,
      data.name,
      data.location || null,
      data.start_date,
      data.end_date || null,
      data.meet_type_id,
      data.status || 'PREPARATION',
      data.notes || null
    ]);
    
    return result.lastID;
  }

  /**
   * Find meet by ID
   * @param {number} id - Meet ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT 
        m.*,
        mt.name as meet_type_name,
        mt.description as meet_type_description
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
      WHERE m.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Find meet by code
   * @param {string} code - Unique meet code
   * @returns {Promise<Object|null>}
   */
  static async findByCode(code) {
    const sql = `
      SELECT 
        m.*,
        mt.name as meet_type_name,
        mt.description as meet_type_description
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
      WHERE m.code = ?
    `;
    return await get(sql, [code]);
  }

  /**
   * Get all meets
   * @param {string} status - Optional: filter by status
   * @returns {Promise<Array>}
   */
  static async findAll(status = null) {
    let sql = `
      SELECT 
        m.*,
        mt.name as meet_type_name
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
    `;
    
    const params = [];
    if (status) {
      sql += ' WHERE m.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY m.start_date DESC, m.name';
    return await all(sql, params);
  }

  /**
   * Update meet
   * @param {number} id - Meet ID
   * @param {Object} data - Updated data
   * @returns {Promise<number>} Number of rows affected
   */
  static async update(id, data) {
    const sql = `
      UPDATE meets SET
        code = ?,
        name = ?,
        location = ?,
        start_date = ?,
        end_date = ?,
        meet_type_id = ?,
        status = ?,
        notes = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.code,
      data.name,
      data.location || null,
      data.start_date,
      data.end_date || null,
      data.meet_type_id,
      data.status,
      data.notes || null,
      id
    ]);
    
    return result.changes;
  }

  /**
   * Update meet status
   * @param {number} id - Meet ID
   * @param {string} status - New status
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateStatus(id, status) {
    const sql = 'UPDATE meets SET status = ? WHERE id = ?';
    const result = await run(sql, [status, id]);
    return result.changes;
  }

  /**
   * Delete meet
   * @param {number} id - Meet ID
   * @returns {Promise<number>} Number of rows affected
   */
  static async delete(id) {
    const sql = 'DELETE FROM meets WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes;
  }

  /**
   * Get meet statistics
   * @param {number} meetId - Meet ID
   * @returns {Promise<Object>} Statistics object
   */
  static async getStatistics(meetId) {
    const sql = `
      SELECT 
        COUNT(DISTINCT r.athlete_id) as total_athletes,
        COUNT(DISTINCT r.id) as total_registrations,
        COUNT(DISTINCT f.id) as total_flights,
        COUNT(DISTINCT g.id) as total_groups,
        COUNT(DISTINCT a.id) as total_attempts,
        SUM(CASE WHEN a.status = 'VALID' THEN 1 ELSE 0 END) as valid_attempts,
        SUM(CASE WHEN a.status = 'INVALID' THEN 1 ELSE 0 END) as invalid_attempts
      FROM meets m
      LEFT JOIN registrations r ON m.id = r.meet_id
      LEFT JOIN flights f ON m.id = f.meet_id
      LEFT JOIN groups g ON f.id = g.flight_id
      LEFT JOIN attempts a ON r.id = a.registration_id
      WHERE m.id = ?
      GROUP BY m.id
    `;
    
    const stats = await get(sql, [meetId]);
    return stats || {
      total_athletes: 0,
      total_registrations: 0,
      total_flights: 0,
      total_groups: 0,
      total_attempts: 0,
      valid_attempts: 0,
      invalid_attempts: 0
    };
  }

  /**
   * Get meet with full details (type + lifts)
   * @param {number} meetId - Meet ID
   * @returns {Promise<Object|null>}
   */
  static async getFullDetails(meetId) {
    const meet = await this.findById(meetId);
    if (!meet) return null;

    // Get lifts for this meet type
    const liftsSql = `
      SELECT 
        l.id,
        l.name,
        l.abbrev,
        mtl.ord
      FROM meet_type_lifts mtl
      INNER JOIN lifts l ON mtl.lift_id = l.id
      WHERE mtl.meet_type_id = ?
      ORDER BY mtl.ord
    `;
    const lifts = await all(liftsSql, [meet.meet_type_id]);

    return {
      ...meet,
      lifts
    };
  }

  /**
   * Check if meet code exists
   * @param {string} code - Meet code
   * @param {number} excludeId - Optional: ID to exclude from check (for updates)
   * @returns {Promise<boolean>}
   */
  static async codeExists(code, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM meets WHERE code = ?';
    const params = [code];
    
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    
    const result = await get(sql, params);
    return result.count > 0;
  }

  /**
   * Get active meet (status = IN_PROGRESS)
   * @returns {Promise<Object|null>}
   */
  static async getActiveMeet() {
    const sql = `
      SELECT 
        m.*,
        mt.name as meet_type_name
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
      WHERE m.status = 'IN_PROGRESS'
      LIMIT 1
    `;
    return await get(sql);
  }

  /**
   * Count meets by status
   * @param {string} status - Meet status
   * @returns {Promise<number>}
   */
  static async countByStatus(status) {
    const sql = 'SELECT COUNT(*) as count FROM meets WHERE status = ?';
    const result = await get(sql, [status]);
    return result.count;
  }
}

export default Meet;
