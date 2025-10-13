-- SQLite Local Database Schema
-- Competition management database (offline-first)

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

/* ---------------------------
   Lifts and Meet Types
---------------------------- */
CREATE TABLE lifts (
    id          TEXT PRIMARY KEY,        -- es: 'SQ', 'PU', 'DIP'
    name        TEXT NOT NULL UNIQUE    -- es: 'Squat', 'Pull-Up', 'Dip'
);

CREATE TABLE meet_types (
    id          TEXT PRIMARY KEY,        -- es: 'STREET_4', 'STREET_3'
    name        TEXT NOT NULL UNIQUE    -- es: 'Street 4', 'Street 3'
);

CREATE TABLE meet_type_lifts (
    meet_type_id    TEXT NOT NULL,
    lift_id         TEXT NOT NULL,
    sequence        INTEGER NOT NULL,    -- ordine delle alzate nella gara
    PRIMARY KEY (meet_type_id, lift_id),
    FOREIGN KEY (meet_type_id) REFERENCES meet_types(id) ON DELETE CASCADE,
    FOREIGN KEY (lift_id) REFERENCES lifts(id) ON DELETE RESTRICT,
    UNIQUE (meet_type_id, sequence)     -- impedisce duplicati nell'ordine
);
CREATE INDEX idx_meet_type_lifts_lift ON meet_type_lifts(lift_id);

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
  meet_type_id     TEXT NOT NULL,         -- FK to meet_types(id)
  start_date       TEXT NOT NULL,         -- ISO date
  level            TEXT NOT NULL,         -- "REGIONALE" | "NAZIONALE"
  regulation_code  TEXT NOT NULL,         -- es: "WL_COEFF_2025"
  FOREIGN KEY (federation_id) REFERENCES federations(id) ON DELETE SET NULL,
  FOREIGN KEY (meet_type_id) REFERENCES meet_types(id)
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
  lift_id  TEXT NOT NULL,
  max_kg   REAL NOT NULL,
  PRIMARY KEY (reg_id, lift_id),
  FOREIGN KEY (reg_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (lift_id) REFERENCES lifts(id)
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
  lift_id       TEXT NOT NULL,
  attempt_no    INTEGER NOT NULL CHECK (attempt_no BETWEEN 1 AND 4), -- 1,2,3 (4 = if judges allow 4th attempt)
  weight_kg     REAL NOT NULL,           -- Attempt 1 = opener dichiarato alla pesa
  status        TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','VALID','INVALID')),
  UNIQUE (reg_id, lift_id, attempt_no),
  FOREIGN KEY (reg_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (lift_id) REFERENCES lifts(id)
);
CREATE INDEX idx_attempts_reg ON attempts(reg_id);
CREATE INDEX idx_attempts_lift_round ON attempts(lift_id, attempt_no);

/* ---------------------------
  -- Current meet state (singleton)
  -- Tracks current athlete, lift, round, timer
---------------------------- */
CREATE TABLE current_state (
  id                INTEGER PRIMARY KEY CHECK (id = 1), -- singleton: solo 1 riga
  meet_id           INTEGER,
  current_flight_id INTEGER,
  current_group_id  INTEGER,
  current_lift_id   TEXT,
  current_round     INTEGER CHECK (current_round BETWEEN 1 AND 3),
  current_reg_id    INTEGER, -- atleta corrente in pedana
  timer_start       TEXT,    -- ISO datetime
  timer_seconds     INTEGER DEFAULT 60,
  FOREIGN KEY (meet_id)           REFERENCES meets(id),
  FOREIGN KEY (current_flight_id) REFERENCES flights(id),
  FOREIGN KEY (current_group_id)  REFERENCES groups(id),
  FOREIGN KEY (current_reg_id)    REFERENCES registrations(id) ON DELETE SET NULL,
  FOREIGN KEY (current_lift_id)   REFERENCES lifts(id)
);

/* ---------------------------
   Records locali (di riferimento generale)
   (sex desunta da weight_categories)
---------------------------- */
CREATE TABLE records (
  id             INTEGER PRIMARY KEY,
  weight_cat_id  INTEGER NOT NULL,
  age_cat_id     INTEGER NOT NULL,
  lift_id        TEXT NOT NULL,
  record_kg      REAL NOT NULL,
  bodyweight_kg  REAL NOT NULL,        -- peso dell'atleta quando ha stabilito il record
  athlete_cf     TEXT,                 -- riferimento diretto al cf dell'atleta
  set_date       TEXT,                 -- ISO date
  UNIQUE (weight_cat_id, age_cat_id, lift_id),
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories(id),
  FOREIGN KEY (lift_id)       REFERENCES lifts(id),
  FOREIGN KEY (athlete_cf)    REFERENCES athletes(cf) ON DELETE SET NULL
);

CREATE INDEX idx_records_categories ON records(weight_cat_id, age_cat_id);
