/**
 * Database Synchronization Service
 * 
 * Syncs local SQLite data to remote PostgreSQL at the end of competition
 * This uploads results, updates records, and archives the meet
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

const DB_PATH = join(__dirname, '../../data/streetcontrol.db');

/**
 * Synchronize local competition data to remote database
 */
async function syncToRemote(meetId) {
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

    // 1. Get meet data from local
    console.log('📊 Fetching meet data from local database...');
    const meet = await getMeetData(localDb, meetId);
    
    if (!meet) {
      throw new Error(`Meet with ID ${meetId} not found`);
    }

    console.log(`   Meet: ${meet.name}`);
    console.log(`   Date: ${meet.start_date}`);
    console.log(`   Level: ${meet.level}\n`);

    // 2. Get all results from local
    console.log('📊 Fetching results from local database...');
    const results = await getResults(localDb, meetId);
    console.log(`   Found ${results.length} results\n`);

    // 3. Sync athletes to athletes_history
    console.log('👥 Syncing athletes to remote...');
    await syncAthletes(localDb, remoteClient, meetId);

    // 4. Insert meet into public_meets
    console.log('📝 Creating meet record in remote...');
    const remoteMeetId = await createRemoteMeet(remoteClient, meet);
    console.log(`   Remote meet ID: ${remoteMeetId}\n`);

    // 5. Insert results into public_results
    console.log('📊 Uploading results to remote...');
    await uploadResults(remoteClient, remoteMeetId, results, localDb);
    console.log(`   Uploaded ${results.length} results\n`);

    // 6. Check and update records
    console.log('🏆 Checking for new records...');
    const newRecords = await checkAndUpdateRecords(localDb, remoteClient, results);
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
 * Get meet data from local database
 */
function getMeetData(db, meetId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM meets WHERE id = ?',
      [meetId],
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
 * Create meet record in remote database
 */
async function createRemoteMeet(client, meet) {
  // Get the first available federation (STREETLIFTING ITALIA)
  const fedResult = await client.query('SELECT id FROM federations ORDER BY id LIMIT 1');
  
  if (fedResult.rows.length === 0) {
    throw new Error('No federation found in remote database. Please run: node src/database/remote/seed.js');
  }
  
  const federationId = fedResult.rows[0].id;
  
  const result = await client.query(`
    INSERT INTO public_meets (federation_id, name, date, level, regulation_code, lifts_json)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [federationId, meet.name, meet.start_date, meet.level, meet.regulation_code, meet.lifts_json]);
  
  return result.rows[0].id;
}

/**
 * Upload results to remote database
 */
async function uploadResults(client, remoteMeetId, results, localDb) {
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

    // Calculate total (sum of valid lifts)
    const total = (result.best_mu || 0) + (result.best_pu || 0) + 
                  (result.best_dip || 0) + (result.best_sq || 0) + (result.best_mp || 0);
    
    // Calculate points (simplified - should use regulation formula)
    const points = total * 1.0; // Placeholder

    await client.query(`
      INSERT INTO public_results 
        (meet_id, first_name, last_name, weight_cat_id, age_cat_id, 
         best_mu_kg, best_pu_kg, best_dip_kg, best_sq_kg, best_mp_kg, 
         total_kg, points)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      remoteMeetId, result.first_name, result.last_name, 
      remoteWeightCatId, remoteAgeCatId,
      result.best_mu, result.best_pu, result.best_dip, result.best_sq, result.best_mp,
      total, points
    ]);
  }
}

/**
 * Check for new records and update
 */
async function checkAndUpdateRecords(localDb, remoteClient, results) {
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
        // New record!
        await remoteClient.query(`
          INSERT INTO public_records 
            (weight_cat_id, age_cat_id, lift, record_kg, holder_first, holder_last, set_date)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
          ON CONFLICT (weight_cat_id, age_cat_id, lift) DO UPDATE SET
            record_kg = EXCLUDED.record_kg,
            holder_first = EXCLUDED.holder_first,
            holder_last = EXCLUDED.holder_last,
            set_date = EXCLUDED.set_date
        `, [
          remoteWeightCatId, remoteAgeCatId, lift.name,
          lift.weight, result.first_name, result.last_name
        ]);

        newRecords.push({
          lift: lift.name,
          category: `${weightCatName} / ${ageCatName}`,
          weight: lift.weight,
          holder: `${result.first_name} ${result.last_name}`
        });
      }
    }
  }

  return newRecords;
}

// CLI usage
const meetId = process.argv[2];
if (!meetId) {
  console.log('Usage: node sync.js <meet_id>');
  console.log('Example: node sync.js 1');
  process.exit(1);
}

syncToRemote(parseInt(meetId)).catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
