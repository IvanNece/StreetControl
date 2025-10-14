/**
 * State Machine Service
 * 
 * Manages competition flow and athlete ordering
 * 
 * ORDERING ALGORITHM:
 * - Round 1: Athletes in start_ord order (from group_entries)
 * - Rounds 2-3: "2-bests" rule - athletes with lowest successful attempts go first
 *   - Sort by: (1) best valid weight ASC, (2) attempt_no ASC, (3) original start_ord ASC
 * 
 * NEXT BUTTON LOGIC:
 * - Regista presses NEXT → load next athlete in order
 * - Updates CurrentState with: current_reg_id, current_lift_id, current_round
 * - Creates attempt record with status='PENDING'
 * - Broadcasts state to all clients via Socket.IO
 */

import CurrentState from '../models/CurrentState.js';
import Attempt from '../models/Attempt.js';
import Flight from '../models/Flight.js';

class StateMachine {
  /**
   * Initialize competition state for a group
   * @param {number} meetId - Meet ID
   * @param {number} flightId - Flight ID
   * @param {number} groupId - Group ID
   * @param {string} liftId - Starting lift ID (e.g., 'MU')
   * @returns {Promise<Object>} Initial state
   */
  async initialize(meetId, flightId, groupId, liftId) {
    // Reset current state
    await CurrentState.reset();
    
    // Get first athlete in group
    const entries = await Flight.getGroupEntries(groupId);
    if (entries.length === 0) {
      throw new Error('No athletes in group');
    }

    // Sort by start_ord for first round
    entries.sort((a, b) => a.start_ord - b.start_ord);
    const firstAthlete = entries[0];

    // Create first attempt record (round 1)
    const attemptId = await Attempt.create({
      reg_id: firstAthlete.reg_id,
      lift_id: liftId,
      attempt_no: 1,
      weight_kg: null, // Will be set when athlete declares weight
      status: 'PENDING'
    });

    // Set current state
    await CurrentState.update({
      meet_id: meetId,
      current_flight_id: flightId,
      current_group_id: groupId,
      current_reg_id: firstAthlete.reg_id,
      current_lift_id: liftId,
      current_round: 1
    });

    return await CurrentState.get();
  }

  /**
   * Move to NEXT athlete (called by regista)
   * @returns {Promise<Object>} New current state with next athlete
   */
  async next() {
    const state = await CurrentState.get();
    
    if (!state || !state.current_group_id || !state.current_lift_id) {
      throw new Error('State not initialized. Call initialize() first.');
    }

    const { current_group_id, current_lift_id, current_round } = state;

    // Get upcoming order
    const upcomingOrder = await this.getUpcomingOrder(
      current_group_id,
      current_lift_id,
      current_round
    );

    if (upcomingOrder.length === 0) {
      // No more athletes in this round/lift
      // Check if we should move to next round or next lift
      if (current_round < 3) {
        // Move to next round
        return await this._startNextRound(state);
      } else {
        // Competition finished for this group/lift
        return { finished: true, state };
      }
    }

    // Get next athlete
    const nextAthlete = upcomingOrder[0];

    // Create attempt record for next athlete
    const attemptId = await Attempt.create({
      reg_id: nextAthlete.reg_id,
      lift_id: current_lift_id,
      attempt_no: current_round,
      weight_kg: null, // Will be declared by athlete
      status: 'PENDING'
    });

    // Update current state
    await CurrentState.update({
      current_reg_id: nextAthlete.reg_id,
      current_round: current_round
    });

    return await CurrentState.get();
  }

