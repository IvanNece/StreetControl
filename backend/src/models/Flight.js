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
        meet_id, name, platform_number, scheduled_time, status
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.meet_id,
      data.name,
      data.platform_number || null,
      data.scheduled_time || null,
      data.status || 'PENDING'
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
        m.code as meet_code
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
      ORDER BY platform_number, scheduled_time, name
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
        platform_number = ?,
        scheduled_time = ?,
        status = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.name,
      data.platform_number || null,
      data.scheduled_time || null,
      data.status,
      id
    ]);
    
    return result.changes;
  }

  /**
   * Update flight status
   * @param {number} id - Flight ID
   * @param {string} status - New status
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateFlightStatus(id, status) {
    const sql = 'UPDATE flights SET status = ? WHERE id = ?';
    const result = await run(sql, [status, id]);
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
        flight_id, name, lift_id, sex, weight_category_id
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.flight_id,
      data.name,
      data.lift_id,
      data.sex || null,
      data.weight_category_id || null
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
        f.name as flight_name,
        l.name as lift_name,
        l.abbrev as lift_abbrev,
        wc.name as weight_category_name
      FROM groups g
      INNER JOIN flights f ON g.flight_id = f.id
      INNER JOIN lifts l ON g.lift_id = l.id
      LEFT JOIN weight_categories wc ON g.weight_category_id = wc.id
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
        l.name as lift_name,
        l.abbrev as lift_abbrev,
        wc.name as weight_category_name,
        COUNT(ge.id) as athlete_count
      FROM groups g
      INNER JOIN lifts l ON g.lift_id = l.id
      LEFT JOIN weight_categories wc ON g.weight_category_id = wc.id
      LEFT JOIN group_entries ge ON g.id = ge.group_id
      WHERE g.flight_id = ?
      GROUP BY g.id
      ORDER BY g.name
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
        lift_id = ?,
        sex = ?,
        weight_category_id = ?
      WHERE id = ?
    `;
    
    const result = await run(sql, [
      data.name,
      data.lift_id,
      data.sex || null,
      data.weight_category_id || null,
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
        group_id, registration_id, start_order
      ) VALUES (?, ?, ?)
    `;
    
    const result = await run(sql, [
      data.group_id,
      data.registration_id,
      data.start_order || null
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
        a.name as athlete_name,
        a.surname as athlete_surname,
        a.birth_date,
        a.sex,
        r.bodyweight_kg,
        r.lot_number,
        r.team,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM group_entries ge
      INNER JOIN registrations r ON ge.registration_id = r.id
      INNER JOIN athletes a ON r.athlete_id = a.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
      WHERE ge.group_id = ?
      ORDER BY ge.start_order, a.surname, a.name
    `;
    return await all(sql, [groupId]);
  }

  /**
   * Update athlete start order in group
   * @param {number} entryId - Entry ID
   * @param {number} startOrder - New start order
   * @returns {Promise<number>} Number of rows affected
   */
  static async updateStartOrder(entryId, startOrder) {
    const sql = 'UPDATE group_entries SET start_order = ? WHERE id = ?';
    const result = await run(sql, [startOrder, entryId]);
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
   * @param {number} registrationId - Registration ID
   * @param {number} groupId - Group ID
   * @returns {Promise<boolean>}
   */
  static async isAthleteInGroup(registrationId, groupId) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM group_entries 
      WHERE registration_id = ? AND group_id = ?
    `;
    const result = await get(sql, [registrationId, groupId]);
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
