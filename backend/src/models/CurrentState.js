/**
 * Current State Model
 * 
 * Database operations for real-time competition state
 * Table: current_state (SINGLETON - always id=1)
 * 
 * This is the CORE table that tracks what's happening NOW in the competition:
 * - Current athlete performing
 * - Current lift being attempted
 * - Timer state (running/paused/stopped)
 * - Clock countdown
 */

import { get, run } from '../config/database-local.js';

const SINGLETON_ID = 1;

class CurrentState {
  /**
   * Get current state (singleton)
   * @returns {Promise<Object|null>}
   */
  static async get() {
    const sql = `
      SELECT 
        cs.*,
        r.athlete_id,
        r.lot_number,
        a.name as athlete_name,
        a.surname as athlete_surname,
        a.sex as athlete_sex,
        l.name as lift_name,
        l.abbrev as lift_abbrev,
        f.name as flight_name,
        g.name as group_name
      FROM current_state cs
      LEFT JOIN registrations r ON cs.current_registration_id = r.id
      LEFT JOIN athletes a ON r.athlete_id = a.id
      LEFT JOIN lifts l ON cs.current_lift_id = l.id
      LEFT JOIN flights f ON cs.current_flight_id = f.id
      LEFT JOIN groups g ON cs.current_group_id = g.id
      WHERE cs.id = ?
    `;
    return await get(sql, [SINGLETON_ID]);
  }

