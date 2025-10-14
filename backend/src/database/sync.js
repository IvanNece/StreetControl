/**
 * Streetlifting Meet Sync Service (Final Version)
 * -----------------------------------------------
 * 🔄 Synchronizes a full meet from local SQLite → remote PostgreSQL.
 *
 * ORDER:
 * 1️⃣ Sync athletes (insert/update)
 * 2️⃣ Check if meet already exists → stop if found
 * 3️⃣ Insert meet
 * 4️⃣ Atomic transaction:
 *     - update records
 *     - insert results + result_lifts
 *
 * ⚙️ Usage:
 * node sync.js <meet_code>
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

/* ------------------------------------------------------------- */
/* 📦 MAIN SYNC FUNCTION                                          */
/* ------------------------------------------------------------- */
async function syncToRemote(meetCode) {
  console.log(`🔄 Starting sync for meet: ${meetCode}\n`);

  if (!process.env.DATABASE_REMOTE_URL) {
    console.error('❌ DATABASE_REMOTE_URL not configured');
    process.exit(1);
  }

  let localDb = null;
  let remotePool = null;
  let remoteClient = null;

  try {
    localDb = new sqlite3.Database(DB_PATH);
    remotePool = new Pool({
      connectionString: process.env.DATABASE_REMOTE_URL,
      ssl: { rejectUnauthorized: false },
    });

    remoteClient = await remotePool.connect();
    console.log('✅ Connected to both databases\n');

    // 1️⃣ Get meet info from local
    const meet = await getMeet(localDb, meetCode);
    if (!meet) throw new Error(`Meet with code "${meetCode}" not found`);
    console.log(`📘 Meet: ${meet.name} (${meet.meet_type_id})\n`);

    // 2️⃣ Sync athletes (always safe)
    await syncAthletes(localDb, remoteClient, meet.id);

    // 3️⃣ Check if meet already exists
    const existing = await remoteClient.query(
      'SELECT id FROM public_meets WHERE meet_code = $1',
      [meet.meet_code]
    );
    if (existing.rows.length > 0) {
      console.log('⚠️ Meet already exists in remote DB. Skipping sync.\n');
      localDb.close();
      await remoteClient.release();
      await remotePool.end();
      process.exit(0);
    }

    // 4️⃣ Insert new meet (no ON CONFLICT)
    const remoteMeetId = await insertMeet(remoteClient, meet);
    console.log(`✅ Meet inserted → remote ID: ${remoteMeetId}\n`);

    // 5️⃣ BEGIN TRANSACTION (atomic)
    await remoteClient.query('BEGIN');
    try {
      await updateRecords(localDb, remoteClient, meetCode);
      await uploadResults(localDb, remoteClient, meet, remoteMeetId);

      await remoteClient.query('COMMIT');
      console.log('💾 Transaction committed successfully\n');
    } catch (err) {
      await remoteClient.query('ROLLBACK');
      throw new Error(`Transaction rolled back due to error: ${err.message}`);
    }

    console.log('\n🏁 Sync completed successfully.');
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  } finally {
    try {
      if (remoteClient) {
        await remoteClient.release();
      }
      if (remotePool) {
        await remotePool.end();
      }
      if (localDb) {
        localDb.close();
      }
      // Ensure the process exits
      process.exit(0);
    } catch (closeError) {
      console.error('Error closing connections:', closeError);
      process.exit(1);
    }
  }
}

/* ------------------------------------------------------------- */
/* 📘 UTILITY FUNCTIONS                                           */
/* ------------------------------------------------------------- */

// Get meet info
function getMeet(db, code) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM meets WHERE meet_code = ?', [code], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Sync athletes (insert or update by CF)
async function syncAthletes(localDb, remoteClient, meetId) {
  console.log('👥 Syncing athletes...');

  const query = `
    SELECT DISTINCT a.cf, a.first_name, a.last_name, a.sex, a.birth_date
    FROM athletes a
    JOIN registrations r ON r.athlete_id = a.id
    WHERE r.meet_id = ?
  `;

  const athletes = await new Promise((resolve, reject) => {
    localDb.all(query, [meetId], (err, rows) => (err ? reject(err) : resolve(rows)));
  });

  for (const a of athletes) {
    await remoteClient.query(
      `
      INSERT INTO athletes_history (cf, first_name, last_name, sex, birth_date)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cf) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        sex = EXCLUDED.sex,
        birth_date = EXCLUDED.birth_date
      `,
      [a.cf, a.first_name, a.last_name, a.sex, a.birth_date]
    );
  }

  console.log(`   ✅ ${athletes.length} athletes synced\n`);
}

// Insert meet (no conflict allowed)
async function insertMeet(client, meet) {
  const fed = await client.query('SELECT id FROM federations ORDER BY id LIMIT 1');
  if (fed.rows.length === 0) throw new Error('No federation found in remote database.');
  const federationId = fed.rows[0].id;

  const res = await client.query(
    `
    INSERT INTO public_meets (federation_id, meet_code, name, date, level, regulation_code, meet_type_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id
    `,
    [federationId, meet.meet_code, meet.name, meet.start_date, meet.level, meet.regulation_code, meet.meet_type_id]
  );
  return res.rows[0].id;
}

