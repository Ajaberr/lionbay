// Script to set up the database with tables and initial data
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  // Initialize PostgreSQL pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL connection
    }
  });

  try {
    console.log('=== DATABASE SETUP TOOL ===');
    console.log('Connecting to PostgreSQL...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');
    
    // Read the database schema from the SQL file
    console.log('\nReading database schema...');
    const schemaPath = path.join(__dirname, 'marketCU', 'server', 'database.sql');
    let schemaSql;
    
    try {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
      console.log('✅ Schema file read successfully');
    } catch (err) {
      console.error(`❌ Could not read schema file at ${schemaPath}`);
      console.error('   Attempting to use hardcoded schema');
      
      // Fallback to hardcoded schema if file not found
      schemaSql = `
        -- Create users table
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          email_verified BOOLEAN DEFAULT FALSE,
          verification_code TEXT,
          code_expires TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create products table
        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id UUID NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          details TEXT NOT NULL,
          price DECIMAL NOT NULL,
          condition TEXT NOT NULL,
          category TEXT NOT NULL,
          image_path TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create chats table
        CREATE TABLE IF NOT EXISTS chats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id UUID NOT NULL REFERENCES products(id),
          buyer_id UUID NOT NULL REFERENCES users(id),
          seller_id UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create messages table
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          chat_id UUID NOT NULL REFERENCES chats(id),
          sender_id UUID NOT NULL REFERENCES users(id),
          message TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create cart_items table for the shopping cart
        CREATE TABLE IF NOT EXISTS cart_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id),
          product_id UUID NOT NULL REFERENCES products(id),
          cart_type TEXT NOT NULL CHECK (cart_type IN ('CONTACTED', 'CART_ONLY')),
          added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          chat_id UUID REFERENCES chats(id),
          UNIQUE(user_id, product_id)
        );

        -- Create help_messages table for user-admin communication
        CREATE TABLE IF NOT EXISTS help_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id),
          to_user_id UUID REFERENCES users(id),
          message TEXT NOT NULL,
          is_from_admin BOOLEAN DEFAULT FALSE,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
    }
    
    // Create the tables
    console.log('\nCreating tables...');
    await client.query(schemaSql);
    console.log('✅ Tables created successfully');
    
    // Add sample data
    console.log('\nAdding sample data...');
    
    // Define product categories for consistency
    const PRODUCT_CATEGORIES = [
      "Laptops & Accessories",
      "Textbooks & Study Guides",
      "Dorm & Apartment Essentials",
      "Bicycles & Scooters",
      "Electronics & Gadgets",
      "Furniture & Storage",
      "Clothing & Fashion",
      "School Supplies"
    ];
    
    // Create test users
    console.log('Creating test users...');
    const usersResult = await client.query(`
      INSERT INTO users (email, email_verified)
      VALUES 
        ('test1@columbia.edu', true),
        ('test2@columbia.edu', true),
        ('aaa2485@columbia.edu', true),
        ('amj2234@columbia.edu', true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email;
    `);
    
    if (usersResult.rows.length > 0) {
      console.log(`✅ Created or found ${usersResult.rows.length} test users`);
      
      // Create sample products if we have users
      console.log('Creating sample products...');
      for (let i = 0; i < PRODUCT_CATEGORIES.length; i++) {
        const category = PRODUCT_CATEGORIES[i];
        const sellerId = usersResult.rows[i % usersResult.rows.length].id;
        
        await client.query(`
          INSERT INTO products (name, details, price, condition, category, seller_id, image_path)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          `Sample ${category}`,
          `This is a sample product in the ${category} category.`,
          50 + i * 25,
          i % 2 === 0 ? 'New' : 'Good condition',
          category,
          sellerId,
          `https://picsum.photos/id/${(i + 1) * 10}/300/200`
        ]);
      }
      console.log(`✅ Created sample products`);
    } else {
      console.log('⚠️ No new users were created, probably because they already exist');
    }
    
    // Check results
    const countUsers = await client.query('SELECT COUNT(*) FROM users');
    const countProducts = await client.query('SELECT COUNT(*) FROM products');
    
    console.log('\nDatabase setup summary:');
    console.log(`✅ Users: ${countUsers.rows[0].count}`);
    console.log(`✅ Products: ${countProducts.rows[0].count}`);
    
    client.release();
  } catch (error) {
    console.error('❌ Database setup error:', error);
  } finally {
    await pool.end();
    console.log('\nDatabase setup complete');
  }
}

setupDatabase(); 