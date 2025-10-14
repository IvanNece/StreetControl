/**
 * Local Database Seed Data
 * 
 * 1. Sincronizza dati standard dal DB remoto (federations, categories, records)
 * 2. Genera dati di esempio per testing locale
 * Run with: npm run seed
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../../data/street_control.db');

// Ensure data directory exists
const dataDir = join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!process.env.DATABASE_REMOTE_URL) {
  console.error('❌ DATABASE_REMOTE_URL not configured');
  process.exit(1);
}

// Connect to local SQLite
const db = new sqlite3.Database(DB_PATH);

// Connect to remote PostgreSQL
const remotePool = new Pool({
  connectionString: process.env.DATABASE_REMOTE_URL,
  ssl: { rejectUnauthorized: false }
});

// Handle pool errors gracefully
remotePool.on('error', (err) => {
  // Ignore shutdown/termination errors from Supabase
  if (err.code !== 'XX000' && !err.message?.includes('shutdown')) {
    console.error('⚠️  Remote pool error:', err.message);
  }
});

/**
 * Sync standard data from remote DB
 */
async function syncFromRemote() {
  let remoteClient;
  try {
    remoteClient = await remotePool.connect();
    
    // 1. Sync lifts
    console.log('📥 Syncing lifts from remote...');
    const lifts = await remoteClient.query('SELECT * FROM lifts');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM lifts', err => {
        if (err) reject(err);
        const stmt = db.prepare('INSERT INTO lifts (id, name) VALUES (?, ?)');
        for (const lift of lifts.rows) {
          stmt.run(lift.id, lift.name);
        }
        stmt.finalize(resolve);
      });
    });

    // 2. Sync meet types
    console.log('📥 Syncing meet types from remote...');
    const meetTypes = await remoteClient.query('SELECT * FROM meet_types');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM meet_types', err => {
        if (err) reject(err);
        const stmt = db.prepare('INSERT INTO meet_types (id, name) VALUES (?, ?)');
        for (const type of meetTypes.rows) {
          stmt.run(type.id, type.name);
        }
        stmt.finalize(resolve);
      });
    });

    // 3. Sync meet type lifts
    console.log('📥 Syncing meet type lifts from remote...');
    const meetTypeLifts = await remoteClient.query('SELECT * FROM meet_type_lifts ORDER BY sequence');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM meet_type_lifts', err => {
        if (err) reject(err);
        const stmt = db.prepare('INSERT INTO meet_type_lifts (meet_type_id, lift_id, sequence) VALUES (?, ?, ?)');
        for (const mtl of meetTypeLifts.rows) {
          stmt.run(mtl.meet_type_id, mtl.lift_id, mtl.sequence);
        }
        stmt.finalize(resolve);
      });
    });

    // 4. Sync athletes history
    console.log('📥 Syncing athletes from remote...');
    const athletes = await remoteClient.query('SELECT * FROM athletes_history');
    await new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO athletes (cf, first_name, last_name, sex, birth_date)
        VALUES (?, ?, ?, ?, ?)`);
      for (const athlete of athletes.rows) {
        stmt.run(athlete.cf, athlete.first_name, athlete.last_name, athlete.sex, athlete.birth_date);
      }
      stmt.finalize(resolve);
    });

    // 5. Sync federations
    console.log('📥 Syncing federations from remote...');
    const federations = await remoteClient.query('SELECT * FROM federations');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM federations', err => {
        if (err) reject(err);
        const stmt = db.prepare('INSERT INTO federations (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)');
        for (const fed of federations.rows) {
          stmt.run(fed.id, fed.username, fed.password_hash, fed.created_at);
        }
        stmt.finalize(resolve);
      });
    });

    // 2. Sync weight categories
    console.log('📥 Syncing weight categories from remote...');
    const weightCats = await remoteClient.query('SELECT * FROM weight_categories_std ORDER BY ord');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM weight_categories', err => {
        if (err) reject(err);
        const stmt = db.prepare('INSERT INTO weight_categories (id, name, sex, min_kg, max_kg, ord) VALUES (?, ?, ?, ?, ?, ?)');
        for (const cat of weightCats.rows) {
          stmt.run(cat.id, cat.name, cat.sex, cat.min_kg, cat.max_kg, cat.ord);
        }
        stmt.finalize(resolve);
      });
    });

    // 3. Sync age categories
    console.log('📥 Syncing age categories from remote...');
    const ageCats = await remoteClient.query('SELECT * FROM age_categories_std ORDER BY ord');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM age_categories', err => {
        if (err) reject(err);
        const stmt = db.prepare('INSERT INTO age_categories (id, name, min_age, max_age, ord) VALUES (?, ?, ?, ?, ?)');
        for (const cat of ageCats.rows) {
          stmt.run(cat.id, cat.name, cat.min_age, cat.max_age, cat.ord);
        }
        stmt.finalize(resolve);
      });
    });

    // 8. Sync records
    console.log('📥 Syncing records from remote...');
    const records = await remoteClient.query('SELECT * FROM public_records');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM records', err => {
        if (err) reject(err);
        const stmt = db.prepare(`
          INSERT INTO records (
            weight_cat_id, age_cat_id, lift_id, record_kg, 
            bodyweight_kg, athlete_cf, set_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for (const rec of records.rows) {
          stmt.run(
            rec.weight_cat_id, 
            rec.age_cat_id, 
            rec.lift,         // lift is now lift_id in the new schema
            rec.record_kg,
            rec.bodyweight_kg,
            rec.athlete_cf,   // using athlete_cf directly now
            rec.set_date
          );
        }
        stmt.finalize(resolve);
      });
    });

  } finally {
    if (remoteClient) {
      remoteClient.release();
    }
  }
}

