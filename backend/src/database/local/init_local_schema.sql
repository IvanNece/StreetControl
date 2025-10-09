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
-- Judge role: 'HEAD' | 'LEFT' | 'RIGHT'

/* ---------------------------
   Federations (Organizing Bodies)
---------------------------- */
CREATE TABLE federations (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);

/* ---------------------------
  Categories imported from remote (standard)
---------------------------- */
CREATE TABLE weight_categories (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,                   -- es: "+101", "U101", "-94" o "Men -94"
  sex      TEXT NOT NULL CHECK (sex IN ('M','F')),
  min_kg   REAL NOT NULL DEFAULT 0,                -- limite inferiore INCLUSIVO
  max_kg   REAL,                                   -- limite superiore INCLUSIVO; NULL = open-top (es. +101)
  ord      INTEGER NOT NULL DEFAULT 0,             -- utile per ordinamenti custom
  CHECK (max_kg IS NULL OR max_kg > min_kg),
  UNIQUE (sex, min_kg, max_kg)
);

CREATE TABLE age_categories (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,         -- es: "U18", "Senior", "Master 40-49"
  min_age  INTEGER,                      -- NULL = nessun limite inferiore
  max_age  INTEGER,                      -- NULL = nessun limite superiore
  ord      INTEGER NOT NULL DEFAULT 0,   -- utile per ordinamenti custom
  CHECK (max_age IS NULL OR min_age IS NULL OR max_age >= min_age),
  UNIQUE (min_age, max_age)
);

/*--\-------------------------
   Athletes (only local, for meets)
---------------------------- */
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
  Meet 
---------------------------- */
CREATE TABLE meets (
  id               INTEGER PRIMARY KEY,
  federation_id    INTEGER,
  meet_code        TEXT UNIQUE,           -- Identificatore univoco cross-database (es: "SLI-2025-ROMA-01")
  name             TEXT NOT NULL,
  meet_type        TEXT NOT NULL,        -- "FULL" | "SINGLE" | "CUSTOM"
  start_date       TEXT NOT NULL,        -- ISO date
  level            TEXT NOT NULL,        -- "REGIONALE" | "NAZIONALE"
  regulation_code  TEXT NOT NULL,        -- es: "WL_COEFF_2025"
  lifts_json       TEXT NOT NULL,         -- JSON: es. '["PU","DIP","SQ"]'
  FOREIGN KEY (federation_id) REFERENCES federations(id) ON DELETE SET NULL
);

/* ---------------------------
   Giudici (3 per gara: 1 HEAD + 2 SIDE)
---------------------------- */
CREATE TABLE judges (
  id            INTEGER PRIMARY KEY,
  meet_id       INTEGER NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('HEAD', 'LEFT', 'RIGHT')),
  FOREIGN KEY (meet_id) REFERENCES meets(id) ON DELETE CASCADE
);
CREATE INDEX idx_judges_meet ON judges(meet_id);

/* ---------------------------
  Pre-meet registration
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
  FOREIGN KEY (athlete_id)    REFERENCES athletes(id)          ON DELETE CASCADE,
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories(id)
);
CREATE INDEX idx_registrations_meet ON registrations(meet_id);

-- Declared maxes at registration (per lift, optional)
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
  Attempts (including openers)
---------------------------- */
CREATE TABLE attempts (
  id            INTEGER PRIMARY KEY,
  reg_id        INTEGER NOT NULL,        -- atleta (registrazione) in questa gara
  lift          TEXT NOT NULL CHECK (lift IN ('MU','PU','DIP','SQ','MP')),
  attempt_no    INTEGER NOT NULL CHECK (attempt_no BETWEEN 1 AND 4), -- 1,2,3 (4 = if judges allow 4th attempt)
  weight_kg     REAL NOT NULL,           -- Attempt 1 = opener dichiarato alla pesa
  status        TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','VALID','INVALID')),
  UNIQUE (reg_id, lift, attempt_no),
  FOREIGN KEY (reg_id) REFERENCES registrations(id) ON DELETE CASCADE
);
CREATE INDEX idx_attempts_reg ON attempts(reg_id);
CREATE INDEX idx_attempts_lift_round ON attempts(lift, attempt_no);

/* ---------------------------
  -- Current meet state (singleton)
  -- Tracks current athlete, lift, round, timer
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
  FOREIGN KEY (current_reg_id)    REFERENCES registrations(id) ON DELETE SET NULL
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
  athlete_id     INTEGER,
  set_date       TEXT,        -- ISO date
  UNIQUE (weight_cat_id, age_cat_id, lift),
  FOREIGN KEY (athlete_id)    REFERENCES athletes(id)          ON DELETE SET NULL,
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories(id)
);

CREATE INDEX idx_records_categories ON records(weight_cat_id, age_cat_id);

/* ---------------------------
   Viste per ORDINAMENTO pedana
---------------------------- */

-- 1) Ordine per GROUP e LIFT basato sugli OPENER (Attempt 1), peso crescente.
--    Tie-break di default: start_ord (dall'ordine pubblicato nelle nominations).
/*CREATE VIEW v_group_openers_order AS
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
ORDER BY g.id, atp.lift, atp.attempt_no, atp.weight_kg ASC, r.bodyweight_kg DESC, ge.start_ord ASC;*/
