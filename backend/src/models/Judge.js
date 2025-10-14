/**
 * Judge Model
 * 
 * Database operations for judges
 * Table: judges
 */

import { get, all, run } from '../config/database-local.js';

class Judge {
  /**
   * Create new judge for a meet
   * @param {Object} data - Judge data
   * @returns {Promise<number>} Created judge ID
   */
  static async create(data) {
    const sql = `
      INSERT INTO judges (
        meet_id, role
      ) VALUES (?, ?)
    `;
    
    const result = await run(sql, [
      data.meet_id,
      data.role
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
        m.name as meet_name
      FROM judges j
      INNER JOIN meets m ON j.meet_id = m.id
      WHERE j.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Get all judges for a meet
   * @param {number} meetId - Meet ID
   * @param {string} role - Optional: filter by role ('HEAD', 'LEFT', 'RIGHT')
   * @returns {Promise<Array>}
   */
  static async findByMeet(meetId, role = null) {
    let sql = `
      SELECT j.*
      FROM judges j
      WHERE j.meet_id = ?
    `;
    
    const params = [meetId];
    if (role) {
      sql += ' AND j.role = ?';
      params.push(role);
    }
    
    sql += ' ORDER BY j.role';
    return await all(sql, params);
  }

  /**
   * Find judge by role in a meet
   * @param {number} meetId - Meet ID
   * @param {string} role - Judge role ('HEAD', 'LEFT', 'RIGHT')
   * @returns {Promise<Object|null>}
   */
  static async findByMeetAndRole(meetId, role) {
    const sql = `
      SELECT j.*
      FROM judges j
      WHERE j.meet_id = ? AND j.role = ?
    `;
    return await get(sql, [meetId, role]);
  }

  /**
   * Update judge role
   * @param {number} id - Judge ID
   * @param {string} role - New role
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateRole(id, role) {
    const sql = `
      UPDATE judges SET
        role = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      role,
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
   * Check if all 3 judges are assigned to a meet
   * @param {number} meetId - Meet ID
   * @returns {Promise<boolean>}
   */
  static async areAllJudgesAssigned(meetId) {
    const sql = 'SELECT COUNT(*) as count FROM judges WHERE meet_id = ?';
    const result = await get(sql, [meetId]);
    return result.count === 3;
  }

  /**
   * Count judges for a meet
   * @param {number} meetId - Meet ID
   * @returns {Promise<number>}
   */
  static async countByMeet(meetId) {
    const sql = 'SELECT COUNT(*) as count FROM judges WHERE meet_id = ?';
    const result = await get(sql, [meetId]);
    return result.count;
  }

  /**
   * Check if judge role exists in meet
   * @param {number} meetId - Meet ID
   * @param {string} role - Judge role
   * @returns {Promise<boolean>}
   */
  static async roleExistsInMeet(meetId, role) {
    const sql = 'SELECT COUNT(*) as count FROM judges WHERE meet_id = ? AND role = ?';
    const result = await get(sql, [meetId, role]);
    return result.count > 0;
  }
}

export default Judge;
