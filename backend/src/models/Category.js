/**
 * Category Model
 * 
 * Database operations for weight and age categories
 * Tables: weight_categories + age_categories
 */

import { get, all } from '../config/database-local.js';

class Category {
  // ============================================
  // WEIGHT CATEGORIES
  // ============================================

  /**
   * Get all weight categories
   * @param {string} sex - Optional: filter by sex ('M' or 'F')
   * @returns {Promise<Array>}
   */
  static async getAllWeightCategories(sex = null) {
    let sql = 'SELECT * FROM weight_categories';
    const params = [];
    
    if (sex) {
      sql += ' WHERE sex = ?';
      params.push(sex);
    }
    
    sql += ' ORDER BY ord, min_kg';
    return await all(sql, params);
  }

  /**
   * Get weight category by ID
   * @param {number} id - Category ID
   * @returns {Promise<Object|null>}
   */
  static async getWeightCategoryById(id) {
    const sql = 'SELECT * FROM weight_categories WHERE id = ?';
    return await get(sql, [id]);
  }

  /**
   * Find weight category for a given bodyweight
   * @param {number} bodyweightKg - Bodyweight in kg
   * @param {string} sex - Sex ('M' or 'F')
   * @returns {Promise<Object|null>}
   */
  static async findWeightCategoryByWeight(bodyweightKg, sex) {
    const sql = `
      SELECT * FROM weight_categories
      WHERE sex = ? 
        AND min_kg <= ?
        AND (max_kg IS NULL OR max_kg >= ?)
      ORDER BY min_kg DESC
      LIMIT 1
    `;
    return await get(sql, [sex, bodyweightKg, bodyweightKg]);
  }

  /**
   * Get weight category by name
   * @param {string} name - Category name
   * @returns {Promise<Object|null>}
   */
  static async getWeightCategoryByName(name) {
    const sql = 'SELECT * FROM weight_categories WHERE name = ?';
    return await get(sql, [name]);
  }

  // ============================================
  // AGE CATEGORIES
  // ============================================

  /**
   * Get all age categories
   * @returns {Promise<Array>}
   */
  static async getAllAgeCategories() {
    const sql = 'SELECT * FROM age_categories ORDER BY ord';
    return await all(sql);
  }

  /**
   * Get age category by ID
   * @param {number} id - Category ID
   * @returns {Promise<Object|null>}
   */
  static async getAgeCategoryById(id) {
    const sql = 'SELECT * FROM age_categories WHERE id = ?';
    return await get(sql, [id]);
  }

  /**
   * Find age category for a given age
   * @param {number} age - Age in years
   * @returns {Promise<Object|null>}
   */
  static async findAgeCategoryByAge(age) {
    const sql = `
      SELECT * FROM age_categories
      WHERE (min_age IS NULL OR min_age <= ?)
        AND (max_age IS NULL OR max_age >= ?)
      ORDER BY ord
      LIMIT 1
    `;
    return await get(sql, [age, age]);
  }

  /**
   * Get age category by name
   * @param {string} name - Category name
   * @returns {Promise<Object|null>}
   */
  static async getAgeCategoryByName(name) {
    const sql = 'SELECT * FROM age_categories WHERE name = ?';
    return await get(sql, [name]);
  }

  /**
   * Calculate age from birth date
   * @param {string} birthDate - Birth date in ISO format (YYYY-MM-DD)
   * @returns {number} Age in years
   */
  static calculateAge(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get categories for athlete (weight + age)
   * @param {number} bodyweightKg - Bodyweight in kg
   * @param {string} sex - Sex ('M' or 'F')
   * @param {string} birthDate - Birth date in ISO format
   * @returns {Promise<Object>} { weightCategory, ageCategory }
   */
  static async getCategoriesForAthlete(bodyweightKg, sex, birthDate) {
    const age = this.calculateAge(birthDate);
    
    const [weightCategory, ageCategory] = await Promise.all([
      this.findWeightCategoryByWeight(bodyweightKg, sex),
      this.findAgeCategoryByAge(age)
    ]);

    return {
      weightCategory,
      ageCategory,
      calculatedAge: age
    };
  }
}

export default Category;
