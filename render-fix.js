// Script to fix database connection issues on Render
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function fixRenderDbConnection() {
  console.log('=== RENDER DATABASE FIX TOOL ===');
  console.log(`Running at: ${new Date().toISOString()}`);
  console.log(`Current directory: ${process.cwd()}`);
  
  // 1. Check for DATABASE_URL in environment
  console.log('\nChecking environment variables:');
  if (process.env.DATABASE_URL) {
    const maskedURL = process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@');
    console.log(`DATABASE_URL is set: ${maskedURL}`);
    
    // Check if the URL is in the correct format with region
    const fixedUrl = ensureCorrectDbUrl(process.env.DATABASE_URL);
    if (fixedUrl !== process.env.DATABASE_URL) {
      console.log('Fixed DATABASE_URL format');
      process.env.DATABASE_URL = fixedUrl;
    }
  } else {
    console.log('DATABASE_URL is not set in the environment');
    
    // Look for .env files in possible locations
    const possibleEnvLocations = [
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), 'marketCU', '.env'),
      path.join(process.cwd(), 'marketCU', 'server', '.env'),
      path.join(process.cwd(), 'server', '.env')
    ];
    
    console.log('\nLooking for .env files in possible locations:');
    let foundDbUrl = null;
    
    for (const envPath of possibleEnvLocations) {
      if (fs.existsSync(envPath)) {
        console.log(`Found .env file at: ${envPath}`);
        try {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const dbUrlMatch = envContent.match(/DATABASE_URL=(.+?)(\r?\n|$)/);
          
          if (dbUrlMatch && dbUrlMatch[1]) {
            foundDbUrl = dbUrlMatch[1];
            
            // Fix URL format if needed
            foundDbUrl = ensureCorrectDbUrl(foundDbUrl);
            
            const maskedFoundUrl = foundDbUrl.replace(/:[^:@]*@/, ':***@');
            console.log(`Found DATABASE_URL in ${envPath}: ${maskedFoundUrl}`);
            
            // Set for current process
            process.env.DATABASE_URL = foundDbUrl;
            console.log('Set DATABASE_URL for current process');
            break;
          } else {
            console.log(`No DATABASE_URL found in ${envPath}`);
          }
        } catch (error) {
          console.error(`Error reading ${envPath}:`, error.message);
        }
      } else {
        console.log(`No .env file found at: ${envPath}`);
      }
    }
    
    // Use hardcoded internal URL as last resort if specified
    if (!foundDbUrl && process.argv.length > 2) {
      foundDbUrl = process.argv[2];
      console.log('Using command line provided DATABASE_URL');
      
      // Fix URL format if needed
      foundDbUrl = ensureCorrectDbUrl(foundDbUrl);
      
      process.env.DATABASE_URL = foundDbUrl;
    }
    
    // Create/update root .env file with the found DATABASE_URL
    if (foundDbUrl) {
      const rootEnvPath = path.join(process.cwd(), '.env');
      
      try {
        if (fs.existsSync(rootEnvPath)) {
          console.log(`Updating existing .env at ${rootEnvPath}`);
          let envContent = fs.readFileSync(rootEnvPath, 'utf8');
          
          if (envContent.includes('DATABASE_URL=')) {
            // Replace existing DATABASE_URL
            envContent = envContent.replace(
              /DATABASE_URL=.+?(\r?\n|$)/,
              `DATABASE_URL=${foundDbUrl}$1`
            );
          } else {
            // Add DATABASE_URL if not present
            envContent += `\nDATABASE_URL=${foundDbUrl}\n`;
          }
          
          fs.writeFileSync(rootEnvPath, envContent);
        } else {
          console.log(`Creating new .env at ${rootEnvPath}`);
          fs.writeFileSync(rootEnvPath, `DATABASE_URL=${foundDbUrl}\n`);
        }
        
        console.log('Root .env file created/updated successfully');
      } catch (error) {
        console.error('Error updating root .env file:', error.message);
      }
    } else {
      console.error('Could not find DATABASE_URL in any .env file');
    }
  }
  
  // Function to ensure the database URL is in the correct format
  function ensureCorrectDbUrl(url) {
    if (!url) return url;
    
    // Check if the URL is missing the region component
    if (url.includes('dpg-') && !url.includes('.oregon-postgres.render.com')) {
      // Fix for internal Render URL missing region
      url = url.replace(/(@dpg-[^\/]+)\//, '$1.oregon-postgres.render.com/');
      console.log('Fixed URL to include region component');
    }
    
    return url;
  }
  
  // 2. Test database connection
  console.log('\nTesting database connection:');
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL available, cannot test connection');
    return;
  }
  
  // Log the final DATABASE_URL being used (masked)
  const finalMaskedURL = process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@');
  console.log(`Using DATABASE_URL: ${finalMaskedURL}`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL connection
    }
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');
    
    // Look for tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found in the database');
      console.log('Running database initialization...');
      await initDatabase(client);
    } else {
      console.log(`✅ Found ${tablesResult.rows.length} tables`);
      
      // Check if products table exists and has data
      const productTableExists = tablesResult.rows.some(row => 
        row.table_name === 'products'
      );
      
      if (productTableExists) {
        const productCount = await client.query('SELECT COUNT(*) FROM products');
        console.log(`Products in database: ${productCount.rows[0].count}`);
        
        if (parseInt(productCount.rows[0].count) === 0) {
          console.log('Products table is empty, adding sample products...');
          await addSampleProducts(client);
        }
      } else {
        console.log('Products table not found, running initialization...');
        await initDatabase(client);
      }
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    
    // Attempt to fix common connection issues
    if (error.message.includes('no pg_hba.conf entry') || 
        error.message.includes('password authentication failed')) {
      console.log('\nAttempting to fix authentication issues...');
      // Try alternative connection string format
      const altDbUrl = process.env.DATABASE_URL
        .replace('.oregon-postgres.render.com', '-a.oregon-postgres.render.com');
      
      console.log('Trying alternative DB URL format...');
      try {
        const altPool = new Pool({
          connectionString: altDbUrl,
          ssl: {
            rejectUnauthorized: false
          }
        });
        
        const altClient = await altPool.connect();
        console.log('✅ Successfully connected with alternative URL format');
        
        // Update the environment variable with working URL
        process.env.DATABASE_URL = altDbUrl;
        
        // Update .env file with working URL
        try {
          const rootEnvPath = path.join(process.cwd(), '.env');
          if (fs.existsSync(rootEnvPath)) {
            let envContent = fs.readFileSync(rootEnvPath, 'utf8');
            envContent = envContent.replace(
              /DATABASE_URL=.+?(\r?\n|$)/,
              `DATABASE_URL=${altDbUrl}$1`
            );
            fs.writeFileSync(rootEnvPath, envContent);
            console.log('Updated .env file with working URL');
          }
        } catch (envError) {
          console.error('Error updating .env file:', envError.message);
        }
        
        // Continue with alt client
        const tablesResult = await altClient.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        
        if (tablesResult.rows.length === 0) {
          console.log('❌ No tables found in the database');
          console.log('Running database initialization...');
          await initDatabase(altClient);
        } else {
          console.log(`✅ Found ${tablesResult.rows.length} tables`);
          
          // Check if products table exists and has data
          const productTableExists = tablesResult.rows.some(row => 
            row.table_name === 'products'
          );
          
          if (productTableExists) {
            const productCount = await altClient.query('SELECT COUNT(*) FROM products');
            console.log(`Products in database: ${productCount.rows[0].count}`);
            
            if (parseInt(productCount.rows[0].count) === 0) {
              console.log('Products table is empty, adding sample products...');
              await addSampleProducts(altClient);
            }
          } else {
            console.log('Products table not found, running initialization...');
            await initDatabase(altClient);
          }
        }
        
        altClient.release();
        await altPool.end();
      } catch (altError) {
        console.error('Alternative connection also failed:', altError.message);
      }
    }
  } finally {
    await pool.end();
  }
  
  console.log('\nRender database fix process completed');
}

