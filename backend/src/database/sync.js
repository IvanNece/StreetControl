/**
 * Database Synchronization Service
 * 
 * 🎯 PURPOSE: Synchronizes competition data from local SQLite to remote PostgreSQL
 * 
 * 📊 WHAT IT DOES (in order):
 * 1. Syncs athletes to remote athletes_history (by CF - codice fiscale)
 * 2. Creates/updates meet record in remote public_meets (by meet_code)
 * 3. Uploads results to remote public_results with:
 *    - Athlete linkage (finds remote athlete_id by CF)
 *    - Category mapping (maps local category IDs to remote by name)
 *    - Ranking calculation (final_placing within same category)
 * 4. Checks and updates records in remote public_records:
 *    - Compares all valid lifts against existing records
 *    - Updates records if new weight > current record
 *    - Uses athlete_cf for record holder tracking
 * 
 * 🔑 KEY FEATURES:
 * - ID-agnostic: Uses CF for athletes, meet_code for meets, names for categories
 * - Works across different databases (SQLite ≠ PostgreSQL IDs)
 * - Reusable: Can sync any meet by its unique code
 * - Handles missing athletes (athlete_id can be NULL in results)
 * 
 * 🚀 USAGE: node src/database/sync.js <meet_code>
 * Example: node src/database/sync.js SLI-2025-ROMA-01
 */

import sqlite3 from 'sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/street_control.db');

/**
 * Synchronize local competition data to remote database
 */
