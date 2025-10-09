# StreetControl Backend

Backend per la gestione di competizioni Streetlifting con architettura dual-database (locale + remoto).

## 🏗️ Architettura

- **Database Locale (SQLite)**: Gestione offline della competizione in tempo reale
- **Database Remoto (PostgreSQL/Supabase)**: Archivio storico, record nazionali, classifiche
- **Sincronizzazione**: Sistema ID-agnostic per upload risultati a fine gara

## 📦 Tecnologie

- Node.js + ES Modules
- SQLite3 (database locale)
- PostgreSQL (database remoto via Supabase)
- dotenv (configurazione)

## 🚀 Setup Iniziale

### 1. Installazione

```bash
npm install
```

### 2. Configurazione

Crea un file `.env` nella root del progetto:

```env
DATABASE_REMOTE_URL=postgresql://user:password@host:5432/database
```

> 💡 Ottieni la connection string da Supabase: Settings → Database → Connection string (URI)

### 3. Inizializzazione Database Remoto

Copia e incolla il contenuto di `src/database/remote/init_remote_schema.sql` nel **SQL Editor** di Supabase ed esegui + `query per inserire la federazione iniziale`.

Questo creerà:
- Tabelle standard (federazioni, categorie peso/età)
- Tabelle storiche (atleti, gare, risultati, record)
- Dati iniziali (13 categorie peso, 7 categorie età, record placeholder)

### 4. Inizializzazione Database Locale

```bash
npm run init-db
```

Crea il database SQLite locale (`data/street_control.db`) con lo schema completo per gestire la gara.

### 5. Popolazione Dati di Test

```bash
npm run seed
```

Questo script:
1. Sincronizza categorie e federazioni dal database remoto
2. Genera dati di test locali:
   - 30 atleti (uomini e donne in varie categorie)
   - 1 gara completa (Campionato Italiano 2025)
   - 3 giudici
   - 2 flight, 4 gruppi
   - 120 tentativi (openers per 4 alzate)

## 📊 Flusso di Lavoro

### Durante la Gara (Offline)

Il sistema lavora **completamente offline** usando il database SQLite locale:

1. **Setup**: Creazione gara, registrazione atleti
2. **Pesatura**: Inserimento peso corporeo e categoria
3. **Gestione Tentativi**: Registrazione alzate con stato (VALID/INVALID)
4. **Classifiche in Tempo Reale**: Calcolo automatico punteggi e piazzamenti

### Dopo la Gara (Sincronizzazione)

Al termine della competizione, sincronizza i risultati con il database remoto:

```bash
node src/database/sync.js <MEET_CODE>
```

**Esempio:**
```bash
node src/database/sync.js SLI-2025-ITALIA-01
```

### Cosa fa il Sync?

1. **Sincronizza Atleti** → Carica su `athletes_history` (per CF univoco)
2. **Crea/Aggiorna Gara** → Inserisce in `public_meets` (usando `meet_code` univoco)
3. **Upload Risultati** → Popola `public_results` con:
   - Mapping atleti per CF (ID-agnostic)
   - Mapping categorie per nome
   - Calcolo ranking (`final_placing`) per categoria
4. **Aggiorna Record** → Controlla e aggiorna `public_records` se battuti

> 🔑 **ID-Agnostic**: Il sistema usa codici univoci (CF per atleti, `meet_code` per gare, nomi per categorie) invece di ID autoincrementali, evitando conflitti tra database locale e remoto.




