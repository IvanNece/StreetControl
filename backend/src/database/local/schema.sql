-- SQLite Local Database Schema
-- Competition management database (offline-first)

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

/* ---------------------------
   ENUM minimi via CHECK
---------------------------- */
-- Sesso: 'M' | 'F'
-- Lift: 'MU' (muscle-up), 'PU' (trazione/pull-up), 'DIP', 'SQ' (squat), 'MP' (military press)
-- Attempt status: 'PENDING' | 'VALID' | 'INVALID'
-- Judge role: 'HEAD' | 'SIDE'

/* ---------------------------
   Anagrafiche base
---------------------------- */
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'organizer'
);

CREATE TABLE weight_categories (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,          -- es: "-73", "-80", "94+"
  min_kg  REAL,
  max_kg  REAL,
  sex     TEXT NOT NULL CHECK (sex IN ('M','F'))
);

CREATE TABLE age_categories (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,         -- es: "U18", "Senior", "Master 40-49"
  min_age  INTEGER,
  max_age  INTEGER
);

CREATE TABLE athletes (
  id          INTEGER PRIMARY KEY,
  cf          TEXT NOT NULL UNIQUE,      -- Codice Fiscale
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  sex         TEXT NOT NULL CHECK (sex IN ('M','F')),
  birth_date  TEXT NOT NULL              -- ISO date
);
CREATE INDEX idx_athletes_name ON athletes(last_name, first_name);

/* ---------------------------
   Gara (semplificata)
---------------------------- */
CREATE TABLE meets (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  meet_type        TEXT NOT NULL,        -- "FULL" | "SINGLE" | "CUSTOM"
  start_date       TEXT NOT NULL,        -- ISO date
  level            TEXT NOT NULL,        -- "REGIONALE" | "NAZIONALE"
  regulation_code  TEXT NOT NULL,        -- es: "WL_COEFF_2025"
  lifts_json       TEXT NOT NULL         -- JSON: es. '["PU","DIP","SQ"]'
);

/* ---------------------------
   Giudici (3 per gara: 1 HEAD + 2 SIDE)
---------------------------- */
CREATE TABLE judges (
  id            INTEGER PRIMARY KEY,
  meet_id       INTEGER NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('HEAD', 'SIDE')),
  FOREIGN KEY (meet_id) REFERENCES meets(id) ON DELETE CASCADE
);
CREATE INDEX idx_judges_meet ON judges(meet_id);

/* ---------------------------
   Registrazione per-gara
---------------------------- */
CREATE TABLE registrations (
  id                 INTEGER PRIMARY KEY,
  meet_id            INTEGER NOT NULL,
  athlete_id         INTEGER NOT NULL,
  bodyweight_kg      REAL,
  rack_height        INTEGER NOT NULL DEFAULT 0,  -- altezza del rack
  belt_height        INTEGER NOT NULL DEFAULT 0,  -- altezza della cintura
  out_of_weight      INTEGER NOT NULL CHECK (out_of_weight IN (0,1)) DEFAULT 0,  -- booleano 0/1
  weight_cat_id      INTEGER,
  age_cat_id         INTEGER,
  notes              TEXT,
  UNIQUE (meet_id, athlete_id),
  FOREIGN KEY (meet_id)       REFERENCES meets(id)             ON DELETE CASCADE,
  FOREIGN KEY (athlete_id)    REFERENCES athletes(id),
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories(id)
);
CREATE INDEX idx_registrations_meet ON registrations(meet_id);

-- Massimali dichiarati in iscrizione (per lift, facoltativi)
CREATE TABLE registration_maxes (
  reg_id   INTEGER NOT NULL,
  lift     TEXT NOT NULL CHECK (lift IN ('MU','PU','DIP','SQ','MP')),
  max_kg   REAL NOT NULL,
  PRIMARY KEY (reg_id, lift),
  FOREIGN KEY (reg_id) REFERENCES registrations(id) ON DELETE CASCADE
);

/* ---------------------------
   Flights & Groups
---------------------------- */
CREATE TABLE flights (
  id          INTEGER PRIMARY KEY,
  meet_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,             -- es: "Flight A (Mattina)"
  ord         INTEGER NOT NULL,
  start_time  TEXT,                      -- opzionale
  UNIQUE (meet_id, ord),
  FOREIGN KEY (meet_id) REFERENCES meets(id) ON DELETE CASCADE
);

