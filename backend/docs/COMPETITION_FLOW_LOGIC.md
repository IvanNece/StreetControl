# 🏋️ LOGICA FLUSSO GARA - Documentazione Completa

## 📋 Struttura Competizione

```
Meet (Gara)
  └─ Flight (Turno)
      ├─ Group 1 (Gruppo 1)
      │   ├─ Athlete A
      │   ├─ Athlete B
      │   └─ Athlete C
      └─ Group 2 (Gruppo 2)
          ├─ Athlete D
          ├─ Athlete E
          └─ Athlete F
```

---

## 🔄 Ordine di Esecuzione

### **Flusso Completo per un Flight:**

```
1. Group 1 - Lift 1 (MU) - Attempt 1 (tutti e 3 gli atleti)
2. Group 1 - Lift 1 (MU) - Attempt 2 (tutti e 3 gli atleti)
3. Group 1 - Lift 1 (MU) - Attempt 3 (tutti e 3 gli atleti)
4. Group 2 - Lift 1 (MU) - Attempt 1 (tutti e 3 gli atleti)
5. Group 2 - Lift 1 (MU) - Attempt 2 (tutti e 3 gli atleti)
6. Group 2 - Lift 1 (MU) - Attempt 3 (tutti e 3 gli atleti)
7. Group 1 - Lift 2 (PU) - Attempt 1 (tutti e 3 gli atleti)
... e così via
```

**Regola chiave:** Un gruppo completa TUTTE E 3 le prove di un'alzata prima di passare al gruppo successivo.

---

## 📊 Ordinamento Atleti DENTRO un Gruppo

### **Criterio Primario: Peso Dichiarato (ASC)**

Gli atleti vengono ordinati in base al **peso dichiarato** per quella specifica prova, dal **più basso al più alto**.

### **Criterio Secondario: Bodyweight (DESC)**

A parità di peso dichiarato, l'atleta **più pesante** entra prima.

---

## 🎯 Esempio Pratico Dettagliato

### **Setup Iniziale (Pesa):**

| Atleta | Bodyweight | Opener MU (Prova 1) |
|--------|-----------|---------------------|
| Ivan   | 75 kg     | 90 kg              |
| Fabio  | 80 kg     | 95 kg              |
| Marco  | 70 kg     | 85 kg              |

---

### **PROVA 1 - Ordine di Ingresso:**

Ordinamento: 85 kg < 90 kg < 95 kg

```
1° Marco  (85 kg)
2° Ivan   (90 kg)
3° Fabio  (95 kg)
```

---

### **Durante/Dopo Prova 1 - Dichiarazioni per Prova 2:**

| Atleta | Prova 1 Risultato | Prova 1 Peso | Dichiara Prova 2 |
|--------|------------------|--------------|------------------|
| Marco  | ✅ VALID         | 85 kg        | 92 kg            |
| Ivan   | ✅ VALID         | 90 kg        | 100 kg           |
| Fabio  | ❌ INVALID       | 95 kg        | 95 kg (richiama) |

---

### **PROVA 2 - Ordine di Ingresso:**

Ordinamento: 92 kg < 95 kg < 100 kg

```
1° Marco  (92 kg)
2° Fabio  (95 kg)  ← Entra PRIMA di Ivan anche se era 3° in prova 1
3° Ivan   (100 kg) ← Entra ultimo perché ha chiamato il peso più alto
```

**🔑 Punto chiave:** L'ordine è cambiato rispetto alla prova 1 perché si basa SOLO sui pesi dichiarati, **NON sulla validità del tentativo precedente**.

---

### **Durante/Dopo Prova 2 - Dichiarazioni per Prova 3:**

| Atleta | Prova 2 Risultato | Prova 2 Peso | Dichiara Prova 3 |
|--------|------------------|--------------|------------------|
| Marco  | ✅ VALID         | 92 kg        | 97 kg            |
| Fabio  | ✅ VALID         | 95 kg        | 97 kg            |
| Ivan   | ❌ INVALID       | 100 kg       | 100 kg (richiama)|

---

### **PROVA 3 - Ordine di Ingresso:**

Ordinamento per peso: 97 kg (Marco) = 97 kg (Fabio) < 100 kg (Ivan)

A parità di peso dichiarato (97 kg), ordina per bodyweight DESC:

- Fabio: 80 kg (più pesante)
- Marco: 70 kg (più leggero)

```
1° Fabio  (97 kg, BW 80 kg) ← Entra prima perché più pesante
2° Marco  (97 kg, BW 70 kg)
3° Ivan   (100 kg, BW 75 kg)
```

---

## 💾 Dati nel Database

### **Tabella `registration_maxes` (Openers - Prova 1):**

```sql
INSERT INTO registration_maxes (reg_id, lift_id, max_kg) VALUES
(1, 'MU', 90),   -- Ivan
(2, 'MU', 95),   -- Fabio
(3, 'MU', 85);   -- Marco
```

### **Tabella `attempts` (Tentativi con Dichiarazioni):**

```sql
-- PROVA 1 (completate)
INSERT INTO attempts (reg_id, lift_id, attempt_no, weight_kg, status) VALUES
(3, 'MU', 1, 85, 'VALID'),    -- Marco
(1, 'MU', 1, 90, 'VALID'),    -- Ivan
(2, 'MU', 1, 95, 'INVALID');  -- Fabio

-- PROVA 2 (dichiarazioni + risultati)
INSERT INTO attempts (reg_id, lift_id, attempt_no, weight_kg, status) VALUES
(3, 'MU', 2, 92, 'VALID'),    -- Marco (dichiarato dopo prova 1)
(2, 'MU', 2, 95, 'VALID'),    -- Fabio (richiamato)
(1, 'MU', 2, 100, 'INVALID'); -- Ivan (dichiarato dopo prova 1)

-- PROVA 3 (dichiarazioni - PENDING prima dell'esecuzione)
INSERT INTO attempts (reg_id, lift_id, attempt_no, weight_kg, status) VALUES
(2, 'MU', 3, 97, 'PENDING'),  -- Fabio (entra per primo)
(3, 'MU', 3, 97, 'PENDING'),  -- Marco
(1, 'MU', 3, 100, 'PENDING'); -- Ivan
```

