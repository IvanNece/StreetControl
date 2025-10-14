/**
 * Ranking Service
 * 
 * Calculates rankings and leaderboards
 * 
 * RANKING LOGIC:
 * - Total = Sum of best attempt per lift (only VALID attempts)
 * - Category Rankings: Sort by Total DESC, then bodyweight ASC (lighter wins if tied)
 * - Absolute Rankings: Use RIS score (Relative Intensity Score)
 * - Placement assigned per category (weight_cat_id + age_cat_id)
 * 
 * RIS FORMULA:
 * - Men: total * 100 / (A + (K - A) / (1 + Q * exp(-B * (bodyweight - v))))
 *   where A=338, K=549, B=0.11354, v=74.777, Q=0.53096
 * - Women: total * 100 / (A + (K - A) / (1 + Q * exp(-B * (bodyweight - v))))
 *   where A=164, K=270, B=0.13776, v=57.855, Q=0.37089
 */

import Registration from '../models/Registration.js';
import Attempt from '../models/Attempt.js';
import { all } from '../config/database-local.js';

class RankingService {
  /**
   * Calculate rankings for a meet and lift
   * @param {number} meetId - Meet ID
   * @param {string} liftId - Lift ID (e.g., 'MU', 'PU')
   * @returns {Promise<Array>} Rankings array
   */
  async calculateRankings(meetId, liftId) {
    // Get all registrations for meet
    const registrations = await Registration.findByMeet(meetId);

    // Calculate totals for each registration
    const results = await Promise.all(
      registrations.map(async (reg) => {
        const total = await this.calculateTotal(reg.id, liftId);
        const ris = this.calculateRIS(total, reg.bodyweight_kg, reg.sex);

        return {
          reg_id: reg.id,
          athlete_id: reg.athlete_id,
          first_name: reg.first_name,
          last_name: reg.last_name,
          sex: reg.sex,
          bodyweight_kg: reg.bodyweight_kg,
          weight_cat_id: reg.weight_cat_id,
          weight_cat_name: reg.weight_cat_name,
          age_cat_id: reg.age_cat_id,
          age_cat_name: reg.age_cat_name,
          total,
          ris
        };
      })
    );

    // Filter out athletes with zero total (no valid attempts)
    const validResults = results.filter(r => r.total > 0);

    // Group by categories for placement
    const categories = this._groupByCategory(validResults);

    // Assign placements within each category
    const rankedResults = [];
    for (const [categoryKey, athletes] of Object.entries(categories)) {
      // Sort by TOTAL DESC, then BODYWEIGHT ASC (lighter wins if tied)
      athletes.sort((a, b) => {
        if (b.total !== a.total) {
          return b.total - a.total;
        }
        return a.bodyweight_kg - b.bodyweight_kg;
      });

      // Assign placements
      athletes.forEach((athlete, index) => {
        rankedResults.push({
          ...athlete,
          placement: index + 1,
          category: categoryKey
        });
      });
    }

    return rankedResults;
  }

  /**
   * Calculate total for registration and lift
   * Best attempt only (max weight with VALID status)
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<number>} Total weight in kg
   */
  async calculateTotal(regId, liftId) {
    const attempts = await Attempt.findByRegistrationAndLift(regId, liftId);
    
    // Get only VALID attempts
    const validAttempts = attempts.filter(a => a.status === 'VALID');

    if (validAttempts.length === 0) {
      return 0;
    }

    // Return best (max) weight
    return Math.max(...validAttempts.map(a => a.weight_kg));
  }

  /**
   * Calculate RIS score (Relative Intensity Score)
   * 
   * Formula:
   * RIS = total * 100 / (A + (K - A) / (1 + Q * exp(-B * (bodyweight - v))))
   * 
   * @param {number} total - Total weight lifted (kg)
   * @param {number} bodyweight - Bodyweight in kg
   * @param {string} sex - 'M' or 'F'
   * @returns {number} RIS score
   */
  calculateRIS(total, bodyweight, sex) {
    if (!total || !bodyweight || total === 0) {
      return 0;
    }

    // RIS coefficients
    const coefficients = {
      M: {
        A: 338,
        K: 549,
        B: 0.11354,
        v: 74.777,
        Q: 0.53096
      },
      F: {
        A: 164,
        K: 270,
        B: 0.13776,
        v: 57.855,
        Q: 0.37089
      }
    };

    const coeff = coefficients[sex] || coefficients.M;

    // Calculate RIS
    const denominator = coeff.A + 
                       (coeff.K - coeff.A) / 
                       (1 + coeff.Q * Math.exp(-coeff.B * (bodyweight - coeff.v)));

    const ris = (total * 100) / denominator;

    return Math.round(ris * 100) / 100; // Round to 2 decimals
  }

  /**
   * Group athletes by category (weight + age)
   * @param {Array} athletes - Athletes array
   * @returns {Object} Object with category keys
   * @private
   */
  _groupByCategory(athletes) {
    const categories = {};

    athletes.forEach(athlete => {
      const key = `${athlete.sex}_${athlete.weight_cat_id || 'OPEN'}_${athlete.age_cat_id || 'OPEN'}`;
      
      if (!categories[key]) {
        categories[key] = [];
      }
      
      categories[key].push(athlete);
    });

    return categories;
  }

  /**
   * Get rankings for specific category
   * @param {number} meetId - Meet ID
   * @param {string} liftId - Lift ID
   * @param {string} sex - Sex ('M' or 'F')
   * @param {number} weightCatId - Weight category ID (optional)
   * @param {number} ageCatId - Age category ID (optional)
   * @returns {Promise<Array>}
   */
  async getRankingsByCategory(meetId, liftId, sex, weightCatId = null, ageCatId = null) {
    const allRankings = await this.calculateRankings(meetId, liftId);

    return allRankings.filter(r => {
      if (r.sex !== sex) return false;
      if (weightCatId && r.weight_cat_id !== weightCatId) return false;
      if (ageCatId && r.age_cat_id !== ageCatId) return false;
      return true;
    });
  }

  /**
   * Get overall rankings (by RIS - absolute ranking)
   * @param {number} meetId - Meet ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<Array>}
   */
  async getOverallRankings(meetId, liftId) {
    const rankings = await this.calculateRankings(meetId, liftId);
    
    // Sort by RIS score DESC for absolute ranking
    rankings.sort((a, b) => b.ris - a.ris);
    
    return rankings;
  }

  /**
   * Get athlete's current standing
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<Object|null>}
   */
  async getAthleteStanding(regId, liftId) {
    const registration = await Registration.findById(regId);
    if (!registration) {
      return null;
    }

    const rankings = await this.calculateRankings(registration.meet_id, liftId);
    
    return rankings.find(r => r.reg_id === regId) || null;
  }
}

// Singleton instance
const rankingService = new RankingService();

export default rankingService;
