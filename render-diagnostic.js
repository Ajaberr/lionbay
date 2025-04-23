// This file can be deployed to Render to diagnose database connection issues
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');

// Create Express app for diagnostics
const app = express();
app.use(cors());
app.use(express.json());

// Enable detailed environment info
const diagnosticInfo = {
  environment: process.env.NODE_ENV || 'development',
  platform: process.platform,
  nodeVersion: process.version,
  renderService: process.env.RENDER || 'Not a Render environment',
  timestamp: new Date().toISOString(),
  env: {}
};

// Collect relevant environment variables (masking sensitive info)
Object.keys(process.env)
  .filter(key => 
    key.includes('DATABASE') || 
    key.includes('RENDER') || 
    key.includes('PG') || 
    key.includes('PORT') || 
    key.includes('NODE')
  )
  .forEach(key => {
    const value = process.env[key];
    // Mask potential connection strings
    diagnosticInfo.env[key] = value && value.includes('://') 
      ? value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
      : value;
  });

// Check filesystem access
try {
  diagnosticInfo.cwd = process.cwd();
  diagnosticInfo.filesInRoot = fs.readdirSync('.').slice(0, 20); // Limit to first 20 files
  diagnosticInfo.filesystemAccess = true;
} catch (err) {
  diagnosticInfo.filesystemAccess = false;
  diagnosticInfo.filesystemError = err.message;
}

// Database connection helper
async function testDatabaseConnection() {
  const results = {
    success: false,
    connectionAttempted: false,
    error: null,
    tables: [],
    userCount: 0,
    databaseTime: null,
    connectionInfo: {},
    ranTests: false
  };
  
  // Get the database URL from environment
  const databaseUrl = process.env.RENDER_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    results.error = 'No database URL found in environment variables';
    return results;
  }
  
  // Create a database pool
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL
    },
    connectionTimeoutMillis: 10000
  });
  
  let client;
  try {
    results.connectionAttempted = true;
    client = await pool.connect();
    results.success = true;
    
    // Check database time
    const timeResult = await client.query('SELECT NOW() as time');
    results.databaseTime = timeResult.rows[0].time;
    
    // Connection information
    const connResult = await client.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_address,
        inet_server_port() as server_port
    `);
    results.connectionInfo = connResult.rows[0];
    
    // Get tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    results.tables = tablesResult.rows.map(row => row.table_name);
    
    // Count users if the table exists
    if (results.tables.includes('users')) {
      const countResult = await client.query('SELECT COUNT(*) as count FROM users');
      results.userCount = parseInt(countResult.rows[0].count);
    }
    
    results.ranTests = true;
  } catch (err) {
    results.success = false;
    results.error = {
      message: err.message,
      code: err.code,
      stack: err.stack
    };
  } finally {
    if (client) client.release();
    await pool.end();
  }
  
  return results;
}

// Create diagnostic endpoints
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Render Diagnostic Tool</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .btn { padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
          pre { background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; }
          .success { color: green; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>Render Diagnostic Tool</h1>
        <p>Use this tool to diagnose issues with your Render deployment, especially database connections.</p>
        
        <h2>Available Endpoints:</h2>
        <ul>
          <li><a href="/api/env">/api/env</a> - View environment information</li>
          <li><a href="/api/db-test">/api/db-test</a> - Test database connection</li>
          <li><a href="/api/full-report">/api/full-report</a> - Full diagnostic report</li>
        </ul>
        
        <h2>Quick Test:</h2>
        <button class="btn" onclick="testDb()">Test Database Connection</button>
        <div id="result"></div>
        
        <script>
          function testDb() {
            document.getElementById('result').innerHTML = '<p>Testing database connection...</p>';
            fetch('/api/db-test')
              .then(res => res.json())
              .then(data => {
                let html = '<h3>Database Test Results:</h3>';
                html += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                if (data.success) {
                  html += '<p class="success">✅ Connection successful!</p>';
                } else {
                  html += '<p class="error">❌ Connection failed: ' + (data.error?.message || 'Unknown error') + '</p>';
                }
                document.getElementById('result').innerHTML = html;
              })
              .catch(err => {
                document.getElementById('result').innerHTML = 
                  '<p class="error">Error running test: ' + err.message + '</p>';
              });
          }
        </script>
      </body>
    </html>
  `);
});

app.get('/api/env', (req, res) => {
  res.json(diagnosticInfo);
});

app.get('/api/db-test', async (req, res) => {
  try {
    const results = await testDatabaseConnection();
    res.json(results);
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: { message: err.message, stack: err.stack } 
    });
  }
});

app.get('/api/full-report', async (req, res) => {
  try {
    const dbResults = await testDatabaseConnection();
    
    const fullReport = {
      timestamp: new Date().toISOString(),
      environment: diagnosticInfo,
      database: dbResults
    };
    
    res.json(fullReport);
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: { message: err.message, stack: err.stack } 
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Diagnostic server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
}); 