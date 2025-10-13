-- PostgreSQL Remote Database Schema
-- Records, history and rankings database

/* ---------------------------
   Lifts and Meet Types
---------------------------- */
CREATE TABLE lifts (
    id          VARCHAR(5) PRIMARY KEY,   -- es: 'SQ', 'PU', 'DIP'
    name        VARCHAR(50) NOT NULL UNIQUE,  -- es: 'Squat', 'Pull-Up', 'Dip'
    CONSTRAINT valid_lift_id CHECK (id ~ '^[A-Z]{2,5}$')  -- solo maiuscole, 2-5 chars
);

CREATE TABLE meet_types (
    id          VARCHAR(10) PRIMARY KEY,  -- es: 'STREET_4', 'STREET_3'
    name        VARCHAR(100) NOT NULL UNIQUE,  -- es: 'Street 4', 'Street 3'
    CONSTRAINT valid_meet_type_id CHECK (id ~ '^[A-Z0-9_]{2,10}$')  -- maiuscole/numeri/underscore
);

CREATE TABLE meet_type_lifts (
    meet_type_id    VARCHAR(10) NOT NULL,
    lift_id         VARCHAR(5) NOT NULL,
    sequence        INTEGER NOT NULL,  -- ordine delle alzate nella gara
    PRIMARY KEY (meet_type_id, lift_id),
    FOREIGN KEY (meet_type_id) REFERENCES meet_types(id) ON DELETE CASCADE,
    FOREIGN KEY (lift_id) REFERENCES lifts(id) ON DELETE RESTRICT,
    UNIQUE (meet_type_id, sequence)  -- impedisce duplicati nell'ordine
);
CREATE INDEX idx_meet_type_lifts_lift ON meet_type_lifts(lift_id);

