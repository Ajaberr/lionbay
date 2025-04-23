// Simple script to check database connectivity and tables
require('dotenv').config();
const { Pool } = require('pg');

async function checkDatabase() {
  // Get DATABASE_URL from environment or from server/.env
  let connectionString;
  try {
    // Try to read from server/.env if DATABASE_URL is not set in environment
    if (!process.env.DATABASE_URL) {
      console.log('DATABASE_URL not found in environment, checking server/.env...');
      const fs = require('fs');
      const path = require('path');
      const serverEnvPath = path.join(__dirname, 'marketCU', 'server', '.env');
      
      if (fs.existsSync(serverEnvPath)) {
        const envContent = fs.readFileSync(serverEnvPath, 'utf8');
        const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
        if (dbUrlMatch && dbUrlMatch[1]) {
          connectionString = dbUrlMatch[1];
          console.log('Found DATABASE_URL in server/.env');
        }
      }
    } else {
      connectionString = process.env.DATABASE_URL;
    }
  } catch (error) {
    console.error('Error reading environment:', error);
  }

  if (!connectionString) {
    console.error('DATABASE_URL not found in environment or server/.env');
    return;
  }

  // Mask sensitive information when displaying
  const maskedURL = connectionString.replace(/:[^:@]*@/, ':***@');
  console.log(`Using DATABASE_URL: ${maskedURL}`);

  // Initialize PostgreSQL pool
  const pool = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL connection
    }
  });

  try {
    console.log('=== DATABASE DIAGNOSTIC TOOL ===');
    console.log('Checking PostgreSQL connection...');
    
    // Test basic connection
    const clientConn = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');
    clientConn.release();
    
    // Check if tables exist
    console.log('\nChecking database tables:');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tablesResult = await pool.query(tablesQuery);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found in the database');
    } else {
      console.log(`✅ Found ${tablesResult.rows.length} tables:`);
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }
    
    // Check data in each table
    if (tablesResult.rows.length > 0) {
      console.log('\nChecking data in each table:');
      
      for (const row of tablesResult.rows) {
        const tableName = row.table_name;
        const countQuery = `SELECT COUNT(*) FROM ${tableName}`;
        const countResult = await pool.query(countQuery);
        const count = parseInt(countResult.rows[0].count);
        
        if (count === 0) {
          console.log(`❌ Table '${tableName}' is empty (0 rows)`);
        } else {
          console.log(`✅ Table '${tableName}' has ${count} rows`);
          
          // Get a sample row for diagnosis
          const sampleQuery = `SELECT * FROM ${tableName} LIMIT 1`;
          const sampleResult = await pool.query(sampleQuery);
          console.log(`   Sample row: ${JSON.stringify(sampleResult.rows[0])}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('   This appears to be a hostname resolution issue');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Connection was refused. The database server might be down or the port might be wrong');
    } else if (error.code === '28P01') {
      console.error('   Authentication failed. Check your username and password');
    } else if (error.code === '3D000') {
      console.error('   Database does not exist');
    }
  } finally {
    await pool.end();
    console.log('\nDatabase check complete');
  }
}

checkDatabase(); 