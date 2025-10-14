/**
 * Test Suite per Incrementi e Validazione Pesi
 * Test della logica di incrementi minimi e tentativi di record
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import plateLoadingService from '../src/services/plateLoadingService.js';

describe('PlateLoadingService - Increment Validation Tests', () => {
  
  describe('Configurazione Incrementi', () => {
    
    it('Dovrebbe restituire incremento minimo 1.25kg per tutte le alzate', () => {
      expect(plateLoadingService.getMinimumIncrement('SQUAT')).to.equal(1.25);
      expect(plateLoadingService.getMinimumIncrement('MILITARY_PRESS')).to.equal(1.25);
      expect(plateLoadingService.getMinimumIncrement('DIP')).to.equal(1.25);
      expect(plateLoadingService.getMinimumIncrement('PULL')).to.equal(1.25);
      expect(plateLoadingService.getMinimumIncrement('MU')).to.equal(1.25);
    });

    it('Dovrebbe restituire configurazione completa incrementi', () => {
      const config = plateLoadingService.getIncrementsConfig();
      
      expect(config).to.have.property('standard');
      expect(config).to.have.property('record');
      
      expect(config.standard.SQUAT).to.equal(1.25);
      expect(config.record).to.include.members([0.5, 1.0, 1.25]);
    });

    it('Dovrebbe restituire incrementi permessi per tentativo normale', () => {
      const increments = plateLoadingService.getAllowedIncrements('SQUAT', false);
      
      expect(increments).to.have.lengthOf(1);
      expect(increments[0]).to.equal(1.25);
    });

    it('Dovrebbe restituire incrementi permessi per tentativo record', () => {
      const increments = plateLoadingService.getAllowedIncrements('SQUAT', true);
      
      expect(increments).to.have.lengthOf(3);
      expect(increments).to.include.members([0.5, 1.0, 1.25]);
    });
  });

  describe('Validazione Incrementi - Tentativi Normali', () => {
    
    it('Dovrebbe accettare incremento 1.25kg (minimo standard)', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 101.25, 'SQUAT', false);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(1.25);
      expect(result.isRecordAttempt).to.be.undefined;
    });

    it('Dovrebbe accettare incremento 2.5kg (multiplo di 1.25)', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 102.5, 'DIP', false);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(2.5);
    });

    it('Dovrebbe accettare incremento 5kg', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 105, 'PULL', false);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(5);
    });

    it('NON dovrebbe accettare incremento 0.5kg senza flag record', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 100.5, 'DIP', false);
      
      expect(result.isValid).to.be.false;
      expect(result.error).to.include('Incremento minimo');
      expect(result.increment).to.equal(0.5);
    });

    it('NON dovrebbe accettare incremento 1kg senza flag record', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 101, 'MU', false);
      
      expect(result.isValid).to.be.false;
      expect(result.error).to.include('Incremento minimo');
    });

    it('NON dovrebbe accettare incremento negativo', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 95, 'SQUAT', false);
      
      expect(result.isValid).to.be.false;
      expect(result.error).to.include('maggiore o uguale');
      expect(result.increment).to.equal(-5);
    });

    it('Dovrebbe accettare incremento 0 (ripetizione tentativo)', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 100, 'SQUAT', false);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(0);
      expect(result.note).to.include('ripetizione');
    });
  });

  describe('Validazione Incrementi - Tentativi Record', () => {
    
    it('Dovrebbe accettare incremento 0.5kg con flag record', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 100.5, 'DIP', true);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(0.5);
      expect(result.isRecordAttempt).to.be.true;
    });

    it('Dovrebbe accettare incremento 1kg con flag record', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 101, 'PULL', true);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(1);
      expect(result.isRecordAttempt).to.be.true;
    });

    it('Dovrebbe accettare incremento 1.25kg con flag record', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 101.25, 'SQUAT', true);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(1.25);
      expect(result.isRecordAttempt).to.be.true;
    });

    it('Dovrebbe accettare incremento 2kg con flag record (multiplo di 0.5)', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 102, 'MU', true);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(2);
    });

    it('NON dovrebbe accettare incremento 0.25kg nemmeno con flag record', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 100.25, 'DIP', true);
      
      expect(result.isValid).to.be.false;
      expect(result.increment).to.equal(0.25);
    });

    it('Dovrebbe fornire allowedIncrements corretti per record', () => {
      const result = plateLoadingService.validateWeightIncrement(100, 100.5, 'SQUAT', true);
      
      expect(result.allowedIncrements).to.include.members([0.5, 1.0, 1.25]);
    });
  });

  describe('Validazione Caricamento Pesi Record', () => {
    
    it('Dovrebbe calcolare caricamento per peso record su DIP (50.5kg)', () => {
      const result = plateLoadingService.calculatePlateLoading(50.5, 'DIP', { isRecordAttempt: true });
      
      expect(result.isValid).to.be.true;
      expect(result.totalWeight).to.equal(50.5);
      
      // 50.5kg = 2x25kg + 1x0.5kg
      expect(result.plates).to.have.lengthOf(2);
      expect(result.plates[0].weight).to.equal(25);
      expect(result.plates[0].qty).to.equal(2);
      expect(result.plates[1].weight).to.equal(0.5);
      expect(result.plates[1].qty).to.equal(1);
    });

    it('Dovrebbe calcolare caricamento per peso record su MU (37.5kg)', () => {
      const result = plateLoadingService.calculatePlateLoading(37.5, 'MU', { isRecordAttempt: true });
      
      expect(result.isValid).to.be.true;
      expect(result.totalWeight).to.equal(37.5);
    });

    it('Dovrebbe verificare isLoadable per peso record', () => {
      expect(plateLoadingService.isLoadable(50.5, 'DIP', { isRecordAttempt: true })).to.be.true;
      expect(plateLoadingService.isLoadable(101, 'PULL', { isRecordAttempt: true })).to.be.true;
    });
  });

  describe('Edge Cases Incrementi', () => {
    
    it('Dovrebbe gestire incremento molto grande (50kg)', () => {
      const result = plateLoadingService.validateWeightIncrement(50, 100, 'SQUAT', false);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(50);
    });

    it('Dovrebbe gestire decimali con floating point', () => {
      const result = plateLoadingService.validateWeightIncrement(100.25, 101.5, 'DIP', false);
      
      expect(result.isValid).to.be.true;
      expect(result.increment).to.equal(1.25);
    });

    it('Dovrebbe gestire alzata non configurata (default 1.25kg)', () => {
      const minIncrement = plateLoadingService.getMinimumIncrement('UNKNOWN_LIFT');
      
      expect(minIncrement).to.equal(1.25);
    });

    it('Dovrebbe validare cambio dischi con incrementi corretti', () => {
      const change = plateLoadingService.calculatePlateChange(50, 51.25, 'DIP');
      
      expect(change.previousPlates.isValid).to.be.true;
      expect(change.nextPlates.isValid).to.be.true;
      expect(change.weightDifference).to.equal(1.25);
    });
  });

});
