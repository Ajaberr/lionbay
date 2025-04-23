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

async function checkProducts() {
  try {
    // Get latest 10 products
    console.log("Checking latest products in database...");
    const result = await pool.query(`
      SELECT p.id, p.name, p.price, p.image_path, u.email as seller
      FROM products p
      JOIN users u ON p.seller_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} recent products:`);
    result.rows.forEach(product => {
      console.log(`- ${product.name} ($${product.price})`);
      console.log(`  Seller: ${product.seller}`);
      console.log(`  Image: ${product.image_path ? 'Yes ✅' : 'No ❌'}`);
      if (product.image_path) {
        console.log(`  Image URL: ${product.image_path}`);
      }
      console.log('');
    });
    
    // Count products with images
    const imageStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN image_path IS NOT NULL THEN 1 END) as with_images,
        COUNT(CASE WHEN image_path IS NULL THEN 1 END) as without_images
      FROM products
    `);
    
    const stats = imageStats.rows[0];
    console.log(`Total products: ${stats.total}`);
    console.log(`Products with images: ${stats.with_images} (${Math.round(stats.with_images/stats.total*100)}%)`);
    console.log(`Products without images: ${stats.without_images} (${Math.round(stats.without_images/stats.total*100)}%)`);
    
  } catch (error) {
    console.error("Error checking products:", error);
  } finally {
    pool.end();
  }
}

checkProducts(); 