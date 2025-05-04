// Script to update the messages table structure
const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool with the same settings as in server.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  }
});

async function updateMessagesTable() {
  try {
    console.log('Connecting to database...');
    
    // Check if the message column exists
    const checkColumnResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'message'
    `);
    
    if (checkColumnResult.rows.length === 0) {
      console.log("Column 'message' does not exist, checking if 'content' exists...");
      
      // Check if content column already exists
      const checkContentResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'content'
      `);
      
      if (checkContentResult.rows.length > 0) {
        console.log("Column 'content' already exists. No changes needed.");
        return { success: true, message: "Table is already updated" };
      } else {
        console.error("Neither 'message' nor 'content' column found. The messages table structure might be corrupted.");
        return { success: false, message: "Table structure issue detected" };
      }
    }
    
    console.log("Column 'message' exists. Renaming to 'content'...");
    
    // Rename the column
    await pool.query(`ALTER TABLE messages RENAME COLUMN message TO content`);
    
    console.log("Column successfully renamed from 'message' to 'content'");
    return { success: true, message: "Column renamed successfully" };
  } catch (error) {
    console.error('Error updating messages table:', error);
    return { success: false, error: error.message };
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the update function
updateMessagesTable()
  .then(result => {
    console.log('Update process completed:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Update process failed:', error);
    process.exit(1);
  }); 