// Update records (with bodyweight)
async function updateRecords(localDb, remoteClient, meetCode) {
  console.log('🏆 Updating records...');

  const query = `
    SELECT a.cf, r.bodyweight_kg, r.weight_cat_id, r.age_cat_id, at.lift_id, MAX(at.weight_kg) AS best_kg
    FROM attempts at
    JOIN registrations r ON at.reg_id = r.id
    JOIN athletes a ON a.id = r.athlete_id
    WHERE at.status = 'VALID'
    GROUP BY a.cf, r.bodyweight_kg, r.weight_cat_id, r.age_cat_id, at.lift_id
  `;

  const rows = await new Promise((resolve, reject) => {
    localDb.all(query, [], (err, data) => (err ? reject(err) : resolve(data)));
  });

  for (const row of rows) {
    const weightCat = await getRemoteId(remoteClient, 'weight_categories_std', row.weight_cat_id, localDb);
    const ageCat = await getRemoteId(remoteClient, 'age_categories_std', row.age_cat_id, localDb);
    if (!weightCat || !ageCat) continue;

    const current = await remoteClient.query(
      'SELECT record_kg FROM public_records WHERE weight_cat_id=$1 AND age_cat_id=$2 AND lift=$3',
      [weightCat, ageCat, row.lift_id]
    );

    const currentRecord = current.rows[0]?.record_kg || 0;
    if (row.best_kg > currentRecord) {
      await remoteClient.query(
        `
        INSERT INTO public_records (weight_cat_id, age_cat_id, lift, record_kg, bodyweight_kg, athlete_cf, meet_code, set_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE)
        ON CONFLICT (weight_cat_id, age_cat_id, lift) DO UPDATE SET
          record_kg=EXCLUDED.record_kg,
          bodyweight_kg=EXCLUDED.bodyweight_kg,
          athlete_cf=EXCLUDED.athlete_cf,
          meet_code=EXCLUDED.meet_code,
          set_date=EXCLUDED.set_date
        `,
        [weightCat, ageCat, row.lift_id, row.best_kg, row.bodyweight_kg, row.cf, meetCode]
      );
      console.log(`   🥇 New record in ${row.lift_id}: ${row.best_kg}kg`);
    }
  }
  console.log('   ✅ Records check complete\n');
}

// Upload results and result_lifts (inside transaction)
async function uploadResults(localDb, remoteClient, meet, remoteMeetId) {
  console.log('📊 Uploading results...');

  // get lifts for meet_type
  const lifts = await remoteClient.query(
    `SELECT lift_id FROM meet_type_lifts WHERE meet_type_id = $1 ORDER BY sequence`,
    [meet.meet_type_id]
  );
  const liftIds = lifts.rows.map(r => r.lift_id);

  // get athletes in meet
  const registrations = await new Promise((resolve, reject) => {
    localDb.all(
      `SELECT r.id, r.athlete_id, a.cf, a.first_name, a.last_name,
              r.weight_cat_id, r.age_cat_id, r.bodyweight_kg
       FROM registrations r
       JOIN athletes a ON a.id = r.athlete_id
       WHERE r.meet_id = ?`,
      [meet.id],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });

  const results = [];
  for (const reg of registrations) {
    let total = 0;
    const bestLifts = {};
    for (const lift of liftIds) {
      const maxLift = await new Promise((resolve, reject) => {
        localDb.get(
          `SELECT MAX(weight_kg) as max_kg FROM attempts 
           WHERE reg_id=? AND lift_id=? AND status='VALID'`,
          [reg.id, lift],
          (err, row) => (err ? reject(err) : resolve(row?.max_kg || 0))
        );
      });
      bestLifts[lift] = maxLift;
      total += maxLift;
    }
    results.push({ ...reg, bestLifts, total });
  }

  // sort by total desc, bodyweight asc
  results.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.bodyweight_kg - b.bodyweight_kg;
  });

  // assign placing
  results.forEach((r, i) => (r.final_placing = i + 1));

  for (const res of results) {
    const athlete = await remoteClient.query('SELECT id FROM athletes_history WHERE cf=$1', [res.cf]);
    const athleteId = athlete.rows[0]?.id || null;

    const weightCat = await getRemoteId(remoteClient, 'weight_categories_std', res.weight_cat_id, localDb);
    const ageCat = await getRemoteId(remoteClient, 'age_categories_std', res.age_cat_id, localDb);
    if (!weightCat || !ageCat) continue;

    const inserted = await remoteClient.query(
      `
      INSERT INTO public_results (meet_id, athlete_id, weight_cat_id, age_cat_id,
                                  total_kg, points, final_placing, bodyweight_kg)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [remoteMeetId, athleteId, weightCat, ageCat, res.total, res.total, res.final_placing, res.bodyweight_kg]
    );
    const resultId = inserted.rows[0].id;

    for (const lift of liftIds) {
      const liftVal = res.bestLifts[lift] || 0;
      if (liftVal > 0) {
        await remoteClient.query(
          `INSERT INTO public_result_lifts (result_id, lift_id, lift_kg)
           VALUES ($1,$2,$3)`,
          [resultId, lift, liftVal]
        );
      }
    }
  }

  console.log(`   ✅ Inserted ${results.length} results\n`);
}

// Map local → remote category ID
async function getRemoteId(client, table, localId, localDb) {
  const localName = await new Promise((resolve, reject) => {
    localDb.get(`SELECT name FROM ${table.replace('_std', '')} WHERE id=?`, [localId], (err, row) =>
      err ? reject(err) : resolve(row?.name)
    );
  });
  if (!localName) return null;
  const remote = await client.query(`SELECT id FROM ${table} WHERE name=$1`, [localName]);
  return remote.rows[0]?.id || null;
}

/* ------------------------------------------------------------- */
/* 🚀 CLI ENTRY POINT                                             */
/* ------------------------------------------------------------- */
const meetCode = process.argv[2];
if (!meetCode) {
  console.log('Usage: node sync.js <meet_code>');
  process.exit(1);
}
syncToRemote(meetCode);
