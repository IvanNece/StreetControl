/**
 * Record Model
 * 
 * Database operations for records
 * Table: records (LOCAL DB - synced from remote at start)
 */

import { get, all } from '../config/database-local.js';

class Record {
  /**
   * Find record by ID
   * @param {number} id - Record ID
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const sql = `
      SELECT 
        r.*,
        f.name as federation_name,
        f.abbrev as federation_abbrev,
        l.name as lift_name,
        l.abbrev as lift_abbrev,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM records r
      INNER JOIN federations f ON r.federation_id = f.id
      INNER JOIN lifts l ON r.lift_id = l.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
      WHERE r.id = ?
    `;
    return await get(sql, [id]);
  }

  /**
   * Get all records
   * @param {number} federationId - Optional: filter by federation
   * @returns {Promise<Array>}
   */
  static async findAll(federationId = null) {
    let sql = `
      SELECT 
        r.*,
        f.name as federation_name,
        f.abbrev as federation_abbrev,
        l.name as lift_name,
        l.abbrev as lift_abbrev,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM records r
      INNER JOIN federations f ON r.federation_id = f.id
      INNER JOIN lifts l ON r.lift_id = l.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
    `;
    
    const params = [];
    if (federationId) {
      sql += ' WHERE r.federation_id = ?';
      params.push(federationId);
    }
    
    sql += ' ORDER BY f.name, l.name, wc.name, ac.name';
    return await all(sql, params);
  }

  /**
   * Find records by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>}
   */
  static async findByCriteria(criteria) {
    const conditions = [];
    const params = [];

    if (criteria.federation_id) {
      conditions.push('r.federation_id = ?');
      params.push(criteria.federation_id);
    }
    if (criteria.lift_id) {
      conditions.push('r.lift_id = ?');
      params.push(criteria.lift_id);
    }
    if (criteria.sex) {
      conditions.push('r.sex = ?');
      params.push(criteria.sex);
    }
    if (criteria.weight_category_id) {
      conditions.push('r.weight_category_id = ?');
      params.push(criteria.weight_category_id);
    }
    if (criteria.age_category_id) {
      conditions.push('r.age_category_id = ?');
      params.push(criteria.age_category_id);
    }

    let sql = `
      SELECT 
        r.*,
        f.name as federation_name,
        l.name as lift_name,
        l.abbrev as lift_abbrev,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM records r
      INNER JOIN federations f ON r.federation_id = f.id
      INNER JOIN lifts l ON r.lift_id = l.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
    `;

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY r.weight_kg DESC';
    return await all(sql, params);
  }

  /**
   * Check if weight breaks a record
   * @param {Object} criteria - Criteria to check against
   * @param {number} weightKg - Weight to check
   * @returns {Promise<Object|null>} Record if beaten, null otherwise
   */
  static async checkRecord(criteria, weightKg) {
    const records = await this.findByCriteria(criteria);
    
    if (records.length === 0) {
      return null; // No record exists for these criteria
    }

    const currentRecord = records[0]; // Highest weight (ordered DESC)
    
    if (weightKg > currentRecord.weight_kg) {
      return currentRecord; // Record beaten!
    }

    return null;
  }

  /**
   * Get record for specific combination (exact match)
   * @param {Object} criteria - Exact criteria
   * @returns {Promise<Object|null>}
   */
  static async getExactRecord(criteria) {
    const sql = `
      SELECT 
        r.*,
        f.name as federation_name,
        l.name as lift_name,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM records r
      INNER JOIN federations f ON r.federation_id = f.id
      INNER JOIN lifts l ON r.lift_id = l.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
      WHERE r.federation_id = ?
        AND r.lift_id = ?
        AND r.sex = ?
        AND (r.weight_category_id = ? OR (r.weight_category_id IS NULL AND ? IS NULL))
        AND (r.age_category_id = ? OR (r.age_category_id IS NULL AND ? IS NULL))
      LIMIT 1
    `;
    
    return await get(sql, [
      criteria.federation_id,
      criteria.lift_id,
      criteria.sex,
      criteria.weight_category_id || null,
      criteria.weight_category_id || null,
      criteria.age_category_id || null,
      criteria.age_category_id || null
    ]);
  }

  /**
   * Get records by federation
   * @param {number} federationId - Federation ID
   * @returns {Promise<Array>}
   */
  static async findByFederation(federationId) {
    const sql = `
      SELECT 
        r.*,
        l.name as lift_name,
        l.abbrev as lift_abbrev,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM records r
      INNER JOIN lifts l ON r.lift_id = l.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
      WHERE r.federation_id = ?
      ORDER BY l.name, r.sex, wc.name, ac.name
    `;
    return await all(sql, [federationId]);
  }

  /**
   * Get records by lift
   * @param {number} liftId - Lift ID
   * @returns {Promise<Array>}
   */
  static async findByLift(liftId) {
    const sql = `
      SELECT 
        r.*,
        f.name as federation_name,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM records r
      INNER JOIN federations f ON r.federation_id = f.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
      WHERE r.lift_id = ?
      ORDER BY f.name, r.sex, wc.name, ac.name
    `;
    return await all(sql, [liftId]);
  }

  /**
   * Get records by sex
   * @param {string} sex - Sex ('M' or 'F')
   * @returns {Promise<Array>}
   */
  static async findBySex(sex) {
    const sql = `
      SELECT 
        r.*,
        f.name as federation_name,
        l.name as lift_name,
        wc.name as weight_category_name,
        ac.name as age_category_name
      FROM records r
      INNER JOIN federations f ON r.federation_id = f.id
      INNER JOIN lifts l ON r.lift_id = l.id
      LEFT JOIN weight_categories wc ON r.weight_category_id = wc.id
      LEFT JOIN age_categories ac ON r.age_category_id = ac.id
      WHERE r.sex = ?
      ORDER BY f.name, l.name, wc.name, ac.name
    `;
    return await all(sql, [sex]);
  }

  /**
   * Count records by federation
   * @param {number} federationId - Federation ID
   * @returns {Promise<number>}
   */
  static async countByFederation(federationId) {
    const sql = 'SELECT COUNT(*) as count FROM records WHERE federation_id = ?';
    const result = await get(sql, [federationId]);
    return result.count;
  }

  /**
   * Get all records count
   * @returns {Promise<number>}
   */
  static async count() {
    const sql = 'SELECT COUNT(*) as count FROM records';
    const result = await get(sql);
    return result.count;
  }
}

export default Record;
