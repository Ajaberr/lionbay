import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server/.env file
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

// Connect to database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkUsers() {
  try {
    // Get all users
    console.log("Checking users in database...");
    const result = await pool.query(`
      SELECT id, email, email_verified
      FROM users
      ORDER BY email
    `);
    
    console.log(`Found ${result.rows.length} users:`);
    result.rows.forEach(user => {
      console.log(`- ${user.email} (verified: ${user.email_verified})`);
    });
    
  } catch (error) {
    console.error("Error checking users:", error);
  } finally {
    pool.end();
  }
}

checkUsers(); 