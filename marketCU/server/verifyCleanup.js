require('dotenv').config();
const { Pool } = require('pg');

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  }
});

async function verifyCleanup() {
  try {
    console.log('Verifying database cleanup...');
    
    // Check messages table
    const messagesResult = await pool.query('SELECT COUNT(*) FROM messages');
    const messagesCount = parseInt(messagesResult.rows[0].count);
    console.log(`Messages remaining: ${messagesCount}`);
    
    // Check chats table
    const chatsResult = await pool.query('SELECT COUNT(*) FROM chats');
    const chatsCount = parseInt(chatsResult.rows[0].count);
    console.log(`Chats remaining: ${chatsCount}`);
    
    // Check cart_items table
    const cartResult = await pool.query('SELECT COUNT(*) FROM cart_items');
    const cartCount = parseInt(cartResult.rows[0].count);
    console.log(`Cart items remaining: ${cartCount}`);
    
    // All counts should be zero if the cleanup was successful
    if (messagesCount === 0 && chatsCount === 0 && cartCount === 0) {
      console.log('✅ Cleanup successful! All data has been removed.');
    } else {
      console.log('⚠️ There might be some data remaining. Please check the counts above.');
    }
    
  } catch (error) {
    console.error('Error verifying cleanup:', error);
  } finally {
    await pool.end();
  }
}

verifyCleanup(); 