/* ---------------------------
   Federations (Organizing Bodies)
---------------------------- */
CREATE TABLE federations (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

/* ---------------------------
  STANDARD Categories
---------------------------- */
CREATE TABLE weight_categories_std (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     VARCHAR(50) NOT NULL UNIQUE,            -- es: "+101", "U101", "-94" o "Men -94" 
  sex      CHAR(1) NOT NULL CHECK (sex IN ('M','F')),
  min_kg   DECIMAL(5,2) NOT NULL DEFAULT 0,        -- limite inferiore INCLUSIVO
  max_kg   DECIMAL(5,2),                           -- limite superiore INCLUSIVO; NULL = open-top (es. +101)
  ord      INTEGER NOT NULL DEFAULT 0,             -- utile per ordinamenti custom
  CHECK (max_kg IS NULL OR max_kg > min_kg),
  UNIQUE (sex, min_kg, max_kg)
);

CREATE TABLE age_categories_std (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     VARCHAR(50) NOT NULL UNIQUE,  -- es: "U18", "Senior", "Master 40-49"
  min_age  SMALLINT,                     -- NULL = nessun limite inferiore
  max_age  SMALLINT,                     -- NULL = nessun limite superiore
  ord      INTEGER NOT NULL DEFAULT 0,   -- utile per ordinamenti custom
  CHECK (max_age IS NULL OR min_age IS NULL OR max_age >= min_age),
  UNIQUE (min_age, max_age)
);

/* ---------------------------
  Athletes History (from all meets)
---------------------------- */
CREATE TABLE athletes_history (
  id            SERIAL PRIMARY KEY,
  cf            TEXT NOT NULL UNIQUE,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  sex           CHAR(1) CHECK (sex IN ('M','F')),
  birth_date    DATE NOT NULL
);
CREATE INDEX idx_athletes_history_name ON athletes_history(last_name, first_name);

/* ---------------------------
   Gare pubbliche (archivio completo)
   NOTA: Deve essere creato PRIMA di public_records per la FK
---------------------------- */
CREATE TABLE public_meets (
  id               SERIAL PRIMARY KEY,
  federation_id    INTEGER,
  meet_code        TEXT NOT NULL UNIQUE,  -- Identificatore univoco cross-database (es: "SLI-2025-ROMA-01")
  name             TEXT NOT NULL,
  date             DATE NOT NULL,
  level            TEXT NOT NULL,         -- "REGIONALE" | "NAZIONALE"
  regulation_code  TEXT NOT NULL,         -- es: "WL_COEFF_2025"
  meet_type_id     VARCHAR(10) NOT NULL,  -- FK to meet_types(id)
  FOREIGN KEY (federation_id) REFERENCES federations(id) ON DELETE SET NULL,
  FOREIGN KEY (meet_type_id) REFERENCES meet_types(id)
);
CREATE INDEX idx_public_meets_date ON public_meets(date DESC);
CREATE INDEX idx_public_meets_federation ON public_meets(federation_id);
CREATE INDEX idx_public_meets_code ON public_meets(meet_code);
CREATE INDEX idx_public_meets_type ON public_meets(meet_type_id);

/* ---------------------------
   Record ufficiali pubblici (storico)
---------------------------- */
CREATE TABLE public_records (
  id               SERIAL PRIMARY KEY,
  weight_cat_id    INTEGER NOT NULL,
  age_cat_id       INTEGER NOT NULL,
  lift             VARCHAR(5) NOT NULL,
  record_kg        NUMERIC(10,2) NOT NULL,
  bodyweight_kg    DECIMAL(5,2) NOT NULL, -- peso dell'atleta quando ha stabilito il record
  meet_code        TEXT,                  -- FK to public_meets(meet_code) - where record was set
  set_date         DATE,
  athlete_cf       TEXT,
  UNIQUE (weight_cat_id, age_cat_id, lift),
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories_std(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories_std(id),
  FOREIGN KEY (lift)          REFERENCES lifts(id),
  FOREIGN KEY (athlete_cf)    REFERENCES athletes_history(cf) ON DELETE SET NULL,
  FOREIGN KEY (meet_code)     REFERENCES public_meets(meet_code) ON DELETE SET NULL
);
CREATE INDEX idx_public_records_lookup ON public_records(weight_cat_id, age_cat_id, lift);

/* ---------------------------
   Risultati finali per atleta
---------------------------- */
CREATE TABLE public_results (
  id               SERIAL PRIMARY KEY,
  meet_id          INTEGER NOT NULL,
  athlete_id       INTEGER,               -- NULL se atleta non in athletes_history
  weight_cat_id    INTEGER NOT NULL,
  age_cat_id       INTEGER NOT NULL,
  total_kg         NUMERIC(10,2) NOT NULL, -- somma delle alzate previste dalla gara
  points           NUMERIC(10,2) NOT NULL, -- calcolato in base a regulation_code
  final_placing    INTEGER,               -- posizione in classifica
  bodyweight_kg    DECIMAL(5,2) NOT NULL, -- peso atleta durante la gara
  FOREIGN KEY (meet_id)       REFERENCES public_meets(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id)    REFERENCES athletes_history(id) ON DELETE SET NULL,
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories_std(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories_std(id)
);

-- Risultati per singola alzata
CREATE TABLE public_result_lifts (
  result_id        INTEGER NOT NULL,
  lift_id          VARCHAR(5) NOT NULL,
  lift_kg          NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (result_id, lift_id),
  FOREIGN KEY (result_id) REFERENCES public_results(id) ON DELETE CASCADE,
  FOREIGN KEY (lift_id)   REFERENCES lifts(id)
);

CREATE INDEX idx_public_results_meet_place ON public_results(meet_id, final_placing);
CREATE INDEX idx_public_results_athlete ON public_results(athlete_id);
CREATE INDEX idx_public_result_lifts_lift ON public_result_lifts(lift_id);

/* Initial data std categories */

INSERT INTO weight_categories_std (name, sex, min_kg, max_kg, ord)
VALUES
  -- Men's categories
  ('M -59kg',  'M',  0.00,   59.00,  0),
  ('M -66kg',  'M',  59.01,  66.00,  1),
  ('M -73kg',  'M',  66.01,  73.00,  2),
  ('M -80kg',  'M',  73.01,  80.00,  3),
  ('M -87kg',  'M',  80.01,  87.00,  4),
  ('M -94kg',  'M',  87.01,  94.00,  5),
  ('M -101kg', 'M',  94.01,  101.00, 6),
  ('M +101kg', 'M',  101.01, NULL,   7),

  -- Women's categories
  ('F -52kg',  'F',  0.00,   52.00,  0),
  ('F -57kg',  'F',  52.01,  57.00,  1),
  ('F -63kg',  'F',  57.01,  63.00,  2),
  ('F -70kg',  'F',  63.01,  70.00,  3),
  ('F +70kg',  'F',  70.01,  NULL,   4);

INSERT INTO age_categories_std (name, min_age, max_age, ord)
VALUES
  ('Sub-Junior', NULL, 18, 0),
  ('Junior',     19,  23, 1),
  ('Senior',     24,  39, 2),
  ('Master I',   40,  49, 3),
  ('Master II',  50,  59, 4),
  ('Master III', 60,  69, 5),
  ('Master IV',  70,  NULL, 6);

/* Initial data for lifts and meet types */

INSERT INTO lifts (id, name) VALUES
    ('SQ',  'Squat'),
    ('PU',  'Pull-Up'),
    ('DIP', 'Dip'),
    ('MP',  'Military-Press'),
    ('MU',  'Muscle-Up');

INSERT INTO meet_types (id, name) VALUES
    ('STREET_4',    'Street 4'),
    ('STREET_3',    'Street 3'),
    ('PUSH_PULL',   'Push & Pull'),
    ('S_PU', 'Single Lift Pull-Up'),
    ('S_DIP',  'Single Lift Dip'),
    ('S_MU',   'Single Lift Muscle-Up'),
    ('S_SQ',   'Single Lift Squat'),
    ('S_MP',   'Single Lift Military-Press');

INSERT INTO meet_type_lifts (meet_type_id, lift_id, sequence) VALUES
    -- Street 4: mu, pull, dip, squat
    ('STREET_4', 'MU',  1),
    ('STREET_4', 'PU',  2),
    ('STREET_4', 'DIP', 3),
    ('STREET_4', 'SQ',  4),
    -- Street 3: pull, dip, squat
    ('STREET_3', 'PU',  1),
    ('STREET_3', 'DIP', 2),
    ('STREET_3', 'SQ',  3),
    -- Push & Pull: pull, dip
    ('PUSH_PULL', 'PU',  1),
    ('PUSH_PULL', 'DIP', 2),
    -- Single lifts
    ('S_PU', 'PU',  1),
    ('S_DIP',  'DIP', 1),
    ('S_MU',   'MU',  1),
    ('S_SQ',   'SQ',  1),
    ('S_MP',   'MP',  1);

/* Initialize public_records with default values */
INSERT INTO public_records (weight_cat_id, age_cat_id, lift, record_kg, bodyweight_kg, meet_code, set_date, athlete_cf)
SELECT
    w.id  AS weight_cat_id,
    a.id  AS age_cat_id,
    l.id  AS lift,
    0     AS record_kg,
    0     AS bodyweight_kg,    -- valore di default per i record iniziali
    NULL  AS meet_code,
    NULL  AS set_date,
    NULL  AS athlete_cf
FROM weight_categories_std w
CROSS JOIN age_categories_std a
CROSS JOIN lifts l;