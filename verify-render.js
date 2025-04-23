// Script to verify and fix database connections on Render
require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('=== RENDER ENVIRONMENT VERIFICATION ===');

// Check environment variables
console.log('\nChecking environment variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
console.log(`PORT: ${process.env.PORT || 'Not set'}`);

// Check for DATABASE_URL
if (process.env.DATABASE_URL) {
  const maskedURL = process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@');
  console.log(`DATABASE_URL: ${maskedURL}`);
} else {
  console.log('DATABASE_URL: Not set in environment');
  
  // Try to read from server/.env if DATABASE_URL is not set
  try {
    const serverEnvPath = path.join(__dirname, 'marketCU', 'server', '.env');
    
    if (fs.existsSync(serverEnvPath)) {
      console.log(`Found server/.env file at ${serverEnvPath}`);
      const envContent = fs.readFileSync(serverEnvPath, 'utf8');
      const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
      
      if (dbUrlMatch && dbUrlMatch[1]) {
        const envDbUrl = dbUrlMatch[1];
        const maskedEnvURL = envDbUrl.replace(/:[^:@]*@/, ':***@');
        console.log(`DATABASE_URL in server/.env: ${maskedEnvURL}`);
        
        // Set the environment variable for the current process
        process.env.DATABASE_URL = envDbUrl;
        console.log('Set DATABASE_URL from server/.env for this process');
      } else {
        console.log('DATABASE_URL not found in server/.env');
      }
    } else {
      console.log(`server/.env file not found at ${serverEnvPath}`);
    }
  } catch (error) {
    console.error('Error reading server/.env:', error);
  }
}

// Check for root-level .env file which is loaded by Render
const rootEnvPath = path.join(__dirname, '.env');
if (fs.existsSync(rootEnvPath)) {
  console.log(`\nFound root .env file at ${rootEnvPath}`);
  try {
    const rootEnvContent = fs.readFileSync(rootEnvPath, 'utf8');
    console.log('Content of root .env file:');
    console.log(rootEnvContent.replace(/DATABASE_URL=.*?(\r?\n|$)/g, 'DATABASE_URL=***$1'));
  } catch (error) {
    console.error('Error reading root .env file:', error);
  }
} else {
  console.log('\nNo root .env file found');
  
  // Create a root .env file if it doesn't exist
  if (process.env.DATABASE_URL) {
    try {
      console.log('Creating root .env file with DATABASE_URL');
      fs.writeFileSync(rootEnvPath, `DATABASE_URL=${process.env.DATABASE_URL}\n`);
      console.log('Root .env file created successfully');
    } catch (error) {
      console.error('Error creating root .env file:', error);
    }
  } else {
    console.log('Cannot create root .env file: DATABASE_URL not available');
  }
}

// Test database connection
console.log('\nTesting database connection:');
const { Pool } = require('pg');

async function testConnection() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set, cannot test connection');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL connection
    }
  });

  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');
    
    // Check for tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tablesResult = await client.query(tablesQuery);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found in the database');
      console.log('Running database initialization script...');
      
      // Run initialization logic - simplified version from init-database.js
      await runDatabaseInit(client);
    } else {
      console.log(`✅ Found ${tablesResult.rows.length} tables`);
      
      // Check product count
      const productCount = await client.query('SELECT COUNT(*) FROM products');
      console.log(`Products in database: ${productCount.rows[0].count}`);
      
      if (productCount.rows[0].count === '0') {
        console.log('No products found, running database initialization...');
        await runDatabaseInit(client);
      }
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Database connection error:', error);
  } finally {
    await pool.end();
  }
}

async function runDatabaseInit(client) {
  try {
    // Create extension if not exists
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_code TEXT,
        code_expires TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        seller_id UUID NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        details TEXT NOT NULL,
        price DECIMAL NOT NULL,
        condition TEXT NOT NULL,
        category TEXT NOT NULL,
        image_path TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Add sample users
    const usersResult = await client.query(`
      INSERT INTO users (email, email_verified)
      VALUES 
        ('test1@columbia.edu', true),
        ('test2@columbia.edu', true),
        ('admin@columbia.edu', true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id;
    `);
    
    if (usersResult.rows.length > 0) {
      console.log('Test users added');
      
      // Add sample products
      const categories = [
        "Laptops & Accessories", 
        "Textbooks", 
        "Furniture"
      ];
      
      for (let i = 0; i < categories.length; i++) {
        const sellerId = usersResult.rows[i % usersResult.rows.length].id;
        
        await client.query(`
          INSERT INTO products (name, details, price, condition, category, seller_id, image_path)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          `Sample ${categories[i]}`,
          `This is a sample product in the ${categories[i]} category.`,
          (i + 1) * 50,
          i % 2 === 0 ? 'New' : 'Used',
          categories[i],
          sellerId,
          `https://picsum.photos/seed/${i}/300/200`
        ]);
      }
      console.log('Sample products added');
    }
  } catch (error) {
    console.error('Error in database initialization:', error);
  }
}

testConnection(); 