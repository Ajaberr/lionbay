require('dotenv').config();
const { Pool } = require('pg');

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  }
});

async function clearData() {
  try {
    console.log('Starting data cleanup...');
    
    // Begin a transaction
    await pool.query('BEGIN');
    
    try {
      // 1. First count and then delete all messages (they depend on chats)
      console.log('Counting messages...');
      const messagesCountResult = await pool.query('SELECT COUNT(*) FROM messages');
      const messagesCount = parseInt(messagesCountResult.rows[0].count);
      
      console.log(`Deleting ${messagesCount} messages...`);
      await pool.query('DELETE FROM messages');
      
      // 2. Update cart_items to remove chat_id references
      console.log('Removing chat references from cart items...');
      await pool.query('UPDATE cart_items SET chat_id = NULL WHERE chat_id IS NOT NULL');
      
      // 3. Count and delete all chats
      console.log('Counting chats...');
      const chatsCountResult = await pool.query('SELECT COUNT(*) FROM chats');
      const chatsCount = parseInt(chatsCountResult.rows[0].count);
      
      console.log(`Deleting ${chatsCount} chats...`);
      await pool.query('DELETE FROM chats');
      
      // 4. Count and delete all cart items
      console.log('Counting cart items...');
      const cartCountResult = await pool.query('SELECT COUNT(*) FROM cart_items');
      const cartCount = parseInt(cartCountResult.rows[0].count);
      
      console.log(`Deleting ${cartCount} cart items...`);
      await pool.query('DELETE FROM cart_items');
      
      // Commit the transaction
      await pool.query('COMMIT');
      console.log('All data cleared successfully!');
      console.log(`Summary: Deleted ${messagesCount} messages, ${chatsCount} chats, and ${cartCount} cart items.`);
      
    } catch (error) {
      // If there's an error, roll back the transaction
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    await pool.end();
  }
}

clearData(); 