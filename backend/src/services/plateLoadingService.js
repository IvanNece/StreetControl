/**
 * PlateLoadingService
 * 
 * Calcola i dischi necessari per caricare un determinato peso su bilanciere o cintura.
 * Gestisce due tipi di alzate:
 * - SQUAT, MILITARY_PRESS: usano bilanciere da 20kg, dischi distribuiti su entrambi i lati
 * - MU, PULL, DIP: peso attaccato direttamente a cintura, nessun bilanciere
 * 
 * Algoritmo greedy: usa sempre i dischi più pesanti possibili per minimizzare il numero di dischi.
 */

// Configurazione dischi disponibili (ordinati per peso decrescente)
const AVAILABLE_PLATES = [
  { weight: 25, color: 'red', label: 'Rosso 25kg' },
  { weight: 20, color: 'blue', label: 'Blu 20kg' },
  { weight: 15, color: 'yellow', label: 'Giallo 15kg' },
  { weight: 10, color: 'green', label: 'Verde 10kg' },
  { weight: 5, color: 'white', label: 'Bianco 5kg' },
  { weight: 2.5, color: 'black', label: 'Nero 2.5kg' },
  { weight: 1.25, color: 'chrome', label: 'Cromato 1.25kg' },
  { weight: 1, color: 'silver', label: 'Argento 1kg' },
  { weight: 0.5, color: 'silver-small', label: 'Argento 0.5kg' }
];

const BARBELL_WEIGHT = 20; // kg

// Alzate che richiedono bilanciere
const BARBELL_LIFTS = ['SQUAT', 'MILITARY_PRESS'];

// Incrementi minimi per alzata (kg)
// Modificare questi valori se cambia il regolamento
const MINIMUM_INCREMENTS = {
  'SQUAT': 1.25,
  'MILITARY_PRESS': 1.25,
  'DIP': 1.25,
  'PULL': 1.25,
  'MU': 1.25
};

// Incrementi speciali per tentativi di record
const RECORD_INCREMENTS = [0.5, 1.0, 1.25];

class PlateLoadingService {
  /**
   * Calcola il caricamento dischi per un peso target
   * @param {number} targetWeight - Peso totale da raggiungere (kg)
   * @param {string} liftName - Nome dell'alzata (SQUAT, MU, DIP, PULL, MILITARY_PRESS)
   * @param {Object} options - Opzioni aggiuntive
   * @param {boolean} options.isRecordAttempt - Se true, permette incrementi da 0.5kg o 1kg
   * @returns {Object} { plates: Array, totalWeight: number, isValid: boolean, error: string }
   */
  calculatePlateLoading(targetWeight, liftName, options = {}) {
    if (targetWeight <= 0) {
      return {
        plates: [],
        totalWeight: 0,
        isValid: false,
        error: 'Peso target deve essere maggiore di 0'
      };
    }

    const useBarbell = BARBELL_LIFTS.includes(liftName);

    if (useBarbell) {
      return this._calculateBarbellLoading(targetWeight);
    } else {
      return this._calculateBeltLoading(targetWeight);
    }
  }

  /**
   * Calcola caricamento per alzate con bilanciere (SQUAT, MILITARY_PRESS)
   * I dischi vengono distribuiti equamente su entrambi i lati
   * @private
   */
  _calculateBarbellLoading(targetWeight) {
    if (targetWeight < BARBELL_WEIGHT) {
      return {
        plates: [],
        totalWeight: BARBELL_WEIGHT,
        isValid: false,
        error: `Peso minimo ${BARBELL_WEIGHT}kg (bilanciere vuoto)`
      };
    }

    // Peso da caricare sui dischi (tolto il bilanciere)
    const plateWeight = targetWeight - BARBELL_WEIGHT;

    // Peso per lato (metà del totale)
    const weightPerSide = plateWeight / 2;

    // Verifica che sia divisibile per 2 (altrimenti impossibile bilanciare)
    if (plateWeight % 2 !== 0 && !this._isValidIncrement(plateWeight)) {
      return {
        plates: [],
        totalWeight: BARBELL_WEIGHT,
        isValid: false,
        error: 'Peso non bilanciabile: il peso sui dischi deve essere pari'
      };
    }

    // Calcola dischi per un lato usando algoritmo greedy
    const platesOneSide = this._greedyPlateSelection(weightPerSide);

    if (!platesOneSide) {
      return {
        plates: [],
        totalWeight: BARBELL_WEIGHT,
        isValid: false,
        error: `Impossibile caricare ${weightPerSide}kg per lato con i dischi disponibili`
      };
    }

    // Calcola peso effettivo
    const actualPlateWeight = platesOneSide.reduce((sum, p) => sum + (p.weight * p.qty), 0) * 2;
    const actualTotalWeight = BARBELL_WEIGHT + actualPlateWeight;

    return {
      plates: platesOneSide,
      totalWeight: actualTotalWeight,
      useBarbell: true,
      barbellWeight: BARBELL_WEIGHT,
      weightPerSide: weightPerSide,
      isValid: Math.abs(actualTotalWeight - targetWeight) < 0.01,
      displaySide: 'right' // Mostra solo lato destro agli spotter
    };
  }

