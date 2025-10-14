# Plate Loading Service - Test Manual

Script CLI interattivo per testare il calcolo dei dischi da caricare per ogni alzata.

## 🚀 Utilizzo

### 1. Modalità Interattiva (consigliata)
```bash
node test/manual-plate-test.js
```

Ti permette di:
- Selezionare l'alzata da un menu
- Inserire il peso target
- Testare il cambio dischi tra tentativi
- Visualizzazione colorata con grafica

### 2. Test Rapido Peso Singolo
```bash
node test/manual-plate-test.js <ALZATA> <PESO> [record]
```

**Esempi:**
```bash
# Squat con bilanciere (tentativo normale)
node test/manual-plate-test.js SQUAT 100

# Squat con incremento record (0.5kg/1kg permessi)
node test/manual-plate-test.js SQUAT 100.5 record

# Dip con cintura
node test/manual-plate-test.js DIP 50

# Military Press tentativo record
node test/manual-plate-test.js MILITARY_PRESS 80.5 record
```

### 3. Test Cambio Dischi
```bash
node test/manual-plate-test.js change <ALZATA> <PESO_DA> <PESO_A> [record]
```

**Esempi:**
```bash
# Cambio normale da 60kg a 100kg su squat
node test/manual-plate-test.js change SQUAT 60 100

# Tentativo di record con incremento 0.5kg
node test/manual-plate-test.js change SQUAT 100 100.5 record

# Tentativo di record con incremento 1kg
node test/manual-plate-test.js change DIP 50 51 record
```

### 4. Mostra Configurazione Incrementi
```bash
node test/manual-plate-test.js config
```

Visualizza gli incrementi minimi configurati per ogni alzata e gli incrementi speciali per tentativi di record.

## 📋 Alzate Supportate

### Con Bilanciere (20kg)
- **SQUAT** - Dischi distribuiti su entrambi i lati
- **MILITARY_PRESS** - Dischi distribuiti su entrambi i lati

### Con Cintura (peso diretto)
- **DIP** - Peso totale diretto
- **PULL** - Peso totale diretto
- **MU** - Peso totale diretto

## 🎨 Dischi Disponibili

| Peso (kg) | Colore | Diametro |
|-----------|--------|----------|
| 25 | 🔴 Rosso | Grande |
| 20 | 🔵 Blu | Grande |
| 15 | 🟡 Giallo | Grande |
| 10 | 🟢 Verde | Grande |
| 5 | ⚪ Bianco | Grande |
| 2.5 | ⚫ Nero | Medio |
| 1.25 | 💿 Cromato | Piccolo |
| 1 | 🥈 Argento | Piccolo |
| 0.5 | 🥈 Argento | Piccolo |


## ⚠️ Validazione

### Peso non valido:
Se inserisci un peso che non può essere caricato con i dischi disponibili, riceverai:
- ❌ Messaggio di errore
- 💡 Suggerimenti con pesi validi vicini al target

**Esempio:**
```bash
node test/manual-plate-test.js SQUAT 21
```
Output:
```
❌ ERRORE: Peso non bilanciabile: il peso sui dischi deve essere pari

💡 SUGGERIMENTI PESI VALIDI VICINI:
  1. 20kg (+1.00kg dal target)
  2. 22.5kg (+1.50kg dal target)
  3. 25kg (+4.00kg dal target)
```

## 🧮 Algoritmo

Il servizio usa un **algoritmo greedy** che:
1. Prioritizza sempre i dischi più pesanti
2. Minimizza il numero totale di dischi
3. Garantisce bilanciamento perfetto (per alzate con bilanciere)

### Esempio calcolo 67.5kg squat:
```
Peso target: 67.5kg
- Bilanciere: 20kg
- Peso dischi: 47.5kg
- Per lato: 23.75kg

Algoritmo greedy:
23.75kg = 1×20kg + 1×2.5kg + 1×1.25kg ✅
```

## 🔧 Configurazione

La configurazione dei dischi disponibili è in `src/services/plateLoadingService.js`:

```javascript
const AVAILABLE_PLATES = [
  { weight: 25, color: 'red', label: 'Rosso 25kg' },
  { weight: 20, color: 'blue', label: 'Blu 20kg' },
  // ... altri dischi
];

const BARBELL_WEIGHT = 20; // kg
```

## 📝 Note

- **Visualizzazione lato**: Per alzate con bilanciere, viene mostrato solo un lato (i dischi vanno moltiplicati ×2)
- **Tolleranza floating point**: L'algoritmo usa una tolleranza di 0.01kg per errori numerici
- **Pesi standard**: Il sistema supporta incrementi minimi di 0.5kg

## ⚙️ Configurazione Incrementi

### Incrementi Minimi Standard
Per ogni alzata è configurato un incremento minimo tra tentativi:

| Alzata | Incremento Minimo |
|--------|-------------------|
| SQUAT | **1.25kg** |
| MILITARY_PRESS | **1.25kg** |
| DIP | **1.25kg** |
| PULL | **1.25kg** |
| MU | **1.25kg** |

> 💡 **Modificabile:** Questi valori sono configurabili nel file `plateLoadingService.js` nella costante `MINIMUM_INCREMENTS`

### Incrementi Speciali per Record 🏆

Quando un atleta tenta un **record**, sono permessi incrementi più piccoli:
- **0.5kg** ✅
- **1.0kg** ✅
- **1.25kg** ✅ (incremento standard)

**Esempio:**
```bash
# Tentativo normale: incremento minimo 1.25kg
node test/manual-plate-test.js change SQUAT 100 101.25

# Tentativo record: incremento 0.5kg permesso
node test/manual-plate-test.js change SQUAT 100 100.5 record
```

### Validazione Automatica

Il servizio valida automaticamente gli incrementi:

```javascript
// ✅ VALIDO - Incremento standard 1.25kg
validateWeightIncrement(100, 101.25, 'SQUAT', false)

// ❌ INVALIDO - Incremento 0.5kg senza flag record
validateWeightIncrement(100, 100.5, 'SQUAT', false)

// ✅ VALIDO - Incremento 0.5kg con flag record
validateWeightIncrement(100, 100.5, 'SQUAT', true)
```

## 🐛 Troubleshooting

### "Peso non bilanciabile"
Il peso sui dischi (tolto il bilanciere) deve essere pari per poter essere distribuito equamente.

**❌ NON VALIDO:**
- SQUAT 21kg → 1kg sui dischi (dispari)

**✅ VALIDO:**
- SQUAT 22.5kg → 2.5kg sui dischi (pari: 1.25kg per lato)

### "Incremento minimo non rispettato"
Tra un tentativo e il successivo devi rispettare l'incremento minimo configurato (1.25kg standard).

**❌ NON VALIDO:**
- Da 100kg a 100.5kg (senza flag record)

**✅ VALIDO:**
- Da 100kg a 101.25kg (incremento standard)
- Da 100kg a 100.5kg **con flag record** 🏆

### "Impossibile caricare"
Alcuni pesi non sono raggiungibili con i dischi disponibili.

**Esempio:** 21.3kg non è raggiungibile (incremento minimo 0.5kg)
