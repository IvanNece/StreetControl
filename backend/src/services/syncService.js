/**
 * Sync Service
 * 
 * Synchronizes local SQLite data to remote PostgreSQL (Supabase)
 * 
 * SYNC STRATEGY:
 * - Local SQLite: Used during competition (offline-first)
 * - Remote PostgreSQL: Historical records, rankings, meet results
 * - Sync happens at END of competition or manually triggered
 * 
 * WHAT TO SYNC:
 * 1. Meet results (athletes, attempts, final totals)
 * 2. Rankings (placements per category)
 * 3. Records beaten (if any new records set)
 */

import { createClient } from '@supabase/supabase-js';
import Meet from '../models/Meet.js';
import Registration from '../models/Registration.js';
import Attempt from '../models/Attempt.js';
import Record from '../models/Record.js';
import rankingService from './rankingService.js';

class SyncService {
  constructor() {
    this.supabase = null;
    this.isConnected = false;
  }

  /**
   * Initialize Supabase client
   * @param {string} supabaseUrl - Supabase project URL
   * @param {string} supabaseKey - Supabase anon/service key
   */
  initialize(supabaseUrl, supabaseKey) {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not provided. Sync service disabled.');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.isConnected = true;
    console.log('Sync service initialized with Supabase');
  }

  /**
   * Check if sync service is ready
   * @returns {boolean}
   */
  isReady() {
    return this.isConnected && this.supabase !== null;
  }

  /**
   * Sync complete meet results to remote database
   * @param {number} meetId - Meet ID
   * @returns {Promise<Object>} Sync summary
   */
  async syncMeetResults(meetId) {
    if (!this.isReady()) {
      throw new Error('Sync service not initialized');
    }

    try {
      // Get meet info
      const meet = await Meet.findById(meetId);
      if (!meet) {
        throw new Error(`Meet ${meetId} not found`);
      }

      // Get all registrations
      const registrations = await Registration.findByMeet(meetId);

      // Sync meet
      const { data: syncedMeet, error: meetError } = await this.supabase
        .from('meets')
        .upsert({
          id: meet.id,
          federation_id: meet.federation_id,
          meet_code: meet.meet_code,
          name: meet.name,
          meet_type_id: meet.meet_type_id,
          start_date: meet.start_date,
          level: meet.level,
          regulation_code: meet.regulation_code,
          synced_at: new Date().toISOString()
        });

      if (meetError) {
        throw new Error(`Failed to sync meet: ${meetError.message}`);
      }

      // Sync registrations and attempts
      let syncedRegistrations = 0;
      let syncedAttempts = 0;

      for (const reg of registrations) {
        // Sync registration
        const { error: regError } = await this.supabase
          .from('registrations')
          .upsert({
            id: reg.id,
            meet_id: reg.meet_id,
            athlete_id: reg.athlete_id,
            bodyweight_kg: reg.bodyweight_kg,
            weight_cat_id: reg.weight_cat_id,
            age_cat_id: reg.age_cat_id
          });

        if (!regError) {
          syncedRegistrations++;
        }

        // Get all attempts for this registration
        const attempts = await Attempt.findByRegistration(reg.id);

        for (const attempt of attempts) {
          if (attempt.status !== 'PENDING') {
            const { error: attemptError } = await this.supabase
              .from('attempts')
              .upsert({
                id: attempt.id,
                reg_id: attempt.reg_id,
                lift_id: attempt.lift_id,
                attempt_no: attempt.attempt_no,
                weight_kg: attempt.weight_kg,
                status: attempt.status
              });

            if (!attemptError) {
              syncedAttempts++;
            }
          }
        }
      }

      return {
        success: true,
        meetId,
        syncedRegistrations,
        syncedAttempts,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error syncing meet results:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync rankings to remote database
   * @param {number} meetId - Meet ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<Object>} Sync summary
   */
  async syncRankings(meetId, liftId) {
    if (!this.isReady()) {
      throw new Error('Sync service not initialized');
    }

    try {
      // Calculate rankings
      const rankings = await rankingService.calculateRankings(meetId, liftId);

      // Sync each ranking
      let syncedCount = 0;

      for (const ranking of rankings) {
        const { error } = await this.supabase
          .from('rankings')
          .upsert({
            meet_id: meetId,
            lift_id: liftId,
            reg_id: ranking.reg_id,
            athlete_id: ranking.athlete_id,
            weight_cat_id: ranking.weight_cat_id,
            age_cat_id: ranking.age_cat_id,
            total: ranking.total,
            ris: ranking.ris,
            placement: ranking.placement,
            synced_at: new Date().toISOString()
          });

        if (!error) {
          syncedCount++;
        }
      }

      return {
        success: true,
        meetId,
        liftId,
        syncedCount,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error syncing rankings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync new records to remote database
   * @param {number} meetId - Meet ID
   * @returns {Promise<Object>} Sync summary
   */
  async syncRecords(meetId) {
    if (!this.isReady()) {
      throw new Error('Sync service not initialized');
    }

    try {
      // Check for new records beaten in this meet
      const newRecords = await this._findNewRecords(meetId);

      let syncedCount = 0;

      for (const record of newRecords) {
        const { error } = await this.supabase
          .from('records')
          .upsert({
            federation_id: record.federation_id,
            lift_id: record.lift_id,
            sex: record.sex,
            weight_cat_id: record.weight_cat_id,
            age_cat_id: record.age_cat_id,
            weight_kg: record.weight_kg,
            athlete_id: record.athlete_id,
            meet_id: meetId,
            date: new Date().toISOString(),
            synced_at: new Date().toISOString()
          });

        if (!error) {
          syncedCount++;
        }
      }

      return {
        success: true,
        meetId,
        syncedCount,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error syncing records:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find new records set in a meet
   * @param {number} meetId - Meet ID
   * @returns {Promise<Array>}
   * @private
   */
  async _findNewRecords(meetId) {
    // This is a placeholder - would need complex logic to:
    // 1. Get all attempts from meet
    // 2. Compare with existing records
    // 3. Return attempts that beat current records
    
    // TODO: Implement record comparison logic
    return [];
  }

  /**
   * Full sync: results + rankings + records
   * @param {number} meetId - Meet ID
   * @param {string} liftId - Lift ID
   * @returns {Promise<Object>}
   */
  async fullSync(meetId, liftId) {
    if (!this.isReady()) {
      throw new Error('Sync service not initialized');
    }

    console.log(`Starting full sync for meet ${meetId}, lift ${liftId}...`);

    const results = await Promise.all([
      this.syncMeetResults(meetId),
      this.syncRankings(meetId, liftId),
      this.syncRecords(meetId)
    ]);

    return {
      success: results.every(r => r.success),
      meetResults: results[0],
      rankings: results[1],
      records: results[2],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test connection to remote database
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    if (!this.isReady()) {
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from('meets')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
const syncService = new SyncService();

export default syncService;
