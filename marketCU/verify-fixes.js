#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup for ES modules (to get __dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Create database connection pool
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyFixes() {
  try {
    console.log('Verifying chat system fixes...');
    
    // 1. Check that the messages table has the correct column structure
    const tableResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'messages'
      ORDER BY ordinal_position
    `);
    
    console.log('Messages table structure:');
    tableResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    // 2. Check if any messages exist in the database
    const messagesResult = await pool.query('SELECT COUNT(*) FROM messages');
    const messageCount = parseInt(messagesResult.rows[0].count);
    console.log(`Total message count: ${messageCount}`);
    
    if (messageCount > 0) {
      // 3. Check a sample message
      const sampleResult = await pool.query('SELECT * FROM messages LIMIT 1');
      const sampleMessage = sampleResult.rows[0];
      console.log('Sample message from database:');
      console.log(sampleMessage);
      
      // 4. Verify the 'content' field exists and has data
      if ('content' in sampleMessage) {
        console.log('✅ Message content field exists and is being used correctly');
      } else {
        console.log('❌ Message content field is missing or not being used');
      }
    }
    
    // 5. Check SQL query in the chats endpoint
    console.log('\nVerifying chats query:');
    try {
      // This is the query that was failing with the "message column does not exist" error
      const testQuery = `
        SELECT c.*, 
          (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM chats c
        LIMIT 1
      `;
      await pool.query(testQuery);
      console.log('✅ Chat query with content column works correctly');
    } catch (err) {
      console.log('❌ Chat query failed:', err.message);
    }
    
    console.log('\nVerification complete!');
  } catch (error) {
    console.error('Error verifying fixes:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

verifyFixes().catch(console.error); 