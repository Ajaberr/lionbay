#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Create database connection pool
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
        
        // Try to get the full table structure for debugging
        const tableStructure = await pool.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'messages'
          ORDER BY ordinal_position
        `);
        
        console.log('Current messages table structure:');
        tableStructure.rows.forEach(row => {
          console.log(`  - ${row.column_name} (${row.data_type})`);
        });
        
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

async function restartServer() {
  console.log('Attempting to restart server...');
  
  // Get the path to the server.js file
  const serverPath = path.join(__dirname, 'server', 'server.js');
  
  // Spawn a new process to run the server
  const serverProcess = spawn('node', [serverPath], {
    detached: true,
    stdio: 'inherit'
  });
  
  // Unref the child process so parent can exit independently
  serverProcess.unref();
  
  console.log(`Server restarted with PID: ${serverProcess.pid}`);
  return { success: true, pid: serverProcess.pid };
}

// Run the update function
async function main() {
  try {
    const updateResult = await updateMessagesTable();
    console.log('Update process completed:', updateResult);
    
    if (updateResult.success) {
      // Wait a moment before restarting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const restartResult = await restartServer();
      console.log('Server restart completed:', restartResult);
    } else {
      console.error('Database update failed, not restarting server.');
    }
  } catch (error) {
    console.error('Process failed:', error);
  }
}

main(); 