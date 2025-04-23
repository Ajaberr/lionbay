// Comprehensive troubleshooting script for Render deployment
require('dotenv').config();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

console.log('=== RENDER DEPLOYMENT TROUBLESHOOTER ===');
console.log(`Running at: ${new Date().toISOString()}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);

// 1. Check environment variables
console.log('\n=== ENVIRONMENT VARIABLES ===');
const criticalVars = [
  'DATABASE_URL', 
  'EMAIL_USER', 
  'EMAIL_PASSWORD', 
  'JWT_SECRET',
  'NODE_ENV',
  'PORT'
];

criticalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Mask sensitive values
    if (varName === 'DATABASE_URL') {
      console.log(`${varName}: ${value.replace(/:[^:@]*@/, ':***@')}`);
    } else if (varName === 'EMAIL_PASSWORD' || varName === 'JWT_SECRET') {
      console.log(`${varName}: ${value ? '[Set]' : '[Not set]'}`);
    } else {
      console.log(`${varName}: ${value}`);
    }
  } else {
    console.log(`${varName}: [Not set] - MISSING CRITICAL VARIABLE`);
  }
});

// 2. Check .env files
console.log('\n=== CHECKING .ENV FILES ===');
const envLocations = [
  '.env',
  'marketCU/.env',
  'marketCU/server/.env',
  'server/.env'
];

envLocations.forEach(envPath => {
  try {
    if (fs.existsSync(envPath)) {
      console.log(`Found .env file at: ${envPath}`);
      const content = fs.readFileSync(envPath, 'utf8');
      
      // Display non-sensitive content
      const redactedContent = content
        .replace(/DATABASE_URL=.*(\r?\n|$)/g, 'DATABASE_URL=***$1')
        .replace(/EMAIL_PASSWORD=.*(\r?\n|$)/g, 'EMAIL_PASSWORD=***$1')
        .replace(/JWT_SECRET=.*(\r?\n|$)/g, 'JWT_SECRET=***$1');
      
      console.log(`Content of ${envPath}:\n${redactedContent}`);
    } else {
      console.log(`No .env file found at: ${envPath}`);
    }
  } catch (error) {
    console.error(`Error reading ${envPath}:`, error.message);
  }
});

// 3. Test database connection
console.log('\n=== DATABASE CONNECTION TEST ===');

async function testDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set, cannot test connection');
    return;
  }
  
  // Try with the standard URL
  let standardUrl = process.env.DATABASE_URL;
  
  // Fix URL if it doesn't have region component
  if (standardUrl.includes('dpg-') && !standardUrl.includes('.oregon-postgres.render.com')) {
    standardUrl = standardUrl.replace(/(@dpg-[^\/]+)\//, '$1.oregon-postgres.render.com/');
    console.log('Fixed DATABASE_URL to include region component:', 
      standardUrl.replace(/:[^:@]*@/, ':***@'));
  }
  
  try {
    console.log('Testing standard connection URL...');
    const pool = new Pool({
      connectionString: standardUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const client = await pool.connect();
    console.log('✅ Successfully connected to database with standard URL');
    
    // Check tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    console.log(`Found ${tables.rows.length} tables:`);
    tables.rows.forEach(row => console.log(`- ${row.table_name}`));
    
    // Check products count
    try {
      const products = await client.query('SELECT COUNT(*) FROM products');
      console.log(`Products in database: ${products.rows[0].count}`);
    } catch (err) {
      console.error('Error counting products:', err.message);
    }
    
    // Check users count
    try {
      const users = await client.query('SELECT COUNT(*) FROM users');
      console.log(`Users in database: ${users.rows[0].count}`);
    } catch (err) {
      console.error('Error counting users:', err.message);
    }
    
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ Failed to connect with standard URL:', error.message);
    
    // Try alternative URL format
    try {
      console.log('\nTrying alternative URL format...');
      const altUrl = standardUrl.replace('.oregon-postgres.render.com', '-a.oregon-postgres.render.com');
      
      const altPool = new Pool({
        connectionString: altUrl,
        ssl: {
          rejectUnauthorized: false
        }
      });
      
      const altClient = await altPool.connect();
      console.log('✅ Successfully connected to database with alternative URL');
      
      // Update the DATABASE_URL environment variable
      process.env.DATABASE_URL = altUrl;
      console.log('Updated environment variable with working URL');
      
      // Try to update root .env file
      try {
        if (fs.existsSync('.env')) {
          let envContent = fs.readFileSync('.env', 'utf8');
          if (envContent.includes('DATABASE_URL=')) {
            envContent = envContent.replace(
              /DATABASE_URL=.+?(\r?\n|$)/,
              `DATABASE_URL=${altUrl}$1`
            );
          } else {
            envContent += `\nDATABASE_URL=${altUrl}\n`;
          }
          fs.writeFileSync('.env', envContent);
          console.log('Updated .env file with working URL');
        }
      } catch (envError) {
        console.error('Error updating .env file:', envError.message);
      }
      
      altClient.release();
      await altPool.end();
      return true;
    } catch (altError) {
      console.error('❌ Failed to connect with alternative URL:', altError.message);
      return false;
    }
  }
}

// 4. Test email configuration
console.log('\n=== EMAIL CONFIGURATION TEST ===');

async function testEmail() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('EMAIL_USER or EMAIL_PASSWORD not set, cannot test email');
    return false;
  }
  
  // Test SMTP connection first
  console.log('Testing SMTP connection...');
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    debug: true
  });
  
  try {
    // Verify SMTP connection configuration
    const smtpCheck = await transporter.verify();
    console.log('✅ SMTP connection successful');
    
    // Try to send a test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"Lion Bay Troubleshooter" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to self for testing
      subject: 'Lion Bay Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1c4587;">Lion Bay Email Test</h1>
          <p>This is a test email sent at: ${new Date().toISOString()}</p>
          <p>If you can see this, your email configuration is working correctly!</p>
        </div>
      `
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    // Provide specific gmail troubleshooting if it's a gmail account
    if (process.env.EMAIL_USER.includes('@gmail.com')) {
      console.log('\nTroubleshooting Gmail App Password:');
      console.log('1. Make sure 2-Step Verification is enabled: https://myaccount.google.com/security');
      console.log('2. Generate a new App Password: https://myaccount.google.com/apppasswords');
      console.log('3. Update the EMAIL_PASSWORD in your Render environment variables');
      console.log('4. Make sure "Less secure app access" is turned OFF (it\'s deprecated)');
    }
    
    return false;
  }
}

