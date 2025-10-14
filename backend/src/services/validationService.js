/**
 * Validation Service
 * 
 * Manages judge votes and validates attempts using 2/3 rule
 * - Stores votes IN MEMORY only (NOT in database)
 * - 2 WHITE votes = VALID attempt
 * - 2 RED votes = INVALID attempt
 * - Votes are cleared after result is determined
 */

import Attempt from '../models/Attempt.js';

class ValidationService {
  constructor() {
    // In-memory storage: Map<attemptId, Map<judgeRole, vote>>
    // Example: { 123: { 'HEAD': 'WHITE', 'LEFT': 'RED', 'RIGHT': 'WHITE' } }
    this.votes = new Map();
  }

  /**
   * Register a judge vote for an attempt
   * @param {number} attemptId - Attempt ID
   * @param {string} judgeRole - Judge role ('HEAD', 'LEFT', 'RIGHT')
   * @param {string} vote - Vote ('WHITE' or 'RED')
   * @returns {Object} { isComplete, result, votes }
   */
  registerVote(attemptId, judgeRole, vote) {
    // Validate inputs
    if (!['HEAD', 'LEFT', 'RIGHT'].includes(judgeRole)) {
      throw new Error(`Invalid judge role: ${judgeRole}`);
    }
    if (!['WHITE', 'RED'].includes(vote)) {
      throw new Error(`Invalid vote: ${vote}`);
    }

    // Initialize votes for this attempt if not exists
    if (!this.votes.has(attemptId)) {
      this.votes.set(attemptId, new Map());
    }

    // Store the vote
    const attemptVotes = this.votes.get(attemptId);
    attemptVotes.set(judgeRole, vote);

    // Check if voting is complete (all 3 judges voted)
    const isComplete = attemptVotes.size === 3;
    
    // Calculate result if complete
    let result = null;
    if (isComplete) {
      result = this._calculateResult(attemptVotes);
    }

    // Return current vote state
    return {
      isComplete,
      result,
      votes: Object.fromEntries(attemptVotes)
    };
  }

  /**
   * Calculate result using 2/3 rule
   * @param {Map} attemptVotes - Map of judgeRole -> vote
   * @returns {string} 'VALID' or 'INVALID'
   * @private
   */
  _calculateResult(attemptVotes) {
    const votesArray = Array.from(attemptVotes.values());
    const whiteCount = votesArray.filter(v => v === 'WHITE').length;
    const redCount = votesArray.filter(v => v === 'RED').length;

    // 2/3 rule: 2 or more whites = VALID, 2 or more reds = INVALID
    if (whiteCount >= 2) {
      return 'VALID';
    } else if (redCount >= 2) {
      return 'INVALID';
    }
    
    // Should never happen with 3 judges, but safety fallback
    return 'INVALID';
  }

  /**
   * Get current votes for an attempt
   * @param {number} attemptId - Attempt ID
   * @returns {Object|null} { votes, isComplete, result }
   */
  getVotes(attemptId) {
    if (!this.votes.has(attemptId)) {
      return null;
    }

    const attemptVotes = this.votes.get(attemptId);
    const isComplete = attemptVotes.size === 3;
    const result = isComplete ? this._calculateResult(attemptVotes) : null;

    return {
      votes: Object.fromEntries(attemptVotes),
      isComplete,
      result
    };
  }

  /**
   * Clear votes for an attempt (after result is saved)
   * @param {number} attemptId - Attempt ID
   */
  clearVotes(attemptId) {
    this.votes.delete(attemptId);
  }

  /**
   * Clear ALL votes (e.g., when starting new meet)
   */
  clearAllVotes() {
    this.votes.clear();
  }

  /**
   * Finalize attempt: save result to database and clear votes
   * @param {number} attemptId - Attempt ID
   * @param {string} result - Result ('VALID' or 'INVALID')
   * @returns {Promise<void>}
   */
  async finalizeAttempt(attemptId, result) {
    // Update attempt status in database
    await Attempt.updateStatus(attemptId, result);
    
    // Clear votes from memory
    this.clearVotes(attemptId);
  }

  /**
   * Check if judge has already voted for this attempt
   * @param {number} attemptId - Attempt ID
   * @param {string} judgeRole - Judge role
   * @returns {boolean}
   */
  hasVoted(attemptId, judgeRole) {
    if (!this.votes.has(attemptId)) {
      return false;
    }
    return this.votes.get(attemptId).has(judgeRole);
  }

  /**
   * Get number of votes received for an attempt
   * @param {number} attemptId - Attempt ID
   * @returns {number} Number of votes (0-3)
   */
  getVoteCount(attemptId) {
    if (!this.votes.has(attemptId)) {
      return 0;
    }
    return this.votes.get(attemptId).size;
  }
}

// Singleton instance
const validationService = new ValidationService();

export default validationService;
