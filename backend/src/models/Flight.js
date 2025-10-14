/**
 * Flight Model
 * 
 * Database operations for flights and groups
 * Tables: flights + groups + group_entries (3 tables gestite)
 */

import { get, all, run } from '../config/database-local.js';

class Flight {
  // ============================================
  // FLIGHTS OPERATIONS
  // ============================================

  /**
   * Create new flight
   * @param {Object} data - Flight data
   * @returns {Promise<number>} Created flight ID
   */
  static async createFlight(data) {
    const sql = `
      INSERT INTO flights (
        meet_id, name, ord, start_time
      ) VALUES (?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.meet_id,
      data.name,
      data.ord,
      data.start_time || null
    ]);
    
    return result.lastID;
  }

  /**
   * Find flight by ID
   * @param {number} id - Flight ID
   * @returns {Promise<Object|null>}
   */
  static async findFlightById(id) {
    const sql = `
      SELECT 
        f.*,
        m.name as meet_name,
        m.meet_code as meet_code
      FROM flights f
      INNER JOIN meets m ON f.meet_id = m.id
      WHERE f.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Get all flights for a meet
   * @param {number} meetId - Meet ID
   * @returns {Promise<Array>}
   */
  static async findByMeet(meetId) {
    const sql = `
      SELECT * FROM flights
      WHERE meet_id = ?
      ORDER BY ord, start_time
    `;
    return await all(sql, [meetId]);
  }

  /**
   * Update flight
   * @param {number} id - Flight ID
   * @param {Object} data - Updated data
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateFlight(id, data) {
    const sql = `
      UPDATE flights SET
        name = ?,
        ord = ?,
        start_time = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.name,
      data.ord,
      data.start_time || null,
      id
    ]);
    
    return result.changes;
  }

  /**
   * Delete flight (cascade: groups + group_entries)
   * @param {number} id - Flight ID
   * @returns {Promise<number>} Number of rows affected
   */
  static async deleteFlight(id) {
    const sql = 'DELETE FROM flights WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes;
  }

  // ============================================
  // GROUPS OPERATIONS
  // ============================================

  /**
   * Create new group in a flight
   * @param {Object} data - Group data
   * @returns {Promise<number>} Created group ID
   */
  static async createGroup(data) {
    const sql = `
      INSERT INTO groups (
        flight_id, name, ord
      ) VALUES (?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.flight_id,
      data.name,
      data.ord
    ]);
    
    return result.lastID;
  }

  /**
   * Find group by ID
   * @param {number} id - Group ID
   * @returns {Promise<Object|null>}
   */
  static async findGroupById(id) {
    const sql = `
      SELECT 
        g.*,
        f.name as flight_name
      FROM groups g
      INNER JOIN flights f ON g.flight_id = f.id
      WHERE g.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Get all groups for a flight
   * @param {number} flightId - Flight ID
   * @returns {Promise<Array>}
   */
  static async findGroupsByFlight(flightId) {
    const sql = `
      SELECT 
        g.*,
        COUNT(ge.id) as athlete_count
      FROM groups g
      LEFT JOIN group_entries ge ON g.id = ge.group_id
      WHERE g.flight_id = ?
      GROUP BY g.id
      ORDER BY g.ord
    `;
    return await all(sql, [flightId]);
  }

  /**
   * Update group
   * @param {number} id - Group ID
   * @param {Object} data - Updated data
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateGroup(id, data) {
    const sql = `
      UPDATE groups SET
        name = ?,
        ord = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.name,
      data.ord,
      id
    ]);
    
    return result.changes;
  }

  /**
   * Delete group (cascade: group_entries)
   * @param {number} id - Group ID
   * @returns {Promise<number>} Number of rows affected
   */
  static async deleteGroup(id) {
    const sql = 'DELETE FROM groups WHERE id = ?';
    const result = await run(sql, [id]);
    return result.changes;
  }

  // ============================================
  // GROUP ENTRIES OPERATIONS
  // ============================================

  /**
   * Add athlete to group
   * @param {Object} data - Entry data
   * @returns {Promise<number>} Created entry ID
   */
  static async addAthleteToGroup(data) {
    const sql = `
      INSERT INTO group_entries (
        group_id, reg_id, start_ord
      ) VALUES (?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.group_id,
      data.reg_id,
      data.start_ord
    ]);
    
    return result.lastID;
  }

  /**
   * Get all athletes in a group (with full details)
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  static async getGroupEntries(groupId) {
    const sql = `
      SELECT 
        ge.*,
        a.first_name as athlete_first_name,
        a.last_name as athlete_last_name,
        a.cf as athlete_cf,
        a.birth_date,
        a.sex,
        r.bodyweight_kg,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM group_entries ge
      INNER JOIN registrations r ON ge.reg_id = r.id
      INNER JOIN athletes a ON r.athlete_id = a.id
      LEFT JOIN weight_categories wc ON r.weight_cat_id = wc.id
      LEFT JOIN age_categories ac ON r.age_cat_id = ac.id
      WHERE ge.group_id = ?
      ORDER BY ge.start_ord, a.last_name, a.first_name
    `;
    return await all(sql, [groupId]);
  }

  /**
   * Update athlete start order in group
   * @param {number} entryId - Entry ID
   * @param {number} startOrd - New start order
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateStartOrder(entryId, startOrd) {
    const sql = 'UPDATE group_entries SET start_ord = ? WHERE id = ?';
    const result = await run(sql, [startOrd, entryId]);
    return result.changes;
  }

  /**
   * Remove athlete from group
   * @param {number} entryId - Entry ID
   * @returns {Promise<number>} Number of rows affected
   */
  static async removeAthleteFromGroup(entryId) {
    const sql = 'DELETE FROM group_entries WHERE id = ?';
    const result = await run(sql, [entryId]);
    return result.changes;
  }

  /**
   * Check if athlete is in a group
   * @param {number} regId - Registration ID
   * @param {number} groupId - Group ID
   * @returns {Promise<boolean>}
   */
  static async isAthleteInGroup(regId, groupId) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM group_entries 
      WHERE reg_id = ? AND group_id = ?
    `;
    const result = await get(sql, [regId, groupId]);
    return result.count > 0;
  }

  /**
   * Get full flight details (flight + groups + athletes)
   * @param {number} flightId - Flight ID
   * @returns {Promise<Object|null>}
   */
  static async getFullFlightDetails(flightId) {
    const flight = await this.findFlightById(flightId);
    if (!flight) return null;

    const groups = await this.findGroupsByFlight(flightId);
    
    // Get athletes for each group
    for (const group of groups) {
      group.athletes = await this.getGroupEntries(group.id);
    }

    return {
      ...flight,
      groups
    };
  }

  /**
   * Count groups in a flight
   * @param {number} flightId - Flight ID
   * @returns {Promise<number>}
   */
  static async countGroupsInFlight(flightId) {
    const sql = 'SELECT COUNT(*) as count FROM groups WHERE flight_id = ?';
    const result = await get(sql, [flightId]);
    return result.count;
  }

  /**
   * Count athletes in a group
   * @param {number} groupId - Group ID
   * @returns {Promise<number>}
   */
  static async countAthletesInGroup(groupId) {
    const sql = 'SELECT COUNT(*) as count FROM group_entries WHERE group_id = ?';
    const result = await get(sql, [groupId]);
    return result.count;
  }
}

export default Flight;