// 5. Test network connectivity
console.log('\n=== NETWORK CONNECTIVITY TEST ===');

async function testNetwork() {
  const urls = [
    'https://www.google.com',
    'https://api.github.com',
    'https://www.postgresql.org',
    'https://api.render.com'
  ];
  
  for (const url of urls) {
    console.log(`Testing connectivity to ${url}...`);
    try {
      await new Promise((resolve, reject) => {
        const requester = url.startsWith('https') ? https : http;
        const req = requester.get(url, (res) => {
          console.log(`✅ Successfully connected to ${url} (Status: ${res.statusCode})`);
          resolve();
        });
        
        req.on('error', (error) => {
          console.error(`❌ Failed to connect to ${url}:`, error.message);
          reject(error);
        });
        
        req.end();
      });
    } catch (error) {
      // Error is logged in the promise rejection
    }
  }
}

// 6. Check database URL compatibility with Render
console.log('\n=== DATABASE URL FORMAT CHECK ===');

function checkDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set, cannot check format');
    return;
  }
  
  const url = process.env.DATABASE_URL;
  console.log('Checking DATABASE_URL format compatibility...');
  
  // Check if it has the required components
  if (!url.startsWith('postgresql://')) {
    console.error('❌ URL does not start with postgresql://');
  } else {
    console.log('✅ URL starts with postgresql://');
  }
  
  // Check if it includes username and password
  if (!url.includes('@')) {
    console.error('❌ URL is missing username/password (@)');
  } else {
    console.log('✅ URL contains username/password separator (@)');
  }
  
  // Check for Render specific hostname
  if (url.includes('dpg-')) {
    console.log('✅ URL appears to be a Render PostgreSQL URL (dpg-)');
    
    // Check for the region component
    if (!url.includes('.oregon-postgres.render.com') && 
        !url.includes('-a.oregon-postgres.render.com')) {
      console.log('⚠️ URL is missing region component (.oregon-postgres.render.com)');
      console.log('Recommended format: postgresql://user:password@dpg-XXXXX.oregon-postgres.render.com/dbname');
    } else {
      console.log('✅ URL contains region component');
    }
  } else {
    console.log('ℹ️ URL does not appear to be a Render-provided PostgreSQL URL');
  }
  
  // Check for database name
  if (!url.includes('/')) {
    console.error('❌ URL is missing database name component');
  } else {
    console.log('✅ URL contains database name component');
  }
}

