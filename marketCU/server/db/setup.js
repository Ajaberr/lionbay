require('dotenv').config();
const { Client } = require('pg');
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

async function setupDatabase() {
  // Initialize PostgreSQL client
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL connection
    }
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully');

    // Create tables
    console.log('Creating tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_code TEXT,
        code_expires TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        details TEXT NOT NULL,
        price DECIMAL NOT NULL,
        condition TEXT NOT NULL,
        category TEXT NOT NULL,
        image_path TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id),
        buyer_id UUID NOT NULL REFERENCES users(id),
        seller_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id),
        sender_id UUID NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS help_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        to_user_id UUID REFERENCES users(id),
        message TEXT NOT NULL,
        is_from_admin BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('Tables created successfully');

    // Clear existing data (optional)
    console.log('Clearing existing data...');
    await client.query('DELETE FROM help_messages');
    await client.query('DELETE FROM messages');
    await client.query('DELETE FROM chats');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM users');
    console.log('Existing data cleared');

    // Create test users
    console.log('Creating test users...');
    const usersResult = await client.query(`
      INSERT INTO users (email, email_verified)
      VALUES 
        ('test1@columbia.edu', true),
        ('test2@columbia.edu', true),
        ('aaa2485@columbia.edu', true),
        ('amj2234@columbia.edu', true)
      RETURNING id, email;
    `);
    
    const users = usersResult.rows;
    console.log('Test users created:', users.map(u => u.email).join(', '));

    // Create sample products
    console.log('Creating sample products...');
    for (let i = 0; i < PRODUCT_CATEGORIES.length; i++) {
      const category = PRODUCT_CATEGORIES[i];
      const sellerId = users[i % 2].id;
      
      await client.query(`
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

    // Create some sample help messages
    console.log('Creating sample help messages...');
    const regularUser = users.find(u => u.email === 'test1@columbia.edu');
    const adminUser = users.find(u => u.email === 'aaa2485@columbia.edu');
    
    if (regularUser && adminUser) {
      await client.query(`
        INSERT INTO help_messages (user_id, message, is_from_admin)
        VALUES ($1, $2, $3)
      `, [
        regularUser.id,
        'Hi, I need help with posting my product. The image is not uploading correctly.',
        false
      ]);
      
      await client.query(`
        INSERT INTO help_messages (user_id, to_user_id, message, is_from_admin)
        VALUES ($1, $2, $3, $4)
      `, [
        adminUser.id,
        regularUser.id,
        'Hi there, make sure your image is under 10MB and in JPG, PNG, or WEBP format. Let me know if you need further assistance.',
        true
      ]);
      
      console.log('Sample help messages created');
    }

    // Create JWT tokens for testing
    if (process.env.JWT_SECRET) {
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
      
      const adminToken = jwt.sign(
        { userId: users.find(u => u.email === 'aaa2485@columbia.edu').id, email: 'aaa2485@columbia.edu' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('\nTest User Tokens (for manual testing):\n');
      console.log(`User 1 (${users[0].email}): ${user1Token}`);
      console.log(`User 2 (${users[1].email}): ${user2Token}`);
      console.log(`Admin (aaa2485@columbia.edu): ${adminToken}`);
    } else {
      console.warn('JWT_SECRET not found in .env file. Unable to generate test tokens.');
    }

    console.log('\nDatabase setup complete!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

setupDatabase(); 