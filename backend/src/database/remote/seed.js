/**
 * Remote Database Seed Script
 * 
 * Populates the remote PostgreSQL database with:
 * - Standard weight and age categories
 * - Sample federation account
 * - Initial records (optional)
 */

import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

async function seedRemoteDatabase() {
  console.log('🌱 Seeding remote database...\n');

  if (!process.env.DATABASE_REMOTE_URL) {
    console.error('❌ DATABASE_REMOTE_URL not configured');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_REMOTE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to remote database\n');

    // 0. Clean existing data (except schema)
    console.log('🗑️  Cleaning existing data...');
    await client.query('DELETE FROM public_results');
    await client.query('DELETE FROM public_meets');
    await client.query('DELETE FROM public_records');
    await client.query('DELETE FROM athletes_history');
    await client.query('DELETE FROM age_categories_std');
    await client.query('DELETE FROM weight_categories_std');
    await client.query('DELETE FROM federations');
    console.log('   ✅ All data cleaned\n');

    // 1. Create federation account
    console.log('📋 Creating federation account...');
    const passwordHash = await bcrypt.hash('password123', 10);
    
    await client.query(`
      INSERT INTO federations (name, password_hash, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (name) DO NOTHING
    `, ['STREETLIFTING ITALIA', passwordHash]);
    console.log('   ✅ Federation: STREETLIFTING ITALIA\n');

    // 2. Insert standard weight categories
    console.log('📋 Creating standard weight categories...');
    const weightCategories = [
      // Men's categories (Streetlifting Italia)
      ['M -59kg', null, 59.00, 'M'],
      ['M -66kg', 59.01, 66.00, 'M'],
      ['M -73kg', 66.01, 73.00, 'M'],
      ['M -80kg', 73.01, 80.00, 'M'],
      ['M -87kg', 80.01, 87.00, 'M'],
      ['M -94kg', 87.01, 94.00, 'M'],
      ['M -101kg', 94.01, 101.00, 'M'],
      ['M +101kg', 101.01, null, 'M'],
      // Women's categories (Streetlifting Italia)
      ['F -52kg', null, 52.00, 'F'],
      ['F -57kg', 52.01, 57.00, 'F'],
      ['F -63kg', 57.01, 63.00, 'F'],
      ['F -70kg', 63.01, 70.00, 'F'],
      ['F +70kg', 70.01, null, 'F']
    ];

    for (const [name, min_kg, max_kg, sex] of weightCategories) {
      await client.query(`
        INSERT INTO weight_categories_std (name, min_kg, max_kg, sex)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, [name, min_kg, max_kg, sex]);
    }
    console.log(`   ✅ ${weightCategories.length} weight categories\n`);

    // 3. Insert standard age categories
    console.log('📋 Creating standard age categories...');
    const ageCategories = [
      ['Sub-Junior', null, 18],
      ['Junior', 19, 23],
      ['Senior', 24, 39],
      ['Master I', 40, 49],
      ['Master II', 50, 59],
      ['Master III', 60, 69],
      ['Master IV', 70, null]
    ];

    for (const [name, min_age, max_age] of ageCategories) {
      await client.query(`
        INSERT INTO age_categories_std (name, min_age, max_age)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO NOTHING
      `, [name, min_age, max_age]);
    }
    console.log(`   ✅ ${ageCategories.length} age categories\n`);

    client.release();
    console.log('✅ Remote database seeded successfully!\n');
    console.log('� Summary:');
    console.log('   - 1 federation account (STREETLIFTING ITALIA)');
    console.log('   - 13 weight categories (8M + 5F)');
    console.log('   - 7 age categories');
    console.log('   - 0 athletes (will be synced from local)');
    console.log('   - 0 meets (will be synced from local)');
    console.log('   - 0 records (will be checked during sync)\n');
    console.log('� Test credentials:');
    console.log('   Federation: STREETLIFTING ITALIA');
    console.log('   Password: password123\n');
    console.log('� Ready for sync! Run:');
    console.log('   node src/database/sync.js 1\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
seedRemoteDatabase()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

export default seedRemoteDatabase;
