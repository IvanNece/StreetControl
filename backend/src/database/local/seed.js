/**
 * Local Database Seed Data
 * 
 * Generate realistic test data for development and testing
 * Run with: npm run seed
 */

import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../../data/streetcontrol.db');

// Ensure data directory exists
const dataDir = join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

/**
 * Seed data for a realistic competition
 */
async function seed() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🌱 Seeding database with test data...\n');

      // 1. Users (organizers)
      console.log('📝 Inserting users...');
      db.run(`INSERT INTO users (username, password_hash, role) VALUES 
        ('admin', '$2b$10$rZ5Q9vZ9Z9Z9Z9Z9Z9Z9Z.Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9', 'organizer'),
        ('organizer1', '$2b$10$rZ5Q9vZ9Z9Z9Z9Z9Z9Z9Z.Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9', 'organizer')`);

      // 2. Weight Categories (Streetlifting Italia)
      console.log('📝 Inserting weight categories...');
      db.run(`INSERT INTO weight_categories (name, min_kg, max_kg, sex) VALUES
        ('M -59kg', NULL, 59.00, 'M'),
        ('M -66kg', 59.01, 66.00, 'M'),
        ('M -73kg', 66.01, 73.00, 'M'),
        ('M -80kg', 73.01, 80.00, 'M'),
        ('M -87kg', 80.01, 87.00, 'M'),
        ('M -94kg', 87.01, 94.00, 'M'),
        ('M -101kg', 94.01, 101.00, 'M'),
        ('M +101kg', 101.01, NULL, 'M'),
        ('F -52kg', NULL, 52.00, 'F'),
        ('F -57kg', 52.01, 57.00, 'F'),
        ('F -63kg', 57.01, 63.00, 'F'),
        ('F -70kg', 63.01, 70.00, 'F'),
        ('F +70kg', 70.01, NULL, 'F')`);

      // 3. Age Categories
      console.log('📝 Inserting age categories...');
      db.run(`INSERT INTO age_categories (name, min_age, max_age) VALUES
        ('U18', NULL, 17),
        ('Junior', 18, 23),
        ('Senior', 24, 39),
        ('Master 40-49', 40, 49),
        ('Master 50+', 50, NULL)`);

      // 4. Athletes (30 realistic athletes)
      console.log('📝 Inserting 30 athletes...');
      const athletes = [
        // -80kg Men
        `('RSSMRA85M01H501Z', 'Mario', 'Rossi', 'M', '1985-08-01')`,
        `('VRDLCA88C15F205W', 'Luca', 'Verdi', 'M', '1988-03-15')`,
        `('BNCGVN90H20L219K', 'Giovanni', 'Bianchi', 'M', '1990-06-20')`,
        `('FRRPLO92D10A001X', 'Paolo', 'Ferrari', 'M', '1992-04-10')`,
        `('MRNMRC87L05B111Y', 'Marco', 'Moretti', 'M', '1987-07-05')`,
        `('CSTFNC91A12C351Z', 'Francesco', 'Costa', 'M', '1991-01-12')`,
        `('RCCNDR89E18D612A', 'Andrea', 'Ricci', 'M', '1989-05-18')`,
        `('BRTDVD93M22E506B', 'Davide', 'Bertoli', 'M', '1993-08-22')`,
        // -87kg Men
        `('GLLMTT86B14F839C', 'Matteo', 'Galli', 'M', '1986-02-14')`,
        `('FNTSMN90F16G273D', 'Simone', 'Fontana', 'M', '1990-06-16')`,
        `('GRSLRA94C11H501E', 'Lorenzo', 'Grassi', 'M', '1994-03-11')`,
        `('CRBFPP88G25L736F', 'Filippo', 'Carbone', 'M', '1988-07-25')`,
        `('MNGDNL91H30M052G', 'Daniele', 'Mangano', 'M', '1991-06-30')`,
        `('PLLLSN87D08A794H', 'Alessandro', 'Pelli', 'M', '1987-04-08')`,
        // -94kg Men
        `('SNTMLS92L15B157I', 'Tommaso', 'Santi', 'M', '1992-07-15')`,
        `('GRSNTN89A20C351J', 'Antonio', 'Grossi', 'M', '1989-01-20')`,
        `('MRNGPP95E12D612K', 'Giuseppe', 'Marini', 'M', '1995-05-12')`,
        `('VLNNDR86M18E506L', 'Alessio', 'Valentini', 'M', '1986-08-18')`,
        // +94kg Men
        `('RMNFDR93C22F839M', 'Federico', 'Romani', 'M', '1993-03-22')`,
        `('BRBRCR88H14G273N', 'Riccardo', 'Barbieri', 'M', '1988-06-14')`,
        // -63kg Women
        `('RSSGLT92D45H501O', 'Giulia', 'Russo', 'F', '1992-04-05')`,
        `('BRNCHR90F52L219P', 'Chiara', 'Bruno', 'F', '1990-06-12')`,
        `('FRNMRT94A48A001Q', 'Marta', 'Ferrante', 'F', '1994-01-08')`,
        `('GRSLRA91L55B111R', 'Laura', 'Grassi', 'F', '1991-07-15')`,
        // -72kg Women
        `('CSTFRN89E42C351S', 'Francesca', 'Castelli', 'F', '1989-05-02')`,
        `('MRNSLV93M58D612T', 'Silvia', 'Marini', 'F', '1993-08-18')`,
        `('VLNSRA87C44E506U', 'Sara', 'Valentini', 'F', '1987-03-04')`,
        // +72kg Women
        `('BNCELS95H50F839V', 'Elisa', 'Bianco', 'F', '1995-06-10')`,
        `('FRRANN88D46G273W', 'Anna', 'Ferrero', 'F', '1988-04-06')`,
        `('MRNGIA91L48H501X', 'Giorgia', 'Morandi', 'F', '1991-07-08')`
      ];
      
      db.run(`INSERT INTO athletes (cf, first_name, last_name, sex, birth_date) VALUES ${athletes.join(',')}`);

      // 5. Meet (Sample competition)
      console.log('📝 Inserting meet...');
      db.run(`INSERT INTO meets (name, meet_type, start_date, level, regulation_code, lifts_json) VALUES
        ('Campionato Italiano Streetlifting 2025', 'FULL', '2025-11-15', 'NAZIONALE', 'WL_COEFF_2025', '["MU","PU","DIP","SQ"]')`,
        function(err) {
          if (err) return reject(err);
          const meetId = this.lastID;
          
          // 6. Judges (3 judges: 1 HEAD + 2 SIDE)
          console.log('📝 Inserting judges...');
          db.run(`INSERT INTO judges (meet_id, role) VALUES
            (${meetId}, 'HEAD'),
            (${meetId}, 'SIDE'),
            (${meetId}, 'SIDE')`);

          // 7. Registrations (30 athletes registered)
          console.log('📝 Inserting registrations...');
          const registrations = [];
          for (let i = 1; i <= 30; i++) {
            const bodyweight = 65 + (i * 1.2); // Realistic bodyweights
            const weightCat = i <= 8 ? 3 : (i <= 14 ? 4 : (i <= 18 ? 5 : (i <= 20 ? 6 : (i <= 24 ? 8 : 9))));
            const ageCat = 3; // Most are Senior
            registrations.push(`(${meetId}, ${i}, ${bodyweight.toFixed(2)}, 3, 2, 0, ${weightCat}, ${ageCat}, NULL)`);
          }
          
          db.run(`INSERT INTO registrations (meet_id, athlete_id, bodyweight_kg, rack_height, belt_height, out_of_weight, weight_cat_id, age_cat_id, notes) 
                  VALUES ${registrations.join(',')}`, function(err) {
            if (err) return reject(err);

            // 8. Flights (2 flights: morning and afternoon)
            console.log('📝 Inserting flights...');
            db.run(`INSERT INTO flights (meet_id, name, ord, start_time) VALUES
              (${meetId}, 'Flight A - Mattina', 1, '09:00'),
              (${meetId}, 'Flight B - Pomeriggio', 2, '14:00')`, function(err) {
              if (err) return reject(err);

              // 9. Groups (4 groups total: 2 per flight)
              console.log('📝 Inserting groups...');
              db.run(`INSERT INTO groups (flight_id, name, ord) VALUES
                (1, 'Gruppo 1 (-80kg)', 1),
                (1, 'Gruppo 2 (-87kg)', 2),
                (2, 'Gruppo 3 (-94kg / +94kg)', 1),
                (2, 'Gruppo 4 (Donne)', 2)`, function(err) {
                if (err) return reject(err);

                // 10. Group Entries (assign athletes to groups)
                console.log('📝 Inserting group entries...');
                const groupEntries = [];
                // Group 1: Athletes 1-8 (-80kg)
                for (let i = 1; i <= 8; i++) {
                  groupEntries.push(`(1, ${i}, ${i})`);
                }
                // Group 2: Athletes 9-14 (-87kg)
                for (let i = 9; i <= 14; i++) {
                  groupEntries.push(`(2, ${i}, ${i - 8})`);
                }
                // Group 3: Athletes 15-20 (-94kg / +94kg)
                for (let i = 15; i <= 20; i++) {
                  groupEntries.push(`(3, ${i}, ${i - 14})`);
                }
                // Group 4: Athletes 21-30 (Women)
                for (let i = 21; i <= 30; i++) {
                  groupEntries.push(`(4, ${i}, ${i - 20})`);
                }

                db.run(`INSERT INTO group_entries (group_id, reg_id, start_ord) VALUES ${groupEntries.join(',')}`, function(err) {
                  if (err) return reject(err);

                  // 11. Attempts (Openers for all athletes - Attempt 1 only for now)
                  console.log('📝 Inserting attempts (openers)...');
                  const attempts = [];
                  const lifts = ['MU', 'PU', 'DIP', 'SQ'];
                  
                  for (let regId = 1; regId <= 30; regId++) {
                    lifts.forEach(lift => {
                      // Generate realistic opener weights
                      let weight = 0;
                      if (lift === 'MU') weight = 20 + (regId % 10) * 2.5;
                      else if (lift === 'PU') weight = 30 + (regId % 10) * 3;
                      else if (lift === 'DIP') weight = 35 + (regId % 10) * 3.5;
                      else if (lift === 'SQ') weight = 50 + (regId % 10) * 5;

                      attempts.push(`(${regId}, '${lift}', 1, ${weight}, 'PENDING', datetime('now'), NULL, NULL)`);
                    });
                  }

                  db.run(`INSERT INTO attempts (reg_id, lift, attempt_no, weight_kg, status, ts_declared, ts_finalized, notes) 
                          VALUES ${attempts.join(',')}`, function(err) {
                    if (err) return reject(err);

                    // 12. Current State (initialize to first athlete of first group)
                    console.log('📝 Inserting current state...');
                    db.run(`INSERT INTO current_state (id, meet_id, current_flight_id, current_group_id, current_lift, current_round, current_reg_id, timer_start, timer_seconds) 
                            VALUES (1, ${meetId}, 1, 1, 'MU', 1, 1, NULL, 60)`, function(err) {
                      if (err) return reject(err);

                      // 13. Records (Sample records for reference)
                      console.log('📝 Inserting sample records...');
                      db.run(`INSERT INTO records (weight_cat_id, age_cat_id, lift, record_kg, holder_name, set_date, notes) VALUES
                        (3, 3, 'MU', 45.5, 'Marco Alberti', '2024-06-15', NULL),
                        (3, 3, 'PU', 62.0, 'Luca Neri', '2024-06-15', NULL),
                        (3, 3, 'DIP', 70.0, 'Andrea Bianchi', '2024-06-15', NULL),
                        (3, 3, 'SQ', 95.0, 'Paolo Verdi', '2024-06-15', NULL),
                        (4, 3, 'MU', 50.0, 'Simone Rossi', '2024-08-20', NULL),
                        (4, 3, 'PU', 68.5, 'Lorenzo Grassi', '2024-08-20', NULL),
                        (4, 3, 'DIP', 75.0, 'Filippo Carbone', '2024-08-20', NULL),
                        (4, 3, 'SQ', 105.0, 'Daniele Mangano', '2024-08-20', NULL),
                        (8, 3, 'PU', 45.0, 'Giulia Rossi', '2024-05-10', NULL),
                        (8, 3, 'DIP', 38.0, 'Chiara Bruno', '2024-05-10', NULL)`, function(err) {
                        if (err) return reject(err);

                        console.log('\n✅ Database seeded successfully!');
                        console.log('📊 Summary:');
                        console.log('   - 30 athletes');
                        console.log('   - 1 meet (Campionato Italiano 2025)');
                        console.log('   - 2 flights (Morning/Afternoon)');
                        console.log('   - 4 groups');
                        console.log('   - 120 attempts (openers for 4 lifts)');
                        console.log('   - 10 sample records\n');
                        
                        db.close();
                        resolve();
                      });
                    });
                  });
                });
              });
            });
          });
        }
      );
    });
  });
}

// Run seed
seed().catch(err => {
  console.error('❌ Error seeding database:', err);
  process.exit(1);
});
