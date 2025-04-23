// Simple script to initialize the database on Render
console.log('Starting database initialization...');
require('dotenv').config();
const { Pool } = require('pg');

const initDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connected to database');

    // Create required tables if they don't exist
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

    console.log('Tables created');

    // Check if any users exist
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM users');
    
    if (rows[0].count === '0') {
      console.log('No users found, adding test users');
      
      // Add test users
      await pool.query(`
        INSERT INTO users (email, email_verified)
        VALUES 
          ('test1@columbia.edu', true),
          ('test2@columbia.edu', true),
          ('admin@columbia.edu', true)
      `);

      console.log('Test users added');
      
      // Get the user IDs to reference in products
      const userIds = await pool.query('SELECT id FROM users LIMIT 2');
      
      if (userIds.rows.length > 0) {
        // Add sample products
        const categories = [
          "Laptops & Accessories", 
          "Textbooks", 
          "Furniture"
        ];
        
        for (let i = 0; i < categories.length; i++) {
          const sellerId = userIds.rows[i % userIds.rows.length].id;
          
          await pool.query(`
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
    } else {
      console.log(`Database already has ${rows[0].count} users, skipping initialization`);
    }

    console.log('Database initialization complete');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await pool.end();
  }
};

initDatabase(); 