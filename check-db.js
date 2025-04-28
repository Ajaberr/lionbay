// Script to test database connection
require('dotenv').config();
const { Pool } = require('pg');

console.log('Checking DB connection');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'Not found');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully:', res.rows[0]);
  }
  pool.end();
}); 