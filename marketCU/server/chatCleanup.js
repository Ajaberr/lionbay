// chatCleanup.js - Handles automatic cleanup of inactive chats
const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: false });

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Removes chats and their associated messages that have been inactive for more than 7 days
 */
const cleanupInactiveChats = async () => {
  console.log('[Chat Cleanup] Starting cleanup of inactive chats');
  
  try {
    // Begin a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Find chat IDs that have had no activity in the last 7 days
      const inactiveChatsResult = await client.query(`
        SELECT c.id 
        FROM chats c
        LEFT JOIN (
          SELECT chat_id, MAX(created_at) as last_activity
          FROM messages
          GROUP BY chat_id
        ) m ON c.id = m.chat_id
        WHERE 
          (m.last_activity IS NULL AND c.created_at < NOW() - INTERVAL '7 days')
          OR 
          (m.last_activity < NOW() - INTERVAL '7 days')
      `);
      
      const inactiveChatIds = inactiveChatsResult.rows.map(row => row.id);
      
      if (inactiveChatIds.length === 0) {
        console.log('[Chat Cleanup] No inactive chats found');
        await client.query('COMMIT');
        return { 
          success: true, 
          message: 'No inactive chats found', 
          chatsRemoved: 0 
        };
      }
      
      console.log(`[Chat Cleanup] Found ${inactiveChatIds.length} inactive chats to remove`);
      
      // Delete messages from these chats first (due to foreign key constraints)
      const messagesDeleteResult = await client.query(`
        DELETE FROM messages 
        WHERE chat_id IN (${inactiveChatIds.map((_, i) => '$' + (i + 1)).join(',')})
        RETURNING id
      `, inactiveChatIds);
      
      const messagesRemoved = messagesDeleteResult.rowCount;
      
      // Now delete the chats
      const chatsDeleteResult = await client.query(`
        DELETE FROM chats 
        WHERE id IN (${inactiveChatIds.map((_, i) => '$' + (i + 1)).join(',')})
        RETURNING id
      `, inactiveChatIds);
      
      const chatsRemoved = chatsDeleteResult.rowCount;
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log(`[Chat Cleanup] Successfully removed ${chatsRemoved} chats and ${messagesRemoved} messages`);
      
      return { 
        success: true, 
        message: `Successfully removed ${chatsRemoved} inactive chats and ${messagesRemoved} messages`, 
        chatsRemoved, 
        messagesRemoved 
      };
    } catch (err) {
      // Roll back the transaction in case of error
      await client.query('ROLLBACK');
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('[Chat Cleanup] Error cleaning up inactive chats:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Export the cleanup function
module.exports = { cleanupInactiveChats };

// If this script is run directly (node chatCleanup.js), execute the cleanup
if (require.main === module) {
  cleanupInactiveChats()
    .then(result => {
      console.log('Cleanup result:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
} 