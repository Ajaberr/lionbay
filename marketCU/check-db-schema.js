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
    rejectUnauthorized: false // Required for some cloud database providers
  }
});

async function checkSchema() {
  try {
    // Get users table schema
    console.log("Checking users table schema...");
    const usersSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    console.log("Users table columns:");
    usersSchema.rows.forEach(column => {
      console.log(`${column.column_name} (${column.data_type})`);
    });
    
    // Check if products table exists
    console.log("\nChecking products table schema...");
    const productsSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    
    console.log("Products table columns:");
    productsSchema.rows.forEach(column => {
      console.log(`${column.column_name} (${column.data_type})`);
    });
    
  } catch (error) {
    console.error("Error checking schema:", error);
  } finally {
    pool.end();
  }
}

checkSchema(); 