async function initDatabase(client) {
  try {
    console.log('Creating database schema...');
    
    // Create extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_code TEXT,
        code_expires TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        seller_id UUID NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        details TEXT NOT NULL,
        price DECIMAL NOT NULL,
        condition TEXT NOT NULL,
        category TEXT NOT NULL,
        image_path TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id),
        buyer_id UUID NOT NULL REFERENCES users(id),
        seller_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        chat_id UUID NOT NULL REFERENCES chats(id),
        sender_id UUID NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id),
        product_id UUID NOT NULL REFERENCES products(id),
        cart_type TEXT NOT NULL CHECK (cart_type IN ('CONTACTED', 'CART_ONLY')),
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        chat_id UUID REFERENCES chats(id),
        UNIQUE(user_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS help_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id),
        to_user_id UUID REFERENCES users(id),
        message TEXT NOT NULL,
        is_from_admin BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('Tables created successfully');
    
    // Add sample data
    await addSampleProducts(client);
  } catch (error) {
    console.error('Error initializing database:', error.message);
  }
}

async function addSampleProducts(client) {
  try {
    // Add test users
    console.log('Adding test users...');
    const usersResult = await client.query(`
      INSERT INTO users (email, email_verified)
      VALUES 
        ('test1@columbia.edu', true),
        ('test2@columbia.edu', true),
        ('admin@columbia.edu', true)
      ON CONFLICT (email) DO NOTHING
      RETURNING id;
    `);
    
    if (usersResult.rows.length > 0) {
      console.log(`Added ${usersResult.rows.length} test users`);
      
      // Product categories
      const categories = [
        "Laptops & Accessories",
        "Textbooks & Study Guides",
        "Dorm & Apartment Essentials",
        "Bicycles & Scooters",
        "Electronics & Gadgets",
        "Furniture & Storage",
        "Clothing & Fashion",
        "School Supplies"
      ];
      
      // Add sample products
      console.log('Adding sample products...');
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const sellerId = usersResult.rows[i % usersResult.rows.length].id;
        
        await client.query(`
          INSERT INTO products (name, details, price, condition, category, seller_id, image_path)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          `Sample ${category}`,
          `This is a sample product in the ${category} category.`,
          50 + i * 25,
          i % 2 === 0 ? 'New' : 'Used',
          category,
          sellerId,
          `https://picsum.photos/id/${(i + 1) * 10}/300/200`
        ]);
      }
      console.log('Sample products added');
    } else {
      // If no new users were added (they already existed), get existing user IDs
      const existingUsers = await client.query('SELECT id FROM users LIMIT 3');
      
      if (existingUsers.rows.length > 0) {
        console.log('Using existing users for sample products');
        
        // Product categories
        const categories = [
          "Laptops & Accessories",
          "Textbooks & Study Guides",
          "Dorm & Apartment Essentials",
          "Bicycles & Scooters",
          "Electronics & Gadgets",
          "Furniture & Storage",
          "Clothing & Fashion",
          "School Supplies"
        ];
        
        // Add sample products with existing users
        console.log('Adding sample products with existing users...');
        for (let i = 0; i < categories.length; i++) {
          const category = categories[i];
          const sellerId = existingUsers.rows[i % existingUsers.rows.length].id;
          
          await client.query(`
            INSERT INTO products (name, details, price, condition, category, seller_id, image_path)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING
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
        console.log('Sample products added with existing users');
      } else {
        console.error('No users available to create sample products');
      }
    }
  } catch (error) {
    console.error('Error adding sample data:', error.message);
  }
}

// Call with command line arg if provided
const cmdLineDbUrl = process.argv.length > 2 ? process.argv[2] : null;
fixRenderDbConnection(cmdLineDbUrl); 