async function syncToRemote(meetCode) {
  console.log('🔄 Starting synchronization to remote database...\n');

  if (!process.env.DATABASE_REMOTE_URL) {
    console.error('❌ DATABASE_REMOTE_URL not configured');
    return;
  }

  // Connect to local SQLite
  const localDb = new sqlite3.Database(DB_PATH);
  
  // Connect to remote PostgreSQL
  const remotePool = new Pool({
    connectionString: process.env.DATABASE_REMOTE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const remoteClient = await remotePool.connect();
    console.log('✅ Connected to both databases\n');

    // 1. Get meet data from local by meet_code
    console.log('📊 Fetching meet data from local database...');
    const meet = await getMeetData(localDb, meetCode);
    
    if (!meet) {
      throw new Error(`Meet with code "${meetCode}" not found`);
    }

    console.log(`   Meet Code: ${meet.meet_code}`);
    console.log(`   Meet: ${meet.name}`);
    console.log(`   Date: ${meet.start_date}`);
    console.log(`   Level: ${meet.level}\n`);

    // 2. Get all results from local
    console.log('📊 Fetching results from local database...');
    const results = await getResults(localDb, meet.id);
    console.log(`   Found ${results.length} results\n`);

    // 3. Sync athletes to athletes_history
    console.log('👥 Syncing athletes to remote...');
    await syncAthletes(localDb, remoteClient, meet.id);

    // 4. Insert/update meet into public_meets by meet_code
    console.log('📝 Creating/updating meet record in remote...');
    const remoteMeetId = await createRemoteMeet(remoteClient, meet);
    console.log(`   Remote meet ID: ${remoteMeetId}\n`);

    // 5. Insert results into public_results
    console.log('📊 Uploading results to remote...');
    await uploadResults(remoteClient, remoteMeetId, results, localDb);
    console.log(`   Uploaded ${results.length} results\n`);

    // 6. Check and update records
    console.log('🏆 Checking for new records...');
    const newRecords = await checkAndUpdateRecords(localDb, remoteClient, results, meet.meet_code);
    if (newRecords.length > 0) {
      console.log(`   🎉 ${newRecords.length} new record(s) set!`);
      newRecords.forEach(r => {
        console.log(`      ${r.lift} ${r.category}: ${r.weight}kg by ${r.holder}`);
      });
    } else {
      console.log('   No new records\n');
    }

    remoteClient.release();
    console.log('\n✅ Synchronization completed successfully!');
    console.log('📊 Meet archived to remote database');
    console.log('🏆 Records updated\n');

  } catch (error) {
    console.error('❌ Synchronization failed:', error.message);
    throw error;
  } finally {
    localDb.close();
    await remotePool.end();
  }
}

/**
 * Get meet data from local database by meet_code
 */
function getMeetData(db, meetCode) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM meets WHERE meet_code = ?',
      [meetCode],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

/**
 * Get all results for a meet
 */
function getResults(db, meetId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        r.id,
        a.cf,
        a.first_name,
        a.last_name,
        a.sex,
        r.bodyweight_kg,
        r.weight_cat_id,
        r.age_cat_id,
        -- Best lifts (max valid attempt per lift)
        (SELECT MAX(weight_kg) FROM attempts WHERE reg_id = r.id AND lift = 'MU' AND status = 'VALID') as best_mu,
        (SELECT MAX(weight_kg) FROM attempts WHERE reg_id = r.id AND lift = 'PU' AND status = 'VALID') as best_pu,
        (SELECT MAX(weight_kg) FROM attempts WHERE reg_id = r.id AND lift = 'DIP' AND status = 'VALID') as best_dip,
        (SELECT MAX(weight_kg) FROM attempts WHERE reg_id = r.id AND lift = 'SQ' AND status = 'VALID') as best_sq,
        (SELECT MAX(weight_kg) FROM attempts WHERE reg_id = r.id AND lift = 'MP' AND status = 'VALID') as best_mp
      FROM registrations r
      JOIN athletes a ON a.id = r.athlete_id
      WHERE r.meet_id = ?
    `;
    
    db.all(query, [meetId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Sync athletes to remote athletes_history
 */
async function syncAthletes(localDb, remoteClient, meetId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT DISTINCT a.cf, a.first_name, a.last_name, a.sex, a.birth_date
      FROM athletes a
      JOIN registrations r ON r.athlete_id = a.id
      WHERE r.meet_id = ?
    `;
    
    localDb.all(query, [meetId], async (err, athletes) => {
      if (err) return reject(err);
      
      try {
        for (const athlete of athletes) {
          // Insert or update athlete
          await remoteClient.query(`
            INSERT INTO athletes_history (cf, first_name, last_name, sex, birth_date)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (cf) DO UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              sex = EXCLUDED.sex,
              birth_date = EXCLUDED.birth_date
          `, [athlete.cf, athlete.first_name, athlete.last_name, athlete.sex, athlete.birth_date]);
        }
        console.log(`   Synced ${athletes.length} athletes\n`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Create or update meet record in remote database using meet_code
 */
async function createRemoteMeet(client, meet) {
  // Get the first available federation (STREETLIFTING ITALIA)
  const fedResult = await client.query('SELECT id FROM federations ORDER BY id LIMIT 1');
  
  if (fedResult.rows.length === 0) {
    throw new Error('No federation found in remote database. Please run: node src/database/remote/seed.js');
  }
  
  const federationId = fedResult.rows[0].id;
  
  // Insert or update using meet_code as unique identifier
  const result = await client.query(`
    INSERT INTO public_meets (federation_id, meet_code, name, date, level, regulation_code, lifts_json)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (meet_code) DO UPDATE SET
      name = EXCLUDED.name,
      date = EXCLUDED.date,
      level = EXCLUDED.level,
      regulation_code = EXCLUDED.regulation_code,
      lifts_json = EXCLUDED.lifts_json
    RETURNING id
  `, [federationId, meet.meet_code, meet.name, meet.start_date, meet.level, meet.regulation_code, meet.lifts_json]);
  
  return result.rows[0].id;
}

/**
 * Upload results to remote database with rankings
 */
async function uploadResults(client, remoteMeetId, results, localDb) {
  // First pass: collect all results with mapped IDs and calculated data
  const mappedResults = [];
  
  for (const result of results) {
    // Get category names from local DB
    const weightCatName = await new Promise((resolve, reject) => {
      localDb.get('SELECT name FROM weight_categories WHERE id = ?', [result.weight_cat_id], (err, row) => {
        if (err) reject(err);
        else resolve(row?.name);
      });
    });

    const ageCatName = await new Promise((resolve, reject) => {
      localDb.get('SELECT name FROM age_categories WHERE id = ?', [result.age_cat_id], (err, row) => {
        if (err) reject(err);
        else resolve(row?.name);
      });
    });

    // Find corresponding IDs in remote DB by name
    const remoteWeightCat = await client.query(
      'SELECT id FROM weight_categories_std WHERE name = $1',
      [weightCatName]
    );
    
    const remoteAgeCat = await client.query(
      'SELECT id FROM age_categories_std WHERE name = $1',
      [ageCatName]
    );

    if (remoteWeightCat.rows.length === 0) {
      console.warn(`   ⚠️  Weight category "${weightCatName}" not found in remote DB, skipping result for ${result.first_name} ${result.last_name}`);
      continue;
    }

    if (remoteAgeCat.rows.length === 0) {
      console.warn(`   ⚠️  Age category "${ageCatName}" not found in remote DB, skipping result for ${result.first_name} ${result.last_name}`);
      continue;
    }

    const remoteWeightCatId = remoteWeightCat.rows[0].id;
    const remoteAgeCatId = remoteAgeCat.rows[0].id;

    // Find athlete_id in remote by CF (codice fiscale)
    const remoteAthlete = await client.query(
      'SELECT id FROM athletes_history WHERE cf = $1',
      [result.cf]
    );
    
    const remoteAthleteId = remoteAthlete.rows.length > 0 ? remoteAthlete.rows[0].id : null;

    // Calculate total (sum of valid lifts)
    const total = (result.best_mu || 0) + (result.best_pu || 0) + 
                  (result.best_dip || 0) + (result.best_sq || 0) + (result.best_mp || 0);
    
    // Calculate points (simplified - should use regulation formula based on bodyweight)
    // For now: points = total (will be improved with Wilks/IPF formula)
    const points = total;

    mappedResults.push({
      ...result,
      remoteWeightCatId,
      remoteAgeCatId,
      remoteAthleteId,
      total,
      points
    });
  }

  // Sort by points descending for ranking (within same weight category)
  const resultsByCategory = {};
  for (const r of mappedResults) {
    const key = `${r.remoteWeightCatId}-${r.remoteAgeCatId}`;
    if (!resultsByCategory[key]) {
      resultsByCategory[key] = [];
    }
    resultsByCategory[key].push(r);
  }

  // Sort each category by points (DESC) and assign final_placing
  for (const key in resultsByCategory) {
    resultsByCategory[key].sort((a, b) => b.points - a.points);
    resultsByCategory[key].forEach((r, index) => {
      r.final_placing = index + 1;
    });
  }

  // Second pass: insert all results with final_placing
  for (const result of mappedResults) {
    await client.query(`
      INSERT INTO public_results 
        (meet_id, athlete_id, weight_cat_id, age_cat_id, 
         best_mu_kg, best_pu_kg, best_dip_kg, best_sq_kg, best_mp_kg, 
         total_kg, points, final_placing)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      remoteMeetId,
      result.remoteAthleteId, // Can be NULL if athlete not in history
      result.remoteWeightCatId,
      result.remoteAgeCatId,
      result.best_mu,
      result.best_pu,
      result.best_dip,
      result.best_sq,
      result.best_mp,
      result.total,
      result.points,
      result.final_placing
    ]);
  }
}

/**
 * Check for new records and update
 */
async function checkAndUpdateRecords(localDb, remoteClient, results, meetCode) {
  const newRecords = [];
  
  // Check each result for potential records
  for (const result of results) {
    // Get category names from local DB
    const weightCatName = await new Promise((resolve, reject) => {
      localDb.get('SELECT name FROM weight_categories WHERE id = ?', [result.weight_cat_id], (err, row) => {
        if (err) reject(err);
        else resolve(row?.name);
      });
    });

    const ageCatName = await new Promise((resolve, reject) => {
      localDb.get('SELECT name FROM age_categories WHERE id = ?', [result.age_cat_id], (err, row) => {
        if (err) reject(err);
        else resolve(row?.name);
      });
    });

    // Find corresponding IDs in remote DB by name
    const remoteWeightCat = await remoteClient.query(
      'SELECT id FROM weight_categories_std WHERE name = $1',
      [weightCatName]
    );
    
    const remoteAgeCat = await remoteClient.query(
      'SELECT id FROM age_categories_std WHERE name = $1',
      [ageCatName]
    );

    if (remoteWeightCat.rows.length === 0 || remoteAgeCat.rows.length === 0) {
      continue; // Skip if categories not found
    }

    const remoteWeightCatId = remoteWeightCat.rows[0].id;
    const remoteAgeCatId = remoteAgeCat.rows[0].id;

    const lifts = [
      { name: 'MU', weight: result.best_mu },
      { name: 'PU', weight: result.best_pu },
      { name: 'DIP', weight: result.best_dip },
      { name: 'SQ', weight: result.best_sq },
      { name: 'MP', weight: result.best_mp }
    ];

    for (const lift of lifts) {
      if (!lift.weight) continue;

      // Check if this is a record using remote IDs
      const currentRecord = await remoteClient.query(`
        SELECT record_kg FROM public_records
        WHERE weight_cat_id = $1 AND age_cat_id = $2 AND lift = $3
      `, [remoteWeightCatId, remoteAgeCatId, lift.name]);

      if (currentRecord.rows.length === 0 || lift.weight > currentRecord.rows[0].record_kg) {
        // New record! Update using athlete_cf and meet_code
        await remoteClient.query(`
          INSERT INTO public_records 
            (weight_cat_id, age_cat_id, lift, record_kg, athlete_cf, meet_code, set_date)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
          ON CONFLICT (weight_cat_id, age_cat_id, lift) DO UPDATE SET
            record_kg = EXCLUDED.record_kg,
            athlete_cf = EXCLUDED.athlete_cf,
            meet_code = EXCLUDED.meet_code,
            set_date = EXCLUDED.set_date
        `, [
          remoteWeightCatId,
          remoteAgeCatId,
          lift.name,
          lift.weight,
          result.cf,      // Use codice fiscale for athlete tracking
          meetCode        // Use meet_code with FK to public_meets
        ]);

        newRecords.push({
          lift: lift.name,
          category: `${weightCatName} / ${ageCatName}`,
          weight: lift.weight,
          holder: `${result.first_name} ${result.last_name} (${result.cf})`
        });
      }
    }
  }

  return newRecords;
}

// CLI usage
const meetCode = process.argv[2];
if (!meetCode) {
  console.log('Usage: node sync.js <meet_code>');
  console.log('Example: node sync.js SLI-2025-ROMA-01');
  process.exit(1);
}

syncToRemote(meetCode).catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