  /**
   * Calcola caricamento per alzate con cintura (MU, PULL, DIP)
   * Peso totale diretto, nessun bilanciere
   * @private
   */
  _calculateBeltLoading(targetWeight) {
    const plates = this._greedyPlateSelection(targetWeight);

    if (!plates) {
      return {
        plates: [],
        totalWeight: 0,
        isValid: false,
        error: `Impossibile caricare ${targetWeight}kg con i dischi disponibili`
      };
    }

    const actualWeight = plates.reduce((sum, p) => sum + (p.weight * p.qty), 0);

    return {
      plates,
      totalWeight: actualWeight,
      useBarbell: false,
      isValid: Math.abs(actualWeight - targetWeight) < 0.01
    };
  }

  /**
   * Algoritmo greedy per selezionare i dischi
   * Usa sempre i dischi più pesanti possibili
   * @private
   * @param {number} targetWeight - Peso da raggiungere
   * @returns {Array|null} Array di {weight, color, label, qty} o null se impossibile
   */
  _greedyPlateSelection(targetWeight) {
    let remaining = targetWeight;
    const selectedPlates = [];
    const tolerance = 0.01; // Tolleranza per errori floating point

    for (const plate of AVAILABLE_PLATES) {
      if (remaining < tolerance) break;

      const qty = Math.floor(remaining / plate.weight);
      
      if (qty > 0) {
        selectedPlates.push({
          weight: plate.weight,
          color: plate.color,
          label: plate.label,
          qty: qty
        });
        remaining -= qty * plate.weight;
      }
    }

    // Verifica che abbiamo raggiunto il peso target (con tolleranza)
    if (Math.abs(remaining) > tolerance) {
      return null; // Impossibile caricare esattamente questo peso
    }

    return selectedPlates;
  }

  /**
   * Calcola il cambio dischi tra un tentativo e il successivo
   * @param {number} previousWeight - Peso precedente
   * @param {number} nextWeight - Peso successivo
   * @param {string} liftName - Nome alzata
   * @returns {Object} { toRemove: Array, toAdd: Array, previousPlates: Object, nextPlates: Object }
   */
  calculatePlateChange(previousWeight, nextWeight, liftName) {
    const previousLoading = this.calculatePlateLoading(previousWeight, liftName);
    const nextLoading = this.calculatePlateLoading(nextWeight, liftName);

    if (!previousLoading.isValid || !nextLoading.isValid) {
      return {
        toRemove: [],
        toAdd: [],
        previousPlates: previousLoading,
        nextPlates: nextLoading,
        error: 'Uno dei due pesi non è valido'
      };
    }

    // Crea mappa dei dischi precedenti e successivi
    const prevMap = new Map();
    previousLoading.plates.forEach(p => prevMap.set(p.weight, p.qty));

    const nextMap = new Map();
    nextLoading.plates.forEach(p => nextMap.set(p.weight, p.qty));

    const toRemove = [];
    const toAdd = [];

    // Trova dischi da rimuovere
    prevMap.forEach((qty, weight) => {
      const nextQty = nextMap.get(weight) || 0;
      if (qty > nextQty) {
        const plate = AVAILABLE_PLATES.find(p => p.weight === weight);
        toRemove.push({
          ...plate,
          qty: qty - nextQty
        });
      }
    });

    // Trova dischi da aggiungere
    nextMap.forEach((qty, weight) => {
      const prevQty = prevMap.get(weight) || 0;
      if (qty > prevQty) {
        const plate = AVAILABLE_PLATES.find(p => p.weight === weight);
        toAdd.push({
          ...plate,
          qty: qty - prevQty
        });
      }
    });

    return {
      toRemove: toRemove.sort((a, b) => b.weight - a.weight),
      toAdd: toAdd.sort((a, b) => b.weight - a.weight),
      previousPlates: previousLoading,
      nextPlates: nextLoading,
      weightDifference: nextWeight - previousWeight
    };
  }

  /**
   * Verifica se un peso è caricabile con i dischi disponibili
   * @param {number} targetWeight - Peso da verificare
   * @param {string} liftName - Nome alzata
   * @param {Object} options - Opzioni aggiuntive
   * @param {boolean} options.isRecordAttempt - Se true, permette incrementi record
   * @returns {boolean}
   */
  isLoadable(targetWeight, liftName, options = {}) {
    const result = this.calculatePlateLoading(targetWeight, liftName, options);
    return result.isValid;
  }

