require('dotenv').config();
const { Pool } = require('pg');

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  }
});

async function createCartTable() {
  try {
    console.log('Creating cart_items table...');
    
    // Create the cart_items table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        product_id UUID NOT NULL REFERENCES products(id),
        cart_type TEXT NOT NULL CHECK (cart_type IN ('CONTACTED', 'CART_ONLY')),
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        chat_id UUID REFERENCES chats(id),
        UNIQUE(user_id, product_id)
      );
    `);
    
    console.log('cart_items table created successfully!');
  } catch (error) {
    console.error('Error creating cart_items table:', error);
  } finally {
    await pool.end();
  }
}

createCartTable(); 