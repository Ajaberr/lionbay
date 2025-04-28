// Script to initialize database tables
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function initializeDatabase() {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Connecting to database:', process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));

  // Create a database pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // First create the uuid extension if it doesn't exist
    console.log('Creating uuid extension...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Create gen_random_uuid function if it doesn't exist
    console.log('Creating gen_random_uuid function if needed...');
    const checkFunctionExists = await pool.query(`
      SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid';
    `);
    
    if (checkFunctionExists.rowCount === 0) {
      console.log('Creating gen_random_uuid function using uuid-ossp...');
      await pool.query(`
        CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS
        $$
        BEGIN
          RETURN uuid_generate_v4();
        END;
        $$ LANGUAGE plpgsql;
      `);
    }

    // Read schema from database.sql file
    console.log('Reading database schema...');
    const schemaPath = path.join(__dirname, 'database.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema creation
    console.log('Creating database tables...');
    await pool.query(schema);

    console.log('Database tables created successfully!');

    // Create a test admin user
    console.log('Creating test users...');
    const testUserResult = await pool.query(`
      INSERT INTO users (email, email_verified)
      VALUES 
        ('test@columbia.edu', true),
        ('admin@columbia.edu', true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email;
    `);

    if (testUserResult.rowCount > 0) {
      console.log('Test users created:', testUserResult.rows.map(row => row.email).join(', '));
    } else {
      console.log('Test users already exist');
    }

    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

// Run the initialization
initializeDatabase(); 