/**
 * Generate sample data for local testing
 * Note: federations, categories and records are already synced from remote
 */
async function generateSampleData() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🌱 Generating sample test data...\n');

      // 1. Athletes (30 realistic athletes)
      console.log('📝 Creating athletes...');
      const athletes = [
        // -80kg Men
        ["RSSMRA85M01H501Z", "Mario", "Rossi", "M", "1985-08-01"],
        ["VRDLCA88C15F205W", "Luca", "Verdi", "M", "1988-03-15"],
        ["BNCGVN90H20L219K", "Giovanni", "Bianchi", "M", "1990-06-20"],
        ["FRRPLO92D10A001X", "Paolo", "Ferrari", "M", "1992-04-10"],
        ["MRNMRC87L05B111Y", "Marco", "Moretti", "M", "1987-07-05"],
        ["CSTFNC91A12C351Z", "Francesco", "Costa", "M", "1991-01-12"],
        ["RCCNDR89E18D612A", "Andrea", "Ricci", "M", "1989-05-18"],
        ["BRTDVD93M22E506B", "Davide", "Bertoli", "M", "1993-08-22"],
        // -87kg Men
        ["GLLMTT86B14F839C", "Matteo", "Galli", "M", "1986-02-14"],
        ["FNTSMN90F16G273D", "Simone", "Fontana", "M", "1990-06-16"],
        ["GRSLRA94C11H501E", "Lorenzo", "Grassi", "M", "1994-03-11"],
        ["CRBFPP88G25L736F", "Filippo", "Carbone", "M", "1988-07-25"],
        ["MNGDNL91H30M052G", "Daniele", "Mangano", "M", "1991-06-30"],
        ["PLLLSN87D08A794H", "Alessandro", "Pelli", "M", "1987-04-08"],
        // -94kg Men
        ["SNTMLS92L15B157I", "Tommaso", "Santi", "M", "1992-07-15"],
        ["GRSNTN89A20C351J", "Antonio", "Grossi", "M", "1989-01-20"],
        ["MRNGPP95E12D612K", "Giuseppe", "Marini", "M", "1995-05-12"],
        ["VLNNDR86M18E506L", "Alessio", "Valentini", "M", "1986-08-18"],
        // +94kg Men
        ["RMNFDR93C22F839M", "Federico", "Romani", "M", "1993-03-22"],
        ["BRBRCR88H14G273N", "Riccardo", "Barbieri", "M", "1988-06-14"],
        // -63kg Women
        ["RSSGLT92D45H501O", "Giulia", "Russo", "F", "1992-04-05"],
        ["BRNCHR90F52L219P", "Chiara", "Bruno", "F", "1990-06-12"],
        ["FRNMRT94A48A001Q", "Marta", "Ferrante", "F", "1994-01-08"],
        ["GRSLRA91L55B111R", "Laura", "Grassi", "F", "1991-07-15"],
        // -70kg Women
        ["CSTFRN89E42C351S", "Francesca", "Castelli", "F", "1989-05-02"],
        ["MRNSLV93M58D612T", "Silvia", "Marini", "F", "1993-08-18"],
        ["VLNSRA87C44E506U", "Sara", "Valentini", "F", "1987-03-04"],
        // +70kg Women
        ["BNCELS95H50F839V", "Elisa", "Bianco", "F", "1995-06-10"],
        ["FRRANN88D46G273W", "Anna", "Ferrero", "F", "1988-04-06"],
        ["MRNGIA91L48H501X", "Giorgia", "Morandi", "F", "1991-07-08"]
      ];
      
      const athletesStmt = db.prepare('INSERT OR IGNORE INTO athletes (cf, first_name, last_name, sex, birth_date) VALUES (?, ?, ?, ?, ?)');
      for (const athlete of athletes) {
        athletesStmt.run(athlete);
      }
      athletesStmt.finalize();

      // 2. Sample Meet
      console.log('📝 Creating sample meet...');
      db.run(`INSERT INTO meets (federation_id, meet_code, name, meet_type_id, start_date, level, regulation_code) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, 'SLI-2025-ITALIA-01', 'Campionato Italiano Streetlifting 2025', 'STREET_4', '2025-11-15', 'NAZIONALE', 'WL_COEFF_2025'],
        function(err) {
          if (err) return reject(err);
          const meetId = this.lastID;
          
          // 3. Judges
          console.log('📝 Creating judges...');
          const judgesStmt = db.prepare('INSERT INTO judges (meet_id, role) VALUES (?, ?)');
          for (const role of ['HEAD', 'LEFT', 'RIGHT']) {
            judgesStmt.run(meetId, role);
          }
          judgesStmt.finalize();

          // 4. Registrations
          console.log('📝 Creating registrations...');
          const registrationsStmt = db.prepare(`
            INSERT INTO registrations (meet_id, athlete_id, bodyweight_kg, rack_height, belt_height, out_of_weight, weight_cat_id, age_cat_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

          for (let i = 0; i < athletes.length; i++) {
            const bodyweight = 65 + (i * 1.2); // Realistic bodyweights
            const weightCat = i < 8 ? 4 : (i < 14 ? 5 : (i < 18 ? 6 : (i < 20 ? 7 : (i < 24 ? 10 : 11)))); // Match with remote categories
            const ageCat = 3; // Senior
            registrationsStmt.run(meetId, i + 1, bodyweight, 3, 2, 0, weightCat, ageCat, null);
          }
          registrationsStmt.finalize();

          // 5. Flights
          console.log('📝 Creating flights...');
          const flightsStmt = db.prepare('INSERT INTO flights (meet_id, name, ord, start_time) VALUES (?, ?, ?, ?)');
          flightsStmt.run(meetId, 'Flight A - Mattina', 1, '09:00');
          flightsStmt.run(meetId, 'Flight B - Pomeriggio', 2, '14:00');
          flightsStmt.finalize();

          // 6. Groups
          console.log('📝 Creating groups...');
          db.run(`INSERT INTO groups (flight_id, name, ord) VALUES 
            (1, 'Gruppo 1 (-80kg)', 1),
            (1, 'Gruppo 2 (-87kg)', 2),
            (2, 'Gruppo 3 (-94kg / +94kg)', 1),
            (2, 'Gruppo 4 (Donne)', 2)`, function(err) {
            if (err) return reject(err);

            // 7. Group Entries
            console.log('📝 Creating group entries...');
            const entriesStmt = db.prepare('INSERT INTO group_entries (group_id, reg_id, start_ord) VALUES (?, ?, ?)');
            
            // Group 1: Athletes 1-8 (-80kg)
            for (let i = 0; i < 8; i++) {
              entriesStmt.run(1, i + 1, i + 1);
            }
            // Group 2: Athletes 9-14 (-87kg)
            for (let i = 8; i < 14; i++) {
              entriesStmt.run(2, i + 1, i - 7);
            }
            // Group 3: Athletes 15-20 (-94kg / +94kg)
            for (let i = 14; i < 20; i++) {
              entriesStmt.run(3, i + 1, i - 13);
            }
            // Group 4: Athletes 21-30 (Women)
            for (let i = 20; i < 30; i++) {
              entriesStmt.run(4, i + 1, i - 19);
            }
            entriesStmt.finalize();

            // 8. Attempts
            console.log('📝 Creating attempts (openers)...');
            const attemptsStmt = db.prepare('INSERT INTO attempts (reg_id, lift_id, attempt_no, weight_kg, status) VALUES (?, ?, ?, ?, ?)');
            
            for (let regId = 1; regId <= 30; regId++) {
              const isFemale = regId > 20;
              
              // Generate realistic opener weights based on lift type and athlete sex
              const weights = {
                'MU': isFemale ? 15 + (regId % 5) * 2.5 : 25 + (regId % 10) * 2.5,
                'PU': isFemale ? 25 + (regId % 5) * 2.5 : 40 + (regId % 10) * 2.5,
                'DIP': isFemale ? 30 + (regId % 5) * 2.5 : 45 + (regId % 10) * 2.5,
                'SQ': isFemale ? 40 + (regId % 5) * 2.5 : 60 + (regId % 10) * 2.5
              };

              for (const [lift, weight] of Object.entries(weights)) {
                attemptsStmt.run(regId, lift, 1, weight, 'VALID');
              }
            }
            attemptsStmt.finalize();

            // 9. Current State
            console.log('📝 Creating initial meet state...');
            db.run(`INSERT INTO current_state (id, meet_id, current_flight_id, current_group_id, current_lift_id, 
                    current_round, current_reg_id, timer_start, timer_seconds) 
                    VALUES (1, ?, 1, 1, 'MU', 1, 1, NULL, 60)`, [meetId], (err) => {
              if (err) return reject(err);
              
              console.log('\n✅ Sample data generated successfully!');
              console.log('📊 Summary:');
              console.log('   - 30 athletes');
              console.log('   - 1 meet (Campionato Italiano 2025)');
              console.log('   - 3 judges (HEAD + 2 SIDE)');
              console.log('   - 2 flights (Morning/Afternoon)');
              console.log('   - 4 groups');
              console.log('   - 120 attempts (openers for 4 lifts)\n');
              
              resolve();
            });
          });
        });
    });
  });
}

/**
 * Main seed function
 */
async function seed() {
  try {
    console.log('🔄 Starting database seed process...\n');
    
    // First sync standard data from remote
    await syncFromRemote();
    
    // Then generate sample data
    await generateSampleData();
    
    console.log('✅ Database seed completed successfully!\n');
    
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  } finally {
    // Close connections gracefully
    try {
      // Close remote pool first
      if (remotePool) {
        await remotePool.end();
        console.log('✅ Remote database connection closed');
      }
    } catch (err) {
      // Ignore shutdown errors from remote (already closed by server)
      if (err.code !== 'XX000' && !err.message?.includes('shutdown')) {
        console.warn('⚠️  Warning closing remote connection:', err.message);
      }
    }
    
    try {
      // Then close local db
      if (db) {
        db.close((err) => {
          if (err) {
            console.warn('⚠️  Warning closing local database:', err.message);
          } else {
            console.log('✅ Local database connection closed');
          }
        });
      }
    } catch (err) {
      console.warn('⚠️  Warning closing local database:', err.message);
    }
    
    // Give time for connections to close gracefully
    setTimeout(() => {
      console.log('\n🎉 All done! Ready to start server.\n');
      process.exit(0);
    }, 500);
  }
}

// Run seed
seed();