  /**
   * Start next round
   * @param {Object} state - Current state
   * @returns {Promise<Object>}
   * @private
   */
  async _startNextRound(state) {
    const nextRound = state.current_round + 1;

    // Get upcoming order for next round
    const upcomingOrder = await this.getUpcomingOrder(
      state.current_group_id,
      state.current_lift_id,
      nextRound
    );

    if (upcomingOrder.length === 0) {
      return { finished: true, state };
    }

    const firstAthlete = upcomingOrder[0];

    // Create attempt record
    await Attempt.create({
      reg_id: firstAthlete.reg_id,
      lift_id: state.current_lift_id,
      attempt_no: nextRound,
      weight_kg: null,
      status: 'PENDING'
    });

    // Update state
    await CurrentState.update({
      current_reg_id: firstAthlete.reg_id,
      current_round: nextRound
    });

    return await CurrentState.get();
  }

  /**
   * Get current athlete info
   * @returns {Promise<Object|null>}
   */
  async getCurrentAthlete() {
    return await CurrentState.get();
  }

  /**
   * Get upcoming athlete order (queue)
   * 
   * ALGORITHM:
   * - Round 1: Original start_ord from group_entries
   * - Rounds 2-3: "2-bests" rule
   *   - Athletes with lowest successful weight go first
   *   - If tied, athlete with fewer attempts goes first
   *   - If still tied, use original start_ord
   * 
   * @param {number} groupId - Group ID
   * @param {string} liftId - Lift ID
   * @param {number} round - Round number (1, 2, 3)
   * @returns {Promise<Array>} Ordered list of athletes
   */
  async getUpcomingOrder(groupId, liftId, round) {
    // Get all athletes in group
    const entries = await Flight.getGroupEntries(groupId);

    // Round 1: Use start_ord
    if (round === 1) {
      return entries
        .sort((a, b) => a.start_ord - b.start_ord)
        .filter(athlete => !this._hasAttemptInRound(athlete.reg_id, liftId, round));
    }

    // Rounds 2-3: "2-bests" rule
    const athletesWithAttempts = await Promise.all(
      entries.map(async (athlete) => {
        const attempts = await Attempt.findByRegistrationAndLift(athlete.reg_id, liftId);
        
        // Get best successful weight
        const validAttempts = attempts.filter(a => a.status === 'VALID');
        const bestWeight = validAttempts.length > 0
          ? Math.max(...validAttempts.map(a => a.weight_kg))
          : 0;

        // Count total attempts
        const attemptCount = attempts.filter(a => a.status !== 'PENDING').length;

        // Check if already attempted in this round
        const hasAttemptedThisRound = attempts.some(
          a => a.attempt_no === round && a.status !== 'PENDING'
        );

        return {
          ...athlete,
          bestWeight,
          attemptCount,
          hasAttemptedThisRound
        };
      })
    );

    // Filter out athletes who already attempted this round
    const remaining = athletesWithAttempts.filter(a => !a.hasAttemptedThisRound);

    // Sort by 2-bests rule
    remaining.sort((a, b) => {
      // 1. Lowest best weight first
      if (a.bestWeight !== b.bestWeight) {
        return a.bestWeight - b.bestWeight;
      }
      // 2. Fewer attempts first
      if (a.attemptCount !== b.attemptCount) {
        return a.attemptCount - b.attemptCount;
      }
      // 3. Original start order
      return a.start_ord - b.start_ord;
    });

    return remaining;
  }

  /**
   * Check if athlete has attempt in specific round
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @param {number} round - Round number
   * @returns {Promise<boolean>}
   * @private
   */
  async _hasAttemptInRound(regId, liftId, round) {
    const attempts = await Attempt.findByRegistrationAndLift(regId, liftId);
    return attempts.some(a => a.attempt_no === round && a.status !== 'PENDING');
  }

  /**
   * Update current attempt weight (athlete declares weight)
   * @param {number} attemptId - Attempt ID
   * @param {number} weightKg - Weight in kg
   * @returns {Promise<void>}
   */
  async updateAttemptWeight(attemptId, weightKg) {
    await Attempt.updateWeight(attemptId, weightKg);
  }

  /**
   * Reset state machine
   * @returns {Promise<void>}
   */
  async reset() {
    await CurrentState.reset();
  }
}

// Singleton instance
const stateMachine = new StateMachine();

export default stateMachine;