  /**
   * Valida un incremento di peso tra due tentativi
   * @param {number} previousWeight - Peso precedente
   * @param {number} nextWeight - Peso successivo
   * @param {string} liftName - Nome alzata
   * @param {boolean} isRecordAttempt - Se true, permette incrementi da 0.5kg/1kg
   * @returns {Object} { isValid: boolean, error: string, increment: number, allowedIncrements: Array }
   */
  validateWeightIncrement(previousWeight, nextWeight, liftName, isRecordAttempt = false) {
    const increment = nextWeight - previousWeight;
    
    if (increment < 0) {
      return {
        isValid: false,
        error: 'Il peso successivo deve essere maggiore o uguale al precedente',
        increment,
        allowedIncrements: this.getAllowedIncrements(liftName, isRecordAttempt)
      };
    }

    if (increment === 0) {
      return {
        isValid: true,
        increment: 0,
        allowedIncrements: this.getAllowedIncrements(liftName, isRecordAttempt),
        note: 'Stesso peso (ripetizione tentativo non valido)'
      };
    }

    const allowedIncrements = this.getAllowedIncrements(liftName, isRecordAttempt);
    const minIncrement = Math.min(...allowedIncrements);

    // Verifica che l'incremento sia multiplo di uno degli incrementi permessi
    const isValidIncrement = allowedIncrements.some(allowed => {
      return Math.abs(increment % allowed) < 0.01 || increment >= allowed;
    });

    if (!isValidIncrement || increment < minIncrement) {
      return {
        isValid: false,
        error: `Incremento minimo per ${liftName}: ${minIncrement}kg${isRecordAttempt ? ' (tentativo record: 0.5kg/1kg permessi)' : ''}`,
        increment,
        allowedIncrements
      };
    }

    return {
      isValid: true,
      increment,
      allowedIncrements,
      isRecordAttempt
    };
  }

  /**
   * Ottieni gli incrementi permessi per un'alzata
   * @param {string} liftName - Nome alzata
   * @param {boolean} isRecordAttempt - Se true, include incrementi record
   * @returns {Array} Array di incrementi permessi in kg
   */
  getAllowedIncrements(liftName, isRecordAttempt = false) {
    const standardIncrement = MINIMUM_INCREMENTS[liftName] || 1.25;
    
    if (isRecordAttempt) {
      // Per tentativi di record, permetti incrementi speciali
      return [...RECORD_INCREMENTS, standardIncrement].sort((a, b) => a - b);
    }
    
    return [standardIncrement];
  }

  /**
   * Ottieni pesi caricabili più vicini a un target (per suggerimenti)
   * @param {number} targetWeight - Peso desiderato
   * @param {string} liftName - Nome alzata
   * @param {number} range - Range di ricerca (default 10kg)
   * @returns {Array} Array di pesi validi vicini al target
   */
  getSuggestedWeights(targetWeight, liftName, range = 10) {
    const suggestions = [];
    const increment = 0.5; // Incremento minimo

    for (let w = targetWeight - range; w <= targetWeight + range; w += increment) {
      if (w > 0 && this.isLoadable(w, liftName)) {
        suggestions.push({
          weight: w,
          difference: Math.abs(w - targetWeight)
        });
      }
    }

    return suggestions
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 10); // Top 10 suggerimenti
  }

  /**
   * Verifica se un peso è un incremento valido (es: 0.5kg, 1kg, 2.5kg, etc)
   * @private
   */
  _isValidIncrement(weight) {
    const validIncrements = [0.5, 1, 1.25, 2.5, 5, 10, 15, 20, 25];
    return validIncrements.some(inc => Math.abs(weight % inc) < 0.01);
  }

  /**
   * Ottieni configurazione dischi disponibili
   * @returns {Array}
   */
  getAvailablePlates() {
    return [...AVAILABLE_PLATES];
  }

  /**
   * Ottieni peso bilanciere
   * @returns {number}
   */
  getBarbellWeight() {
    return BARBELL_WEIGHT;
  }

  /**
   * Ottieni incremento minimo per un'alzata
   * @param {string} liftName - Nome alzata
   * @returns {number}
   */
  getMinimumIncrement(liftName) {
    return MINIMUM_INCREMENTS[liftName] || 1.25;
  }

  /**
   * Ottieni configurazione incrementi
   * @returns {Object}
   */
  getIncrementsConfig() {
    return {
      standard: { ...MINIMUM_INCREMENTS },
      record: [...RECORD_INCREMENTS]
    };
  }
}

// Export singleton
export default new PlateLoadingService();