  /**
   * Initialize current state (first time setup)
   * @param {Object} data - Initial state data
   * @returns {Promise<void>}
   */
  static async initialize(data = {}) {
    const sql = `
      INSERT INTO current_state (
        id, 
        current_flight_id, 
        current_group_id,
        current_registration_id, 
        current_lift_id, 
        current_attempt_number,
        timer_state, 
        timer_seconds_left,
        phase
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await run(sql, [
      SINGLETON_ID,
      data.current_flight_id || null,
      data.current_group_id || null,
      data.current_registration_id || null,
      data.current_lift_id || null,
      data.current_attempt_number || 1,
      data.timer_state || 'STOPPED',
      data.timer_seconds_left || 60,
      data.phase || 'IDLE'
    ]);
  }

  /**
   * Update current athlete
   * @param {number} registrationId - Registration ID
   * @returns {Promise<void>}
   */
  static async setCurrentAthlete(registrationId) {
    const sql = `
      UPDATE current_state 
      SET current_registration_id = ? 
      WHERE id = ?
    `;
    await run(sql, [registrationId, SINGLETON_ID]);
  }

  /**
   * Update current lift
   * @param {number} liftId - Lift ID
   * @returns {Promise<void>}
   */
  static async setCurrentLift(liftId) {
    const sql = `
      UPDATE current_state 
      SET current_lift_id = ? 
      WHERE id = ?
    `;
    await run(sql, [liftId, SINGLETON_ID]);
  }

  /**
   * Update current attempt number
   * @param {number} attemptNumber - Attempt number (1, 2, 3)
   * @returns {Promise<void>}
   */
  static async setAttemptNumber(attemptNumber) {
    const sql = `
      UPDATE current_state 
      SET current_attempt_number = ? 
      WHERE id = ?
    `;
    await run(sql, [attemptNumber, SINGLETON_ID]);
  }

  /**
   * Update current flight
   * @param {number} flightId - Flight ID
   * @returns {Promise<void>}
   */
  static async setCurrentFlight(flightId) {
    const sql = `
      UPDATE current_state 
      SET current_flight_id = ? 
      WHERE id = ?
    `;
    await run(sql, [flightId, SINGLETON_ID]);
  }

  /**
   * Update current group
   * @param {number} groupId - Group ID
   * @returns {Promise<void>}
   */
  static async setCurrentGroup(groupId) {
    const sql = `
      UPDATE current_state 
      SET current_group_id = ? 
      WHERE id = ?
    `;
    await run(sql, [groupId, SINGLETON_ID]);
  }

  /**
   * Update timer state
   * @param {string} timerState - Timer state ('RUNNING', 'PAUSED', 'STOPPED')
   * @returns {Promise<void>}
   */
  static async setTimerState(timerState) {
    const sql = `
      UPDATE current_state 
      SET timer_state = ? 
      WHERE id = ?
    `;
    await run(sql, [timerState, SINGLETON_ID]);
  }

  /**
   * Update timer seconds left
   * @param {number} secondsLeft - Seconds left on clock
   * @returns {Promise<void>}
   */
  static async setTimerSeconds(secondsLeft) {
    const sql = `
      UPDATE current_state 
      SET timer_seconds_left = ? 
      WHERE id = ?
    `;
    await run(sql, [secondsLeft, SINGLETON_ID]);
  }

  /**
   * Start timer
   * @param {number} seconds - Initial seconds (default 60)
   * @returns {Promise<void>}
   */
  static async startTimer(seconds = 60) {
    const sql = `
      UPDATE current_state 
      SET timer_state = 'RUNNING', 
          timer_seconds_left = ? 
      WHERE id = ?
    `;
    await run(sql, [seconds, SINGLETON_ID]);
  }

  /**
   * Pause timer
   * @returns {Promise<void>}
   */
  static async pauseTimer() {
    await this.setTimerState('PAUSED');
  }

  /**
   * Stop timer (reset)
   * @returns {Promise<void>}
   */
  static async stopTimer() {
    const sql = `
      UPDATE current_state 
      SET timer_state = 'STOPPED', 
          timer_seconds_left = 60 
      WHERE id = ?
    `;
    await run(sql, [SINGLETON_ID]);
  }

  /**
   * Update phase
   * @param {string} phase - Competition phase
   * @returns {Promise<void>}
   */
  static async setPhase(phase) {
    const sql = `
      UPDATE current_state 
      SET phase = ? 
      WHERE id = ?
    `;
    await run(sql, [phase, SINGLETON_ID]);
  }

  /**
   * Update complete state (atomic operation)
   * @param {Object} data - State data
   * @returns {Promise<void>}
   */
  static async update(data) {
    const fields = [];
    const values = [];

    if (data.current_flight_id !== undefined) {
      fields.push('current_flight_id = ?');
      values.push(data.current_flight_id);
    }
    if (data.current_group_id !== undefined) {
      fields.push('current_group_id = ?');
      values.push(data.current_group_id);
    }
    if (data.current_registration_id !== undefined) {
      fields.push('current_registration_id = ?');
      values.push(data.current_registration_id);
    }
    if (data.current_lift_id !== undefined) {
      fields.push('current_lift_id = ?');
      values.push(data.current_lift_id);
    }
    if (data.current_attempt_number !== undefined) {
      fields.push('current_attempt_number = ?');
      values.push(data.current_attempt_number);
    }
    if (data.timer_state !== undefined) {
      fields.push('timer_state = ?');
      values.push(data.timer_state);
    }
    if (data.timer_seconds_left !== undefined) {
      fields.push('timer_seconds_left = ?');
      values.push(data.timer_seconds_left);
    }
    if (data.phase !== undefined) {
      fields.push('phase = ?');
      values.push(data.phase);
    }

    if (fields.length === 0) {
      return; // Nothing to update
    }

    values.push(SINGLETON_ID);
    const sql = `UPDATE current_state SET ${fields.join(', ')} WHERE id = ?`;
    await run(sql, values);
  }

  /**
   * Reset state (clear all current values)
   * @returns {Promise<void>}
   */
  static async reset() {
    const sql = `
      UPDATE current_state 
      SET current_flight_id = NULL,
          current_group_id = NULL,
          current_registration_id = NULL,
          current_lift_id = NULL,
          current_attempt_number = 1,
          timer_state = 'STOPPED',
          timer_seconds_left = 60,
          phase = 'IDLE'
      WHERE id = ?
    `;
    await run(sql, [SINGLETON_ID]);
  }

  /**
   * Check if state exists (singleton should always exist)
   * @returns {Promise<boolean>}
   */
  static async exists() {
    const sql = 'SELECT COUNT(*) as count FROM current_state WHERE id = ?';
    const result = await get(sql, [SINGLETON_ID]);
    return result.count > 0;
  }

  /**
   * Ensure singleton exists (create if missing)
   * @returns {Promise<void>}
   */
  static async ensureExists() {
    const exists = await this.exists();
    if (!exists) {
      await this.initialize();
    }
  }

  /**
   * Advance to next athlete (used by Regista after NEXT button)
   * This is a placeholder - actual logic will be in stateMachine service
   * @returns {Promise<void>}
   */
  static async advanceToNext() {
    // This will be implemented in stateMachine.js service
    // For now, just clear current athlete
    await this.setCurrentAthlete(null);
  }

  /**
   * Get full state with all related data
   * @returns {Promise<Object>}
   */
  static async getFullState() {
    const state = await this.get();
    if (!state) return null;

    // State already has JOINed data from get() method
    return state;
  }
}

export default CurrentState;
