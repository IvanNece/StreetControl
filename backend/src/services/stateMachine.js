/**
 * State Machine Service
 * 
 * Manages competition flow and athlete ordering
 * 
 * COMPETITION FLOW:
 * 1. Flight contains multiple Groups (Group 1, Group 2, ...)
 * 2. Each Group completes ALL 3 attempts for one lift before moving to next
 * 3. Order: Group 1 (3 attempts) → Group 2 (3 attempts) → Group 1 next lift → ...
 * 
 * ORDERING WITHIN GROUP (PER ATTEMPT):
 * - Athletes ordered by DECLARED WEIGHT (ASC) for that specific attempt
 * - If tied: BODYWEIGHT DESC (heavier athlete goes first)
 * - Weight is declared DURING previous attempt (athlete calls next weight)
 * - Order can CHANGE between attempts based on declared weights
 * - DOES NOT matter if previous attempt was VALID or INVALID
 * 
 * EXAMPLE:
 * Attempt 1: Ivan 90kg, Fabio 95kg → Order: Ivan, Fabio
 * - Ivan makes 90kg VALID, declares 100kg for attempt 2
 * - Fabio makes 95kg INVALID, declares 95kg again for attempt 2
 * Attempt 2: Ivan 100kg, Fabio 95kg → Order: Fabio, Ivan (95 < 100)
 * 
 * NEXT BUTTON LOGIC:
 * - Regista presses NEXT → load next athlete based on declared weights
 * - Updates CurrentState with: current_reg_id, current_lift_id, current_round
 * - Athlete must declare weight before entering (via regista interface)
 * - Broadcasts state to all clients via Socket.IO
 */

import CurrentState from '../models/CurrentState.js';
import Attempt from '../models/Attempt.js';
import Flight from '../models/Flight.js';
import Registration from '../models/Registration.js';

class StateMachine {
  /**
   * Initialize competition state for a flight
   * @param {number} meetId - Meet ID
   * @param {number} flightId - Flight ID
   * @param {string} liftId - Starting lift ID (e.g., 'MU')
   * @returns {Promise<Object>} Initial state
   */
  async initialize(meetId, flightId, liftId) {
    // Reset current state
    await CurrentState.reset();
    
    // Get all groups in flight (ordered by ord)
    const groups = await Flight.findGroupsByFlight(flightId);
    if (groups.length === 0) {
      throw new Error('No groups in flight');
    }

    // Start with first group
    const firstGroup = groups[0];
    
    // Get athletes in first group
    const entries = await Flight.getGroupEntries(firstGroup.id);
    if (entries.length === 0) {
      throw new Error('No athletes in first group');
    }

    // Get first athlete based on declared openers (lowest weight first)
    const firstAthlete = await this._getFirstAthleteForRound(entries, liftId, 1);

    // Set current state
    await CurrentState.update({
      meet_id: meetId,
      current_flight_id: flightId,
      current_group_id: firstGroup.id,
      current_reg_id: firstAthlete.reg_id,
      current_lift_id: liftId,
      current_round: 1
    });

    return await CurrentState.get();
  }

  /**
   * Get first athlete for a round based on declared weights
   * @param {Array} entries - Group entries
   * @param {string} liftId - Lift ID
   * @param {number} round - Round number
   * @returns {Promise<Object>} First athlete
   * @private
   */
  async _getFirstAthleteForRound(entries, liftId, round) {
    // Get declared weights for all athletes
    const athletesWithWeights = await Promise.all(
      entries.map(async (entry) => {
        // For round 1, use opener from registration_maxes
        let declaredWeight;
        if (round === 1) {
          const registration = await Registration.findById(entry.reg_id);
          const openers = await Registration.getOpeners(entry.reg_id);
          declaredWeight = openers[liftId] || 999999; // High number if not declared
        } else {
          // For rounds 2-3, get from last attempt's declared next weight
          const attempts = await Attempt.findByRegistrationAndLift(entry.reg_id, liftId);
          const lastAttempt = attempts.find(a => a.attempt_no === round - 1);
          declaredWeight = lastAttempt?.weight_kg || 999999;
        }

        return {
          ...entry,
          declaredWeight
        };
      })
    );

    // Sort by declared weight ASC, then bodyweight DESC
    athletesWithWeights.sort((a, b) => {
      if (a.declaredWeight !== b.declaredWeight) {
        return a.declaredWeight - b.declaredWeight;
      }
      // If same weight, heavier athlete goes first
      return b.bodyweight_kg - a.bodyweight_kg;
    });

    return athletesWithWeights[0];
  }

  /**
   * Move to NEXT athlete (called by regista)
   * @returns {Promise<Object>} New current state with next athlete
   */
  async next() {
    const state = await CurrentState.get();
    
    if (!state || !state.current_flight_id || !state.current_lift_id) {
      throw new Error('State not initialized. Call initialize() first.');
    }

    const { current_flight_id, current_group_id, current_lift_id, current_round } = state;

    // Get upcoming order for current group/round
    const upcomingOrder = await this.getUpcomingOrder(
      current_group_id,
      current_lift_id,
      current_round
    );

    if (upcomingOrder.length === 0) {
      // Current group/round finished
      
      // Check if we should move to next round for this group
      if (current_round < 3) {
        // Move to round 2 or 3 for same group
        return await this._startNextRound(state);
      } else {
        // All 3 rounds done for this group, move to next group
        return await this._moveToNextGroup(state);
      }
    }

    // Get next athlete
    const nextAthlete = upcomingOrder[0];

    // Update current state
    await CurrentState.update({
      current_reg_id: nextAthlete.reg_id
    });

    return await CurrentState.get();
  }

