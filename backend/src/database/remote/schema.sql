-- PostgreSQL Remote Database Schema
-- Records, history and rankings database

/* ---------------------------
   Federazioni (Enti Organizzatori)
---------------------------- */
CREATE TABLE federations (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

/* ---------------------------
   Categorie STANDARD (pubbliche, centralizzate)
---------------------------- */
CREATE TABLE weight_categories_std (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  min_kg  NUMERIC(10,2),
  max_kg  NUMERIC(10,2),
  sex     CHAR(1) NOT NULL CHECK (sex IN ('M','F'))
);

CREATE TABLE age_categories_std (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,
  min_age  INTEGER,
  max_age  INTEGER
);

/* ---------------------------
   Storico Atleti (da tutte le gare)
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
   Record ufficiali pubblici (storico)
---------------------------- */
CREATE TABLE public_records (
  id               SERIAL PRIMARY KEY,
  weight_cat_id    INTEGER NOT NULL,
  age_cat_id       INTEGER NOT NULL,
  lift             TEXT NOT NULL CHECK (lift IN ('MU','PU','DIP','SQ','MP')),
  record_kg        NUMERIC(10,2) NOT NULL,
  holder_first     TEXT NOT NULL,
  holder_last      TEXT NOT NULL,
  meet_name        TEXT,
  set_date         DATE,
  UNIQUE (weight_cat_id, age_cat_id, lift),
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories_std(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories_std(id)
);
CREATE INDEX idx_public_records_lookup ON public_records(weight_cat_id, age_cat_id, lift);

/* ---------------------------
   Gare pubbliche (archivio completo)
---------------------------- */
CREATE TABLE public_meets (
  id               SERIAL PRIMARY KEY,
  federation_id    INTEGER NOT NULL,
  name             TEXT NOT NULL,
  date             DATE NOT NULL,
  level            TEXT NOT NULL,         -- "REGIONALE" | "NAZIONALE"
  regulation_code  TEXT NOT NULL,         -- es: "WL_COEFF_2025"
  lifts_json       TEXT NOT NULL,         -- es: '["PU","DIP","SQ"]'
  FOREIGN KEY (federation_id) REFERENCES federations(id) ON DELETE CASCADE
);
CREATE INDEX idx_public_meets_date ON public_meets(date DESC);
CREATE INDEX idx_public_meets_federation ON public_meets(federation_id);

/* ---------------------------
   Risultati finali per atleta (denormalizzati e leggibili)
---------------------------- */
CREATE TABLE public_results (
  id               SERIAL PRIMARY KEY,
  meet_id          INTEGER NOT NULL,
  athlete_id       INTEGER,               -- NULL se atleta non in athletes_history
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  weight_cat_id    INTEGER NOT NULL,
  age_cat_id       INTEGER NOT NULL,
  best_mu_kg       NUMERIC(10,2),         -- NULL se lift non prevista
  best_pu_kg       NUMERIC(10,2),
  best_dip_kg      NUMERIC(10,2),
  best_sq_kg       NUMERIC(10,2),
  best_mp_kg       NUMERIC(10,2),
  total_kg         NUMERIC(10,2),         -- somma delle best previste dalla gara
  points           NUMERIC(10,2) NOT NULL, -- calcolato in base a regulation_code
  final_placing          INTEGER,               -- posizione in classifica
  notes            TEXT,
  FOREIGN KEY (meet_id)       REFERENCES public_meets(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id)    REFERENCES athletes_history(id) ON DELETE SET NULL,
  FOREIGN KEY (weight_cat_id) REFERENCES weight_categories_std(id),
  FOREIGN KEY (age_cat_id)    REFERENCES age_categories_std(id)
);
CREATE INDEX idx_public_results_meet_place ON public_results(meet_id, final_placing);
CREATE INDEX idx_public_results_search ON public_results(meet_id, last_name, first_name);
CREATE INDEX idx_public_results_athlete ON public_results(athlete_id);
