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
        federation_id, meet_code, name, meet_type_id, 
        start_date, level, regulation_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.federation_id || null,
      data.meet_code,
      data.name,
      data.meet_type_id,
      data.start_date,
      data.level,
      data.regulation_code
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
        mt.name as meet_type_name
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
      WHERE m.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Find meet by meet_code
   * @param {string} meetCode - Unique meet code
   * @returns {Promise<Object|null>}
   */
  static async findByCode(meetCode) {
    const sql = `
      SELECT 
        m.*,
        mt.name as meet_type_name
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
      WHERE m.meet_code = ?
    `;
    return await get(sql, [meetCode]);
  }

  /**
   * Get all meets
   * @param {string} level - Optional: filter by level ('REGIONALE' | 'NAZIONALE')
   * @returns {Promise<Array>}
   */
  static async findAll(level = null) {
    let sql = `
      SELECT 
        m.*,
        mt.name as meet_type_name
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
    `;
    
    const params = [];
    if (level) {
      sql += ' WHERE m.level = ?';
      params.push(level);
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
        federation_id = ?,
        meet_code = ?,
        name = ?,
        meet_type_id = ?,
        start_date = ?,
        level = ?,
        regulation_code = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.federation_id || null,
      data.meet_code,
      data.name,
      data.meet_type_id,
      data.start_date,
      data.level,
      data.regulation_code,
      id
    ]);
    
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
      LEFT JOIN attempts a ON r.id = a.reg_id
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
        mtl.sequence
      FROM meet_type_lifts mtl
      INNER JOIN lifts l ON mtl.lift_id = l.id
      WHERE mtl.meet_type_id = ?
      ORDER BY mtl.sequence
    `;
    const lifts = await all(liftsSql, [meet.meet_type_id]);

    return {
      ...meet,
      lifts
    };
  }

  /**
   * Check if meet code exists
   * @param {string} meetCode - Meet code
   * @param {number} excludeId - Optional: ID to exclude from check (for updates)
   * @returns {Promise<boolean>}
   */
  static async codeExists(meetCode, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM meets WHERE meet_code = ?';
    const params = [meetCode];
    
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    
    const result = await get(sql, params);
    return result.count > 0;
  }

  /**
   * Find meets by federation
   * @param {number} federationId - Federation ID
   * @returns {Promise<Array>}
   */
  static async findByFederation(federationId) {
    const sql = `
      SELECT 
        m.*,
        mt.name as meet_type_name
      FROM meets m
      LEFT JOIN meet_types mt ON m.meet_type_id = mt.id
      WHERE m.federation_id = ?
      ORDER BY m.start_date DESC
    `;
    return await all(sql, [federationId]);
  }

  /**
   * Count meets by level
   * @param {string} level - Meet level
   * @returns {Promise<number>}
   */
  static async countByLevel(level) {
    const sql = 'SELECT COUNT(*) as count FROM meets WHERE level = ?';
    const result = await get(sql, [level]);
    return result.count;
  }
}

export default Meet;
