// Script to add is_read column to messages table
require('dotenv').config();
const { Pool } = require('pg');

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addColumn() {
  try {
    console.log('Connecting to database...');
    console.log('Executing SQL: ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE');
    
    const result = await pool.query(
      'ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE'
    );
    
    console.log('Column added successfully!');
    console.log('Result:', result);
    return true;
  } catch (error) {
    console.error('Error adding column:', error);
    return false;
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the function
addColumn().then(success => {
  console.log('Operation completed with success =', success);
}); 