  /**
   * Start next round for same group
   * @param {Object} state - Current state
   * @returns {Promise<Object>}
   * @private
   */
  async _startNextRound(state) {
    const nextRound = state.current_round + 1;

    // Get athletes in current group
    const entries = await Flight.getGroupEntries(state.current_group_id);
    
    // Get upcoming order for next round (based on declared weights)
    const upcomingOrder = await this.getUpcomingOrder(
      state.current_group_id,
      state.current_lift_id,
      nextRound
    );

    if (upcomingOrder.length === 0) {
      return { finished: true, state };
    }

    const firstAthlete = upcomingOrder[0];

    // Update state
    await CurrentState.update({
      current_reg_id: firstAthlete.reg_id,
      current_round: nextRound
    });

    return await CurrentState.get();
  }

  /**
   * Move to next group in flight
   * @param {Object} state - Current state
   * @returns {Promise<Object>}
   * @private
   */
  async _moveToNextGroup(state) {
    // Get all groups in flight
    const groups = await Flight.findGroupsByFlight(state.current_flight_id);
    
    // Find current group index
    const currentIndex = groups.findIndex(g => g.id === state.current_group_id);
    
    if (currentIndex === -1 || currentIndex === groups.length - 1) {
      // Last group finished, flight completed
      return { finished: true, state, message: 'Flight completed' };
    }

    // Move to next group
    const nextGroup = groups[currentIndex + 1];
    const entries = await Flight.getGroupEntries(nextGroup.id);
    
    if (entries.length === 0) {
      return { finished: true, state, message: 'No athletes in next group' };
    }

    // Get first athlete of next group (round 1, same lift)
    const firstAthlete = await this._getFirstAthleteForRound(entries, state.current_lift_id, 1);

    // Update state
    await CurrentState.update({
      current_group_id: nextGroup.id,
      current_reg_id: firstAthlete.reg_id,
      current_round: 1
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
   * - Order based on DECLARED WEIGHT for current round (ASC)
   * - If tied: BODYWEIGHT DESC (heavier athlete goes first)
   * - Does NOT depend on previous attempt result (VALID/INVALID)
   * - Athletes who haven't attempted this round yet
   * 
   * @param {number} groupId - Group ID
   * @param {string} liftId - Lift ID
   * @param {number} round - Round number (1, 2, 3)
   * @returns {Promise<Array>} Ordered list of athletes by declared weight
   */
  async getUpcomingOrder(groupId, liftId, round) {
    // Get all athletes in group
    const entries = await Flight.getGroupEntries(groupId);

    // Get athletes with declared weights
    const athletesWithWeights = await Promise.all(
      entries.map(async (entry) => {
        // Check if already attempted this round
        const attempts = await Attempt.findByRegistrationAndLift(entry.reg_id, liftId);
        const hasAttemptedThisRound = attempts.some(
          a => a.attempt_no === round && a.status !== 'PENDING'
        );

        if (hasAttemptedThisRound) {
          return null; // Skip athletes who already lifted this round
        }

        // Get declared weight for this round
        let declaredWeight;
        
        if (round === 1) {
          // Round 1: Use opener from registration_maxes
          const openers = await Registration.getOpeners(entry.reg_id);
          declaredWeight = openers[liftId];
        } else {
          // Rounds 2-3: Use weight declared in attempt record
          // The weight should be set when athlete declares it after previous attempt
          const currentAttempt = attempts.find(
            a => a.attempt_no === round && a.status === 'PENDING'
          );
          declaredWeight = currentAttempt?.weight_kg;
        }

        // Skip if no weight declared yet
        if (!declaredWeight || declaredWeight === 0) {
          return null;
        }

        return {
          ...entry,
          declaredWeight
        };
      })
    );

    // Filter out nulls and sort
    const validAthletes = athletesWithWeights.filter(a => a !== null);

    // Sort by declared weight ASC, then bodyweight DESC
    validAthletes.sort((a, b) => {
      if (a.declaredWeight !== b.declaredWeight) {
        return a.declaredWeight - b.declaredWeight; // Lower weight first
      }
      // If same declared weight, heavier athlete goes first
      return b.bodyweight_kg - a.bodyweight_kg;
    });

    return validAthletes;
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
   * Declare weight for next attempt (athlete calls weight during/after current attempt)
   * Creates or updates attempt record with declared weight
   * 
   * @param {number} regId - Registration ID
   * @param {string} liftId - Lift ID
   * @param {number} attemptNo - Attempt number to declare weight for (2 or 3)
   * @param {number} weightKg - Weight in kg
   * @returns {Promise<number>} Attempt ID
   */
  async declareWeight(regId, liftId, attemptNo, weightKg) {
    // Check if attempt record already exists
    const attempts = await Attempt.findByRegistrationAndLift(regId, liftId);
    const existingAttempt = attempts.find(a => a.attempt_no === attemptNo);

    if (existingAttempt) {
      // Update existing attempt
      await Attempt.updateWeight(existingAttempt.id, weightKg);
      return existingAttempt.id;
    } else {
      // Create new attempt record with declared weight
      const attemptId = await Attempt.create({
        reg_id: regId,
        lift_id: liftId,
        attempt_no: attemptNo,
        weight_kg: weightKg,
        status: 'PENDING'
      });
      return attemptId;
    }
  }

  /**
   * Update current attempt weight (for round 1 or corrections)
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
