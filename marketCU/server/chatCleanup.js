const { Pool } = require('pg');

// Initialize PostgreSQL pool for connection management
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  }
});

/**
 * Cleans up inactive chats and their associated messages
 * A chat is considered inactive if:
 * 1. It has no messages, or
 * 2. Its last message is older than the threshold (7 days)
 */
async function cleanupInactiveChats() {
  const INACTIVE_THRESHOLD_DAYS = 7;
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Find inactive chats
    const inactiveChatsResult = await pool.query(`
      SELECT c.id
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      GROUP BY c.id
      HAVING (
        COUNT(m.id) = 0 OR
        MAX(m.created_at) < NOW() - INTERVAL '${INACTIVE_THRESHOLD_DAYS} days'
      )
    `);
    
    const inactiveChatIds = inactiveChatsResult.rows.map(row => row.id);
    
    if (inactiveChatIds.length === 0) {
      await pool.query('COMMIT');
      return {
        chatsDeleted: 0,
        messagesDeleted: 0
      };
    }
    
    // Count messages that will be deleted
    const messageCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE chat_id = ANY($1)',
      [inactiveChatIds]
    );
    const messagesDeleted = parseInt(messageCountResult.rows[0].count);
    
    // Delete messages from inactive chats
    await pool.query(
      'DELETE FROM messages WHERE chat_id = ANY($1)',
      [inactiveChatIds]
    );
    
    // Delete the inactive chats
    await pool.query(
      'DELETE FROM chats WHERE id = ANY($1)',
      [inactiveChatIds]
    );
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log(`Cleanup complete: Deleted ${inactiveChatIds.length} chats and ${messagesDeleted} messages`);
    
    return {
      chatsDeleted: inactiveChatIds.length,
      messagesDeleted
    };
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Error in cleanupInactiveChats:', error);
    throw error;
  }
}

module.exports = {
  cleanupInactiveChats
}; 