// 7. Proposed Fixes
async function proposeFixes() {
  console.log('\n=== PROPOSED FIXES ===');
  
  // Check if we should update Render environment variables
  let needsRenderUpdate = false;
  let renderUpdateInstructions = [];
  
  // DATABASE_URL fix
  if (process.env.DATABASE_URL && 
      process.env.DATABASE_URL.includes('dpg-') && 
      !process.env.DATABASE_URL.includes('.oregon-postgres.render.com')) {
    const fixedUrl = process.env.DATABASE_URL.replace(
      /(@dpg-[^\/]+)\//, 
      '$1.oregon-postgres.render.com/'
    );
    renderUpdateInstructions.push(
      `DATABASE_URL: Update to include region component\n` +
      `Current (masked): ${process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@')}\n` +
      `Fixed (masked): ${fixedUrl.replace(/:[^:@]*@/, ':***@')}`
    );
    needsRenderUpdate = true;
  }
  
  // EMAIL_PASSWORD check
  if (!process.env.EMAIL_PASSWORD) {
    renderUpdateInstructions.push(
      'EMAIL_PASSWORD: Add this critical environment variable'
    );
    needsRenderUpdate = true;
  }
  
  // JWT_SECRET check
  if (!process.env.JWT_SECRET) {
    renderUpdateInstructions.push(
      'JWT_SECRET: Add this critical environment variable'
    );
    needsRenderUpdate = true;
  }
  
  if (needsRenderUpdate) {
    console.log('You need to update your Render environment variables:');
    renderUpdateInstructions.forEach((instruction, i) => {
      console.log(`${i+1}. ${instruction}`);
    });
    console.log('\nTo update environment variables in Render:');
    console.log('1. Go to your Render dashboard');
    console.log('2. Select your web service');
    console.log('3. Go to "Environment" tab');
    console.log('4. Add or update the variables with the values shown above');
    console.log('5. Click "Save Changes"');
    console.log('6. Redeploy your application');
  } else {
    console.log('No Render environment variable updates needed.');
  }
  
  // Generate a test .env file to use locally
  try {
    console.log('\nCreating test.env file with correct values for local testing...');
    let testEnvContent = '';
    
    if (process.env.DATABASE_URL) {
      // Use the corrected URL if needed
      let databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl.includes('dpg-') && !databaseUrl.includes('.oregon-postgres.render.com')) {
        databaseUrl = databaseUrl.replace(/(@dpg-[^\/]+)\//, '$1.oregon-postgres.render.com/');
      }
      testEnvContent += `DATABASE_URL=${databaseUrl}\n`;
    }
    
    if (process.env.JWT_SECRET) {
      testEnvContent += `JWT_SECRET=${process.env.JWT_SECRET}\n`;
    } else {
      const crypto = require('crypto');
      const randomSecret = crypto.randomBytes(32).toString('hex');
      testEnvContent += `JWT_SECRET=${randomSecret}\n`;
    }
    
    if (process.env.EMAIL_USER) {
      testEnvContent += `EMAIL_USER=${process.env.EMAIL_USER}\n`;
    }
    
    if (process.env.EMAIL_PASSWORD) {
      testEnvContent += `EMAIL_PASSWORD=${process.env.EMAIL_PASSWORD}\n`;
    }
    
    testEnvContent += `NODE_ENV=production\n`;
    testEnvContent += `PORT=3001\n`;
    testEnvContent += `SKIP_EMAIL_VERIFICATION=FALSE\n`;
    
    fs.writeFileSync('test.env', testEnvContent);
    console.log('Created test.env file. Use this for local testing with:');
    console.log('cp test.env .env');
  } catch (error) {
    console.error('Error creating test.env:', error.message);
  }
}

// Run all tests
async function runTests() {
  // Check database URL format
  checkDatabaseUrl();
  
  // Test database
  const dbSuccess = await testDatabase();
  
  // Test email
  const emailSuccess = await testEmail();
  
  // Test network
  await testNetwork();
  
  // Propose fixes
  await proposeFixes();
  
  // Summary
  console.log('\n=== TROUBLESHOOTING SUMMARY ===');
  console.log(`Database Connection: ${dbSuccess ? '✅ Working' : '❌ Failed'}`);
  console.log(`Email Configuration: ${emailSuccess ? '✅ Working' : '❌ Failed'}`);
  
  console.log('\nNext steps:');
  if (!dbSuccess) {
    console.log('- Fix your DATABASE_URL in Render environment variables');
    console.log('- Make sure your database is running and accessible');
  }
  
  if (!emailSuccess) {
    console.log('- Update your EMAIL_USER and EMAIL_PASSWORD in Render environment variables');
    console.log('- If using Gmail, create a new App Password in your Google Account settings');
  }
  
  if (dbSuccess && emailSuccess) {
    console.log('All critical systems appear to be working! If you still have issues:');
    console.log('- Check the server logs in Render for specific error messages');
    console.log('- Verify frontend is correctly calling your backend API endpoints');
    console.log('- Redeploy your application after making any environment variable changes');
  }
}

runTests(); 