CREATE TABLE groups (
  id         INTEGER PRIMARY KEY,
  flight_id  INTEGER NOT NULL,
  name       TEXT NOT NULL,              -- es: "Gruppo 1 (-80)"
  ord        INTEGER NOT NULL,
  UNIQUE (flight_id, ord),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE group_entries (
  id         INTEGER PRIMARY KEY,
  group_id   INTEGER NOT NULL,
  reg_id     INTEGER NOT NULL,           -- atleta (registrazione) assegnato al group
  start_ord  INTEGER NOT NULL,           -- ordine pubblicato nelle nominations
  UNIQUE (group_id, reg_id),
  UNIQUE (group_id, start_ord),
  FOREIGN KEY (group_id) REFERENCES groups(id)          ON DELETE CASCADE,
  FOREIGN KEY (reg_id)   REFERENCES registrations(id)   ON DELETE CASCADE
);

/* ---------------------------
   Tentativi (includono gli opener)
---------------------------- */
CREATE TABLE attempts (
  id            INTEGER PRIMARY KEY,
  reg_id        INTEGER NOT NULL,        -- atleta (registrazione) in questa gara
  lift          TEXT NOT NULL CHECK (lift IN ('MU','PU','DIP','SQ','MP')),
  attempt_no    INTEGER NOT NULL CHECK (attempt_no BETWEEN 1 AND 3),
  weight_kg     REAL NOT NULL,           -- Attempt 1 = opener dichiarato alla pesa
  status        TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','VALID','INVALID')),
  ts_declared   TEXT,                    -- ISO datetime (pesa o modifica)
  ts_finalized  TEXT,                    -- ISO datetime (quando giudicato)
  notes         TEXT,
  UNIQUE (reg_id, lift, attempt_no),
  FOREIGN KEY (reg_id) REFERENCES registrations(id) ON DELETE CASCADE
);
CREATE INDEX idx_attempts_reg ON attempts(reg_id);
CREATE INDEX idx_attempts_lift_round ON attempts(lift, attempt_no);

/* ---------------------------
   Stato corrente gara (singleton)
   Traccia atleta corrente, lift, round, timer
---------------------------- */
CREATE TABLE current_state (
  id                INTEGER PRIMARY KEY CHECK (id = 1), -- singleton: solo 1 riga
  meet_id           INTEGER,
  current_flight_id INTEGER,
  current_group_id  INTEGER,
  current_lift      TEXT CHECK (current_lift IN ('MU','PU','DIP','SQ','MP')),
  current_round     INTEGER CHECK (current_round BETWEEN 1 AND 3),
  current_reg_id    INTEGER, -- atleta corrente in pedana
  timer_start       TEXT,    -- ISO datetime
  timer_seconds     INTEGER DEFAULT 60,
  FOREIGN KEY (meet_id)           REFERENCES meets(id),
  FOREIGN KEY (current_flight_id) REFERENCES flights(id),
  FOREIGN KEY (current_group_id)  REFERENCES groups(id),
  FOREIGN KEY (current_reg_id)    REFERENCES registrations(id)
);

/* ---------------------------
   Records locali (di riferimento generale)
   (sex desunta da weight_categories)
---------------------------- */
CREATE TABLE records (
  id             INTEGER PRIMARY KEY,
  weight_cat_id  INTEGER NOT NULL,
  age_cat_id     INTEGER NOT NULL,
  lift           TEXT NOT NULL CHECK (lift IN ('MU','PU','DIP','SQ','MP')),
  record_kg      REAL NOT NULL,
  holder_name    TEXT,        -- nome completo
  set_date       TEXT,        -- ISO date
  notes          TEXT,
  UNIQUE (weight_cat_id, age_cat_id, lift),
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories(id)
);

/* ---------------------------
   Viste per ORDINAMENTO pedana
---------------------------- */

-- 1) Ordine per GROUP e LIFT basato sugli OPENER (Attempt 1), peso crescente.
--    Tie-break di default: start_ord (dall'ordine pubblicato nelle nominations).
CREATE VIEW v_group_openers_order AS
SELECT
  g.id            AS group_id,
  g.name          AS group_name,
  ge.start_ord    AS nomination_order,
  r.athlete_id    AS athlete_id,
  atp.lift        AS lift,
  atp.weight_kg   AS opener_kg,
  ath.first_name  AS first_name,
  ath.last_name   AS last_name
FROM groups g
JOIN group_entries ge   ON ge.group_id = g.id
JOIN registrations r    ON r.id = ge.reg_id
JOIN athletes ath       ON ath.id = r.athlete_id
JOIN attempts atp       ON atp.reg_id = r.id AND atp.attempt_no = 1
ORDER BY g.id, atp.lift, atp.weight_kg ASC, r.bodyweight_kg DESC, ge.start_ord ASC;

-- 2) Ordine generale per GROUP, LIFT e ATTEMPT round (1/2/3),
--    utile se vuoi ordinare anche i round successivi in base ai pesi impostati.
CREATE VIEW v_group_attempt_order AS
SELECT
  g.id            AS group_id,
  g.name          AS group_name,
  atp.lift        AS lift,
  atp.attempt_no  AS round_no,
  atp.weight_kg   AS declared_weight,
  ge.start_ord    AS nomination_order,
  r.athlete_id    AS athlete_id,
  ath.first_name,
  ath.last_name
FROM groups g
JOIN group_entries ge   ON ge.group_id = g.id
JOIN registrations r    ON r.id = ge.reg_id
JOIN athletes ath       ON ath.id = r.athlete_id
JOIN attempts atp       ON atp.reg_id = r.id
ORDER BY g.id, atp.lift, atp.attempt_no, atp.weight_kg ASC, r.bodyweight_kg DESC, ge.start_ord ASC;
