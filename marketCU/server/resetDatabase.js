require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Define product categories for consistency
const PRODUCT_CATEGORIES = [
  "Laptops & Accessories",
  "Textbooks & Study Guides",
  "Dorm & Apartment Essentials",
  "Bicycles & Scooters",
  "Electronics & Gadgets",
  "Furniture & Storage",
  "Clothing & Fashion",
  "School Supplies"
];

async function resetDatabase() {
  // Initialize PostgreSQL client
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL connection
    }
  });

  try {
    console.log('Starting database reset...');

    // Delete all data from tables in reverse order of dependencies
    console.log('Deleting existing data...');
    
    try {
      // Messages table
      await pool.query('DELETE FROM messages');
      console.log('Messages deleted');
      
      // Chats table
      await pool.query('DELETE FROM chats');
      console.log('Chats deleted');
      
      // Products table
      await pool.query('DELETE FROM products');
      console.log('Products deleted');
      
      // Users table
      await pool.query('DELETE FROM users');
      console.log('Users deleted');
    } catch (error) {
      console.error('Error during delete operations:', error);
    }

    console.log('Creating test users...');
    // Create test users with Columbia emails only
    const usersResult = await pool.query(`
      INSERT INTO users (email, email_verified)
      VALUES 
        ('test1@columbia.edu', true),
        ('test2@columbia.edu', true)
      RETURNING id, email;
    `);
    
    const users = usersResult.rows;
    console.log('Test users created:', users.map(u => u.email).join(', '));

    // Create sample products (one for each category)
    if (users && users.length >= 2) {
      console.log('Creating sample products (one for each category)...');
      
      for (let i = 0; i < PRODUCT_CATEGORIES.length; i++) {
        const category = PRODUCT_CATEGORIES[i];
        // Alternate between the two test users as sellers
        const sellerId = users[i % 2].id;
        
        await pool.query(`
          INSERT INTO products (name, details, price, condition, category, seller_id, image_path)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          `Sample ${category}`,
          `This is a sample product in the ${category} category.`,
          50 + i * 25,
          i % 2 === 0 ? 'New' : 'Good condition',
          category,
          sellerId,
          `https://picsum.photos/id/${(i + 1) * 10}/300/200`
        ]);
      }
      
      console.log(`Created ${PRODUCT_CATEGORIES.length} sample products`);
    }

    // Create JWT tokens for testing
    const user1Token = jwt.sign(
      { userId: users[0].id, email: users[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const user2Token = jwt.sign(
      { userId: users[1].id, email: users[1].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('\nTest User Tokens (for manual testing):\n');
    console.log(`User 1 (${users[0].email}): ${user1Token}`);
    console.log(`User 2 (${users[1].email}): ${user2Token}`);

    console.log('\nDatabase reset complete!');
    console.log('You can use these test users and tokens for testing your application.');
    console.log('Send a verification email to authenticate as these users through the normal flow.');

  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    await pool.end();
  }
}

resetDatabase(); 