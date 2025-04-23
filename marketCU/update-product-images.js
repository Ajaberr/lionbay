import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server/.env file
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

console.log("Database URL:", process.env.DATABASE_URL);

// Connect to database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for some cloud database providers
  }
});

// High quality images for each category
const categoryImages = {
  'Electronics': [
    'https://images.unsplash.com/photo-1593642532842-98d0fd5ebc1a?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1546027658-7aa750153465?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1519183071298-a2962feb14f4?w=800&h=600&fit=crop'
  ],
  'Clothing': [
    'https://images.unsplash.com/photo-1512327428889-607eeb19efe8?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1603252109612-24fa03d145c8?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1535024929813-ea7dadc6cdb3?w=800&h=600&fit=crop'
  ],
  'Books': [
    'https://images.unsplash.com/photo-1518744713167-72ce57bccba2?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=800&h=600&fit=crop'
  ],
  'Furniture': [
    'https://images.unsplash.com/photo-1616627561797-d6d126249be5?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1589834390005-5d4fb9bf3d32?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1532499012776-c0e604233e03?w=800&h=600&fit=crop'
  ],
  'Home Goods': [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1526893381913-e311045b8064?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1517268224104-5ddb7019f7f6?w=800&h=600&fit=crop'
  ],
  'Kitchen': [
    'https://images.unsplash.com/photo-1590794056422-98e13a23cf4a?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1583845112203-29329902332e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1586788224331-947f68671cf1?w=800&h=600&fit=crop'
  ],
  'Sports': [
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1518006467066-ef63694d3fce?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1583454155184-870a1f63aebc?w=800&h=600&fit=crop'
  ],
  'Hobbies': [
    'https://images.unsplash.com/photo-1596567595217-3c648c7c6e3b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1568819108857-f074af476ad7?w=800&h=600&fit=crop'
  ],
  'Musical Instruments': [
    'https://images.unsplash.com/photo-1577191606728-0ce77fd613d5?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=800&h=600&fit=crop'
  ],
  'Art Supplies': [
    'https://images.unsplash.com/photo-1572283263982-13ab8dd4e01e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1605639156502-74dad2e48cc3?w=800&h=600&fit=crop'
  ],
  'Outdoor Gear': [
    'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1529309455562-fbd6a64d6be9?w=800&h=600&fit=crop'
  ],
  'Collectibles': [
    'https://images.unsplash.com/photo-1613426162055-d82b2c17d818?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1593677659936-55baaa9ac391?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?w=800&h=600&fit=crop'
  ],
  'Accessories': [
    'https://images.unsplash.com/photo-1601923157792-3e5653184355?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1590548784585-643d2b9f2925?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1573879541250-58ae8b322b40?w=800&h=600&fit=crop'
  ],
  'Bags': [
    'https://images.unsplash.com/photo-1590739225287-bd31519151a7?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1479104548311-182960a769b8?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=600&fit=crop'
  ],
  'Games': [
    'https://images.unsplash.com/photo-1558433916-8d814148bf92?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1618022338800-5f1b2b717f4c?w=800&h=600&fit=crop'
  ],
  'Stationery': [
    'https://images.unsplash.com/photo-1574359411659-15573a27167b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1568205612837-017257d2310a?w=800&h=600&fit=crop'
  ],
  'Home Decor': [
    'https://images.unsplash.com/photo-1558442074-3c19857bc1dc?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1509719782146-9718efdd14e7?w=800&h=600&fit=crop'
  ],
  'Home & Garden': [
    'https://images.unsplash.com/photo-1508022569543-0b7da70644cb?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1523575288164-d868fc07be6a?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1557715549-a3c3107498cb?w=800&h=600&fit=crop'
  ],
  'Music': [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1506091403742-e3aa39518db5?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800&h=600&fit=crop'
  ],
  'Fitness': [
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1593810450967-2835ee913979?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=800&h=600&fit=crop'
  ]
};

// Default images for categories not in our mapping
const defaultImages = [
  'https://images.unsplash.com/photo-1587302912306-cf1ed9c33146?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1532033375034-a29004ea9769?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1615655406736-b37c4fabf923?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1557800636-894a64c1696f?w=800&h=600&fit=crop'
];

// Function to get a random image URL for a category
const getRandomImageForCategory = (category) => {
  // If we have images for this category, pick a random one
  if (categoryImages[category] && categoryImages[category].length > 0) {
    const randomIndex = Math.floor(Math.random() * categoryImages[category].length);
    return categoryImages[category][randomIndex];
  }
  
  // Otherwise use a default image
  const randomIndex = Math.floor(Math.random() * defaultImages.length);
  return defaultImages[randomIndex];
};

// Update products with image URLs
const updateProductImages = async () => {
  try {
    // Get products without image_path
    const productsResult = await pool.query(
      "SELECT id, category, name FROM products WHERE image_path IS NULL OR image_path = ''"
    );
    
    const products = productsResult.rows;
    console.log(`Found ${products.length} products without images`);
    
    // Update each product with a category-appropriate image
    let updatedCount = 0;
    
    for (const product of products) {
      const imageUrl = getRandomImageForCategory(product.category);
      
      await pool.query(
        'UPDATE products SET image_path = $1 WHERE id = $2',
        [imageUrl, product.id]
      );
      
      updatedCount++;
      console.log(`Updated product ${updatedCount}/${products.length}: ${product.name} (${product.category}) with image URL`);
    }
    
    console.log(`Successfully updated ${updatedCount} products with image URLs.`);
  } catch (error) {
    console.error('Error updating product images:', error);
  } finally {
    pool.end();
  }
};

// Run the update function
updateProductImages(); 