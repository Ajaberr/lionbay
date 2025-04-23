// Simple test script for email and database connectivity
require('dotenv').config();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// Test database connection
async function testDb() {
  console.log('=== TESTING DATABASE CONNECTION ===');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set!');
    return false;
  }
  
  // Fix URL format if needed
  let dbUrl = process.env.DATABASE_URL;
  if (dbUrl.includes('dpg-') && !dbUrl.includes('.oregon-postgres.render.com')) {
    dbUrl = dbUrl.replace(/(@dpg-[^\/]+)\//, '$1.oregon-postgres.render.com/');
    console.log('Fixed DATABASE_URL to include region component');
  }
  
  console.log(`Using connection string: ${dbUrl.replace(/:[^:@]*@/, ':***@')}`);
  
  try {
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to database');
    
    // Check if products table exists and has data
    console.log('Checking products table...');
    try {
      const result = await client.query('SELECT COUNT(*) FROM products');
      console.log(`✅ Products table exists with ${result.rows[0].count} rows`);
    } catch (error) {
      console.error('❌ Error checking products table:', error.message);
    }
    
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
}

// Test email connectivity
async function testEmail() {
  console.log('\n=== TESTING EMAIL CONFIGURATION ===');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('EMAIL_USER or EMAIL_PASSWORD environment variables are not set!');
    return false;
  }
  
  console.log(`Using email account: ${process.env.EMAIL_USER}`);
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    // Verify connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successfully established');
    
    // Try to send a test email
    console.log('Attempting to send test email...');
    const info = await transporter.sendMail({
      from: `"Lion Bay Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to self
      subject: 'Lion Bay Email Test',
      html: '<h1>Email Test</h1><p>This is a test email from Lion Bay.</p>'
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\nTroubleshooting Gmail access:');
      console.log('1. Make sure 2-Step Verification is enabled on your Google account');
      console.log('2. Generate a new App Password at: https://myaccount.google.com/apppasswords');
      console.log('3. Update your EMAIL_PASSWORD environment variable with the new App Password');
      console.log('4. Check that "Less secure app access" is OFF (this feature is deprecated)');
    }
    
    return false;
  }
}

// Run tests
async function runTests() {
  const dbSuccess = await testDb();
  const emailSuccess = await testEmail();
  
  console.log('\n=== TEST RESULTS ===');
  console.log(`Database Connection: ${dbSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Email Configuration: ${emailSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\nFix instructions:');
  if (!dbSuccess) {
    console.log('1. Update the DATABASE_URL environment variable in your Render dashboard');
    console.log('   Make sure it includes the ".oregon-postgres.render.com" component');
    console.log('   Format: postgresql://username:password@dpg-xxxxx.oregon-postgres.render.com/dbname');
  }
  
  if (!emailSuccess) {
    console.log('1. Generate a new Gmail App Password');
    console.log('2. Update the EMAIL_PASSWORD environment variable in your Render dashboard');
    console.log('3. Make sure your Gmail account doesn\'t have additional security restrictions');
  }
}

// Start tests
runTests(); 