---

## 🔧 Implementazione Tecnica

### **Metodo Chiave: `getUpcomingOrder()`**

```javascript
async getUpcomingOrder(groupId, liftId, round) {
  // 1. Ottieni atleti del gruppo
  const entries = await Flight.getGroupEntries(groupId);
  
  // 2. Per ogni atleta, ottieni il peso dichiarato
  for (const entry of entries) {
    if (round === 1) {
      // Prova 1: leggi da registration_maxes (opener)
      declaredWeight = await Registration.getOpener(reg_id, liftId);
    } else {
      // Prova 2-3: leggi da attempts (peso dichiarato durante prova precedente)
      declaredWeight = attempt.weight_kg; // dove attempt_no === round
    }
  }
  
  // 3. Ordina per:
  //    - Peso dichiarato ASC (più basso prima)
  //    - Bodyweight DESC (più pesante prima se pari)
  athletes.sort((a, b) => {
    if (a.declaredWeight !== b.declaredWeight) {
      return a.declaredWeight - b.declaredWeight;
    }
    return b.bodyweight_kg - a.bodyweight_kg;
  });
  
  return athletes;
}
```

---

## 📱 Workflow Interfaccia Regista

### **Scenario: Atleta completa prova 1**

1. **Atleta entra in pedana** (peso già dichiarato in fase di pesa)
2. **Giudici votano** → validationService calcola risultato
3. **Regista vede risultato** (VALID/INVALID)
4. **Regista chiede all'atleta:** "Quanto vuoi chiamare per la seconda prova?"
5. **Atleta dichiara:** "100 kg"
6. **Regista inserisce:** `stateMachine.declareWeight(regId, 'MU', 2, 100)`
7. **Sistema crea/aggiorna record:** 
   ```sql
   INSERT INTO attempts (reg_id, lift_id, attempt_no, weight_kg, status)
   VALUES (1, 'MU', 2, 100, 'PENDING');
   ```
8. **Regista preme NEXT** → Sistema ricalcola ordine basato su pesi dichiarati
9. **Prossimo atleta entra**

---

## ⚠️ Casi Particolari

### **Caso 1: Atleta non dichiara peso per prova successiva**

```javascript
// Atleta salta il record nell'attempts
// Sistema lo esclude automaticamente dall'ordinamento
if (!declaredWeight || declaredWeight === 0) {
  return null; // Skip questo atleta
}
```

### **Caso 2: Due atleti chiamano stesso peso E stesso bodyweight**

```javascript
// Fallback su start_ord originale (ordine di iscrizione)
if (a.declaredWeight === b.declaredWeight && 
    a.bodyweight_kg === b.bodyweight_kg) {
  return a.start_ord - b.start_ord;
}
```

### **Caso 3: Atleta cambia idea sul peso dichiarato**

```javascript
// Prima della prova: Regista può aggiornare
await stateMachine.updateAttemptWeight(attemptId, newWeight);

// Dopo la prova: NON modificabile (risultato già registrato)
```

---

## 🎬 Passaggio tra Gruppi

### **Quando un gruppo finisce le 3 prove:**

```javascript
// Group 1 completa tutte e 3 le prove di MU
if (current_round === 3 && upcomingOrder.length === 0) {
  // Passa a Group 2, stesso lift (MU), prova 1
  return await _moveToNextGroup(state);
}
```

### **Quando tutto il flight finisce:**

```javascript
// Group 2 completa tutte e 3 le prove di MU
if (isLastGroup && current_round === 3) {
  return { finished: true, message: 'Flight completed' };
}
```

---

## ✅ Vantaggi di Questa Logica

1. **Flessibilità**: Atleti possono scegliere strategicamente i pesi da chiamare
2. **Equità**: Chi chiama pesi più bassi ha più opportunità di recupero
3. **Velocità**: Ordine dinamico evita attese inutili
4. **Trasparenza**: Chiaro a tutti quale atleta entra dopo basandosi sui pesi dichiarati

---

## 🚀 Esempio Completo: 3 Prove, 2 Atleti

```
SETUP:
- Ivan: 75kg BW, opener 90kg
- Fabio: 80kg BW, opener 95kg

═══════════════════════════════════════════
PROVA 1:
  1° Ivan (90kg)  → VALID ✅ → Dichiara 100kg per prova 2
  2° Fabio (95kg) → INVALID ❌ → Dichiara 95kg per prova 2

═══════════════════════════════════════════
PROVA 2:
  1° Fabio (95kg)  → VALID ✅ → Dichiara 100kg per prova 3
  2° Ivan (100kg)  → VALID ✅ → Dichiara 105kg per prova 3

═══════════════════════════════════════════
PROVA 3:
  1° Fabio (100kg) → VALID ✅
  2° Ivan (105kg)  → INVALID ❌

═══════════════════════════════════════════
RISULTATI FINALI:
  Ivan: Best = 100kg (prova 2)
  Fabio: Best = 100kg (prova 3)
  
  Classifica categoria: Fabio 1°, Ivan 2° (stesso peso, Fabio più pesante)
```

---

**Data aggiornamento:** 2025-10-14  
**Versione:** 2.0 (Logica corretta)  
**Status:** ✅ Implementato in stateMachine.js
