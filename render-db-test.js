require('dotenv').config();
const { Pool } = require('pg');

// Set this to simulate Render environment for testing
process.env.IS_RENDER = process.env.IS_RENDER || 'true';

// Database connection string - check for Render's environment variable first
const databaseUrl = process.env.RENDER_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: Neither RENDER_DATABASE_URL nor DATABASE_URL environment variables are set.');
  process.exit(1);
}

// Create a masked version of the URL for logging (hide password)
const maskedUrl = databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
console.log(`Attempting to connect to database: ${maskedUrl}`);

// Parse the connection string to debug host/port issues
try {
  const regex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):?(\d*)\/(.+)$/;
  const match = databaseUrl.match(regex);
  
  if (match) {
    const [, user, pass, host, port, dbname] = match;
    console.log(`Parsed connection details:
      Host: ${host}
      Port: ${port || '5432 (default)'}
      Database: ${dbname}
      User: ${user}
      Running on Render: ${process.env.IS_RENDER === 'true' ? 'Yes' : 'No'}
    `);
  } else {
    console.log('Could not parse connection string, using it as-is');
  }
} catch (err) {
  console.error('Error parsing connection string:', err.message);
}

// Get all environment variables (useful for debugging)
console.log('\nEnvironment variables:');
Object.keys(process.env)
  .filter(key => key.includes('DATABASE') || key.includes('RENDER') || key.includes('PG'))
  .forEach(key => {
    // Mask sensitive values
    const value = process.env[key];
    const maskedValue = value && value.includes('://') 
      ? value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
      : value;
    console.log(`${key}: ${maskedValue}`);
  });

// Configure the pool
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  },
  // Add connection timeout - default is too long
  connectionTimeoutMillis: 10000,
  // Set pool idle timeout
  idleTimeoutMillis: 30000
});

// Listen for connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function testConnection() {
  console.log('\n--- Starting connection test ---');
  
  let client;
  try {
    console.log('Attempting to acquire client from pool...');
    client = await pool.connect();
    console.log('✅ Successfully acquired client from pool');
    
    console.log('Executing test query...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database query successful');
    console.log('Database time:', result.rows[0].current_time);
    
    // Check for connection info
    console.log('\nConnection information:');
    const connResult = await client.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_address,
        inet_server_port() as server_port
    `);
    
    console.log(connResult.rows[0]);
    
    // Check if tables exist
    console.log('\nChecking for tables...');
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tableResult.rows.length === 0) {
      console.log('⚠️ No tables found in database');
    } else {
      console.log('Tables found in database:');
      tableResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
      
      // Check if users table has records
      const userCountResult = await client.query('SELECT COUNT(*) as count FROM users');
      console.log(`\nUsers table record count: ${userCountResult.rows[0].count}`);
    }
    
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    
    // More detailed error info based on error codes
    if (err.code === 'ENOTFOUND') {
      console.error('   Host not found. Check if the database hostname is correct.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('   Connection refused. Check if the database server is running and if the port is correct.');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('   Connection timed out. Check network settings, firewall rules, or VPN.');
    } else if (err.code === '28P01') {
      console.error('   Authentication failed. Check username and password.');
    } else if (err.code === '3D000') {
      console.error('   Database not found. Check if the database name is correct.');
    } else if (err.code === '42P01') {
      console.error('   Relation does not exist. Tables might not be created yet.');
    }
    
    console.error('Full error:', err);
    return false;
  } finally {
    if (client) {
      console.log('Releasing client back to pool');
      client.release();
    }
    await pool.end();
    console.log('Pool has been closed');
  }
}

console.log('=== Database Connection Test ===');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Running on Render:', process.env.IS_RENDER === 'true' ? 'Yes' : 'No');
console.log('===================================');

testConnection()
  .then(success => {
    if (success) {
      console.log('✅ CONNECTION TEST PASSED: Database is accessible');
      process.exit(0);
    } else {
      console.log('❌ CONNECTION TEST FAILED: Could not connect to database');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
    process.exit(1);
  }); 