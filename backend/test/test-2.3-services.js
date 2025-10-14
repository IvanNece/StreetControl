/**
 * TEST PHASE 2.3 - Services Integration
 * 
 * Tests for:
 * - validationService (2/3 vote rule)
 * - stateMachine (NEXT button, athlete ordering)
 * - rankingService (Wilks calculation)
 * - qrCodeService (QR generation)
 */

import { expect } from 'chai';
import validationService from '../src/services/validationService.js';
import rankingService from '../src/services/rankingService.js';

describe('Phase 2.3 - Services', () => {
  
  // ============================================
  // VALIDATION SERVICE TESTS
  // ============================================
  
  describe('validationService', () => {
    beforeEach(() => {
      // Clear votes before each test
      validationService.clearAllVotes();
    });

    it('should register votes from 3 judges', () => {
      const attemptId = 1;
      
      // First vote
      let result = validationService.registerVote(attemptId, 'HEAD', 'WHITE');
      expect(result.isComplete).to.be.false;
      expect(result.result).to.be.null;
      
      // Second vote
      result = validationService.registerVote(attemptId, 'LEFT', 'WHITE');
      expect(result.isComplete).to.be.false;
      
      // Third vote
      result = validationService.registerVote(attemptId, 'RIGHT', 'RED');
      expect(result.isComplete).to.be.true;
      expect(result.result).to.equal('VALID'); // 2 whites = VALID
    });

    it('should calculate VALID with 2 WHITE votes', () => {
      const attemptId = 2;
      
      validationService.registerVote(attemptId, 'HEAD', 'WHITE');
      validationService.registerVote(attemptId, 'LEFT', 'WHITE');
      const result = validationService.registerVote(attemptId, 'RIGHT', 'RED');
      
      expect(result.result).to.equal('VALID');
    });

    it('should calculate INVALID with 2 RED votes', () => {
      const attemptId = 3;
      
      validationService.registerVote(attemptId, 'HEAD', 'RED');
      validationService.registerVote(attemptId, 'LEFT', 'RED');
      const result = validationService.registerVote(attemptId, 'RIGHT', 'WHITE');
      
      expect(result.result).to.equal('INVALID');
    });

    it('should calculate VALID with 3 WHITE votes', () => {
      const attemptId = 4;
      
      validationService.registerVote(attemptId, 'HEAD', 'WHITE');
      validationService.registerVote(attemptId, 'LEFT', 'WHITE');
      const result = validationService.registerVote(attemptId, 'RIGHT', 'WHITE');
      
      expect(result.result).to.equal('VALID');
    });

    it('should calculate INVALID with 3 RED votes', () => {
      const attemptId = 5;
      
      validationService.registerVote(attemptId, 'HEAD', 'RED');
      validationService.registerVote(attemptId, 'LEFT', 'RED');
      const result = validationService.registerVote(attemptId, 'RIGHT', 'RED');
      
      expect(result.result).to.equal('INVALID');
    });

    it('should track vote count', () => {
      const attemptId = 6;
      
      expect(validationService.getVoteCount(attemptId)).to.equal(0);
      
      validationService.registerVote(attemptId, 'HEAD', 'WHITE');
      expect(validationService.getVoteCount(attemptId)).to.equal(1);
      
      validationService.registerVote(attemptId, 'LEFT', 'RED');
      expect(validationService.getVoteCount(attemptId)).to.equal(2);
      
      validationService.registerVote(attemptId, 'RIGHT', 'WHITE');
      expect(validationService.getVoteCount(attemptId)).to.equal(3);
    });

    it('should detect if judge has already voted', () => {
      const attemptId = 7;
      
      expect(validationService.hasVoted(attemptId, 'HEAD')).to.be.false;
      
      validationService.registerVote(attemptId, 'HEAD', 'WHITE');
      expect(validationService.hasVoted(attemptId, 'HEAD')).to.be.true;
      expect(validationService.hasVoted(attemptId, 'LEFT')).to.be.false;
    });

    it('should clear votes after finalization', () => {
      const attemptId = 8;
      
      validationService.registerVote(attemptId, 'HEAD', 'WHITE');
      validationService.registerVote(attemptId, 'LEFT', 'WHITE');
      validationService.registerVote(attemptId, 'RIGHT', 'RED');
      
      expect(validationService.getVotes(attemptId)).to.not.be.null;
      
      validationService.clearVotes(attemptId);
      expect(validationService.getVotes(attemptId)).to.be.null;
    });

    it('should reject invalid judge role', () => {
      const attemptId = 9;
      
      expect(() => {
        validationService.registerVote(attemptId, 'INVALID_ROLE', 'WHITE');
      }).to.throw('Invalid judge role');
    });

    it('should reject invalid vote', () => {
      const attemptId = 10;
      
      expect(() => {
        validationService.registerVote(attemptId, 'HEAD', 'YELLOW');
      }).to.throw('Invalid vote');
    });
  });

  // ============================================
  // RANKING SERVICE TESTS
  // ============================================
  
  describe('rankingService', () => {
    
    it('should calculate RIS for male athlete', () => {
      const total = 100; // kg
      const bodyweight = 75; // kg
      const sex = 'M';
      
      const ris = rankingService.calculateRIS(total, bodyweight, sex);
      
      expect(ris).to.be.a('number');
      expect(ris).to.be.greaterThan(0);
      // Actual RIS for 100kg at 75kg BW (M) ≈ 20.96
      expect(ris).to.be.approximately(20.96, 0.5);
    });

    it('should calculate RIS for female athlete', () => {
      const total = 60; // kg
      const bodyweight = 60; // kg
      const sex = 'F';
      
      const ris = rankingService.calculateRIS(total, bodyweight, sex);
      
      expect(ris).to.be.a('number');
      expect(ris).to.be.greaterThan(0);
      // Actual RIS for 60kg at 60kg BW (F) ≈ 24.28
      expect(ris).to.be.approximately(24.28, 0.5);
    });

    it('should return 0 for zero total', () => {
      const ris = rankingService.calculateRIS(0, 75, 'M');
      expect(ris).to.equal(0);
    });

    it('should return 0 for zero bodyweight', () => {
      const ris = rankingService.calculateRIS(100, 0, 'M');
      expect(ris).to.equal(0);
    });

    it('should round RIS to 2 decimals', () => {
      const ris = rankingService.calculateRIS(100, 75, 'M');
      const decimals = ris.toString().split('.')[1]?.length || 0;
      expect(decimals).to.be.lessThanOrEqual(2);
    });

    it('should calculate higher RIS for lighter athlete with same total', () => {
      const total = 100;
      const ris1 = rankingService.calculateRIS(total, 75, 'M');
      const ris2 = rankingService.calculateRIS(total, 85, 'M');
      
      // Lighter athlete should have higher RIS
      expect(ris1).to.be.greaterThan(ris2);
    });
  });

  // ============================================
  // INTEGRATION SUMMARY
  // ============================================
  
  describe('Integration Summary', () => {
    it('should have all services available', () => {
      expect(validationService).to.exist;
      expect(rankingService).to.exist;
      expect(validationService.registerVote).to.be.a('function');
      expect(rankingService.calculateRIS).to.be.a('function');
    });
  });
});
