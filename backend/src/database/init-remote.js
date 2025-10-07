/**
 * Initialize Remote PostgreSQL Database
 * 
 * Sets up connection to remote PostgreSQL database (Supabase/Railway)
 * This script tests the connection and optionally creates the schema
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const { Pool } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_PATH = join(__dirname, 'remote/schema.sql');

/**
 * Initialize remote PostgreSQL database
 */
async function initRemoteDatabase() {

  // Check if DATABASE_REMOTE_URL is configured
  if (!process.env.DATABASE_REMOTE_URL) {
    console.warn('⚠️  DATABASE_REMOTE_URL not configured in .env');
    console.log('📝 To setup remote database:');
    console.log('   1. Create a PostgreSQL database on Supabase or Railway');
    console.log('   2. Copy connection URL to .env file');
    console.log('   3. Run this script again\n');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_REMOTE_URL,
    ssl: {
      rejectUnauthorized: false // Required for most hosted PostgreSQL
    }
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connection successful!');

    // Get PostgreSQL version
    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', result.rows[0].version.split(',')[0]);

    // Ask if user wants to create schema
    console.log('\n⚠️  WARNING: This will DROP all existing tables!');
    console.log('📝 To create schema manually:');
    console.log(`   1. Copy content from: ${SCHEMA_PATH}`);
    console.log('   2. Execute in your PostgreSQL client\n');

    // Uncomment below to auto-create schema (USE WITH CAUTION!)
    /*
    console.log('📖 Reading schema file...');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    console.log('🔨 Creating schema...');
    await client.query(schema);
    console.log('✅ Schema created successfully!\n');
    */

    client.release();
    await pool.end();

    console.log('✅ Remote database ready!');
    console.log('💡 Schema file location:', SCHEMA_PATH);
    console.log('📝 Apply schema manually using your PostgreSQL client\n');

  } catch (error) {
    console.error('❌ Error connecting to remote database:', error.message);
    console.log('\n📝 Troubleshooting:');
    console.log('   1. Check DATABASE_REMOTE_URL in .env');
    console.log('   2. Ensure database is accessible');
    console.log('   3. Check firewall/network settings\n');
    process.exit(1);
  }
}

// Run initialization
initRemoteDatabase().catch(err => {
  console.error('❌ Initialization failed:', err);
  process.exit(1);
});
