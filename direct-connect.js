// Direct connection test script
// This script tests both form URL and internal URL formats with extensive error logging
require('dotenv').config();
const { Pool } = require('pg');

async function testDatabaseConnections() {
  console.log('=== DIRECT DATABASE CONNECTION TESTS ===');
  console.log(`Running at: ${new Date().toISOString()}`);
  console.log(`Current directory: ${process.cwd()}`);
  
  // Define the URLs we want to test
  const databaseUrls = [
    // Original from .env file (if exists)
    process.env.DATABASE_URL,
    
    // Test with explicit region component
    process.env.DATABASE_URL?.includes('dpg-') && !process.env.DATABASE_URL?.includes('.oregon-postgres') ? 
      process.env.DATABASE_URL.replace(/(@dpg-[^\/]+)\//, '$1.oregon-postgres.render.com/') : null,
    
    // Test with alternative host format
    process.env.DATABASE_URL?.includes('.oregon-postgres.render.com') ?
      process.env.DATABASE_URL.replace('.oregon-postgres.render.com', '-a.oregon-postgres.render.com') : null,
    
    // Hardcoded internal URL format (replace with your actual credentials)
    "postgresql://cump_db_user:2x5LNUrbJwC1rrA4MPmVMkrk8fjZU9QW@dpg-cvdo1ulumphs73bjbp8g-a/cump_db",
    
    // Hardcoded internal URL with region
    "postgresql://cump_db_user:2x5LNUrbJwC1rrA4MPmVMkrk8fjZU9QW@dpg-cvdo1ulumphs73bjbp8g-a.oregon-postgres.render.com/cump_db",
    
    // Alternative format with -a
    "postgresql://cump_db_user:2x5LNUrbJwC1rrA4MPmVMkrk8fjZU9QW@dpg-cvdo1ulumphs73bjbp8g-a.oregon-postgres.render.com/cump_db".replace('.oregon-postgres.render.com', '-a.oregon-postgres.render.com')
  ].filter(Boolean); // Remove any null entries
  
  // Remove duplicates
  const uniqueUrls = [...new Set(databaseUrls)];
  
  console.log(`Testing ${uniqueUrls.length} different connection strings...`);
  
  // Try each URL
  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    const maskedUrl = url.replace(/:[^:@]*@/, ':***@');
    
    console.log(`\n[Test ${i+1}] Attempting connection with: ${maskedUrl}`);
    
    // Create a new pool for each test
    const pool = new Pool({
      connectionString: url,
      ssl: {
        rejectUnauthorized: false
      },
      // Set shorter timeouts for testing
      connectionTimeoutMillis: 10000,
      query_timeout: 10000
    });
    
    try {
      console.log(`  Connecting...`);
      const client = await pool.connect();
      console.log(`  ✅ CONNECTION SUCCESSFUL`);
      
      // Test a simple query
      try {
        console.log(`  Running test query...`);
        const result = await client.query('SELECT NOW() as time');
        console.log(`  ✅ Query successful: ${result.rows[0].time}`);
        
        // Check if tables exist
        const tablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        
        console.log(`  Found ${tablesResult.rows.length} tables`);
        
        // Check products count if table exists
        if (tablesResult.rows.some(row => row.table_name === 'products')) {
          const productsResult = await client.query('SELECT COUNT(*) FROM products');
          console.log(`  Products table has ${productsResult.rows[0].count} rows`);
        }
      } catch (queryError) {
        console.error(`  ❌ Query error: ${queryError.message}`);
        if (queryError.code) {
          console.error(`  Error code: ${queryError.code}`);
        }
      }
      
      client.release();
      console.log(`  Connection released`);
      
      // This is a working URL - we should update environment variables
      console.log(`  This connection string works! Consider using this in your environment config.`);
      
      // Write to a file for reference
      const fs = require('fs');
      fs.appendFileSync('working-db-urls.txt', `${maskedUrl}\n`);
      
    } catch (error) {
      console.error(`  ❌ CONNECTION FAILED: ${error.message}`);
      if (error.code) {
        console.error(`  Error code: ${error.code}`);
      }
      
      // Log more details about specific error types
      if (error.message.includes('no pg_hba.conf entry')) {
        console.error(`  This error indicates an authentication issue - the server rejected the connection. 
  Check your username/password and that your IP is allowed to connect.`);
      } else if (error.message.includes('password authentication failed')) {
        console.error(`  This error indicates incorrect password credentials. 
  Double-check your password in the connection string.`);
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error(`  This error indicates the host cannot be found. 
  Check the hostname portion of your connection string.`);
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        console.error(`  This error indicates a connection timeout. 
  The server might be unreachable or blocked by a firewall.`);
      }
    } finally {
      // End the pool
      try {
        await pool.end();
        console.log(`  Pool ended`);
      } catch (endError) {
        console.error(`  Error ending pool: ${endError.message}`);
      }
    }
  }
  
  console.log('\nAll connection tests completed');
}

testDatabaseConnections().catch(error => {
  console.error('Unhandled error:', error);
}); 