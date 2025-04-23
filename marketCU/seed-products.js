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

// Product data with realistic descriptions and fields
const products = [
  {
    name: "Vintage Leather Backpack",
    price: 79.99,
    details: "Handcrafted vintage-style leather backpack with multiple compartments. Perfect for daily use or weekend travel. Features durable brass hardware and comfortable adjustable straps.",
    category: "Bags",
    condition: "Like New",
    material: "Genuine Leather"
  },
  {
    name: "Professional DSLR Camera",
    price: 649.99,
    details: "High-quality DSLR camera with 24.2 megapixel sensor, 4K video capabilities, and excellent low-light performance. Includes 18-55mm lens, camera bag, and 64GB memory card.",
    category: "Electronics",
    condition: "Excellent",
    material: "Metal/Plastic"
  },
  {
    name: "Handmade Ceramic Mug Set",
    price: 35.00,
    details: "Set of 4 handcrafted ceramic mugs, each uniquely designed with artisanal glazes. Microwave and dishwasher safe. Perfect for coffee, tea, or hot chocolate.",
    category: "Home Goods",
    condition: "Brand New",
    material: "Ceramic"
  },
  {
    name: "Vintage Vinyl Record Collection",
    price: 120.00,
    details: "Collection of 25 classic rock vinyl records from the 70s and 80s. All in very good to excellent condition with minimal wear. Includes albums from Led Zeppelin, Pink Floyd, and The Rolling Stones.",
    category: "Music",
    condition: "Good",
    material: "Vinyl"
  },
  {
    name: "Mountain Bike",
    price: 350.00,
    details: "21-speed mountain bike with front suspension, disc brakes, and lightweight aluminum frame. Recently tuned up with new tires and brake pads. Perfect for trail riding or commuting.",
    category: "Sports",
    condition: "Good",
    material: "Aluminum"
  },
  {
    name: "Designer Sunglasses",
    price: 89.99,
    details: "Authentic designer sunglasses with polarized lenses and UV protection. Comes with original case and cleaning cloth. Sleek, timeless design that complements any outfit.",
    category: "Accessories",
    condition: "Like New",
    material: "Acetate/Metal"
  },
  {
    name: "Mechanical Keyboard",
    price: 75.00,
    details: "RGB mechanical keyboard with blue switches for tactile typing experience. Features customizable backlighting, programmable keys, and durable construction. Great for gaming or productivity.",
    category: "Electronics",
    condition: "Excellent",
    material: "ABS Plastic/Metal"
  },
  {
    name: "Handmade Wool Sweater",
    price: 65.00,
    details: "Handknit wool sweater in a classic cable knit pattern. Medium weight, perfect for fall and winter. Size medium with a relaxed fit. Carefully maintained and rarely worn.",
    category: "Clothing",
    condition: "Like New",
    material: "Merino Wool"
  },
  {
    name: "Antique Wooden Desk",
    price: 225.00,
    details: "Beautiful antique oak writing desk from the early 1900s. Features three drawers with original brass hardware and a smooth writing surface. Some signs of age but in excellent structural condition.",
    category: "Furniture",
    condition: "Good",
    material: "Solid Oak"
  },
  {
    name: "Smart Watch",
    price: 149.99,
    details: "Latest model smartwatch with heart rate monitoring, GPS, sleep tracking, and smartphone notifications. Battery lasts up to 5 days. Only used for a few months, in perfect working condition.",
    category: "Electronics",
    condition: "Excellent",
    material: "Aluminum/Silicone"
  },
  {
    name: "Acoustic Guitar",
    price: 195.00,
    details: "Beginner-friendly acoustic guitar with solid spruce top and mahogany back and sides. Produces warm, balanced tone. Includes padded gig bag, tuner, and extra strings. Perfect for learning.",
    category: "Musical Instruments",
    condition: "Good",
    material: "Spruce/Mahogany"
  },
  {
    name: "Vintage Film Camera",
    price: 85.00,
    details: "Classic 35mm film camera from the 1970s. Recently serviced and in full working order. Includes original leather case and strap. Perfect for photography enthusiasts or collectors.",
    category: "Electronics",
    condition: "Good",
    material: "Metal/Glass"
  },
  {
    name: "Handcrafted Wooden Chess Set",
    price: 65.00,
    details: "Beautifully carved wooden chess set with inlaid board. Each piece is hand-finished with attention to detail. Board folds for storage with felt-lined compartments for pieces.",
    category: "Games",
    condition: "Excellent",
    material: "Walnut/Maple"
  },
  {
    name: "Professional Art Supplies Set",
    price: 120.00,
    details: "Comprehensive art supplies kit including 48 professional-grade colored pencils, 24 watercolors, 12 acrylic paints, various brushes, and sketch pads. Perfect for aspiring artists.",
    category: "Art Supplies",
    condition: "Brand New",
    material: "Mixed"
  },
  {
    name: "Vintage Leather Jacket",
    price: 150.00,
    details: "Classic motorcycle-style leather jacket, size large. Genuine leather with quilted lining. Broken in with character but no damage. Timeless style that only gets better with age.",
    category: "Clothing",
    condition: "Good",
    material: "Leather"
  },
  {
    name: "Wireless Noise-Cancelling Headphones",
    price: 175.00,
    details: "Premium wireless headphones with active noise cancellation, 30-hour battery life, and superior sound quality. Includes carrying case, charging cable, and auxiliary cord.",
    category: "Electronics",
    condition: "Like New",
    material: "Metal/Leather"
  },
  {
    name: "Indoor Plant Collection",
    price: 85.00,
    details: "Set of 5 thriving indoor plants in decorative pots. Includes snake plant, pothos, ZZ plant, fiddle leaf fig, and peace lily. All easy to care for and perfect for purifying air.",
    category: "Home & Garden",
    condition: "Excellent",
    material: "Live Plants"
  },
  {
    name: "Vintage Comic Book Collection",
    price: 200.00,
    details: "Collection of 30 Marvel and DC comics from the 90s and early 2000s. All bagged and boarded for protection. Includes some first appearances and special editions.",
    category: "Collectibles",
    condition: "Good",
    material: "Paper"
  },
  {
    name: "Premium Yoga Mat",
    price: 45.00,
    details: "High-density, non-slip yoga mat (6mm thick) providing excellent cushioning for joints. Eco-friendly material, free from harmful chemicals. Includes carrying strap.",
    category: "Fitness",
    condition: "Like New",
    material: "TPE Foam"
  },
  {
    name: "Stainless Steel Watch",
    price: 120.00,
    details: "Elegant stainless steel watch with sapphire crystal face, automatic movement, and water resistance to 100m. Classic design suitable for casual or formal wear.",
    category: "Accessories",
    condition: "Excellent",
    material: "Stainless Steel"
  },
  {
    name: "Vintage Typewriter",
    price: 95.00,
    details: "1960s portable typewriter in working condition. Recently cleaned and serviced with new ribbon. Charming vintage piece that makes a great decoration or functional writing tool.",
    category: "Collectibles",
    condition: "Good",
    material: "Metal"
  },
  {
    name: "Handmade Leather Journal",
    price: 35.00,
    details: "Handcrafted leather-bound journal with 200 pages of premium acid-free paper. Features an antique-style clasp and unique distressed leather cover. Perfect for writing or sketching.",
    category: "Stationery",
    condition: "Brand New",
    material: "Leather/Paper"
  },
  {
    name: "Retro Game Console",
    price: 75.00,
    details: "Classic gaming console from the 90s in excellent working condition. Includes two controllers, power adapter, and 5 popular games. Ready to plug in and play.",
    category: "Electronics",
    condition: "Good",
    material: "Plastic"
  },
  {
    name: "Professional Chef's Knife Set",
    price: 135.00,
    details: "Set of 5 high-carbon stainless steel kitchen knives with ergonomic handles. Includes chef's knife, santoku, utility, paring, and bread knife. Stored in a beautiful wooden block.",
    category: "Kitchen",
    condition: "Excellent",
    material: "Stainless Steel/Wood"
  },
  {
    name: "Vintage Polaroid Camera",
    price: 65.00,
    details: "Iconic instant film camera from the 80s in working condition. Recently tested with a new film pack (not included). Creates that classic nostalgia-inducing instant photo look.",
    category: "Electronics",
    condition: "Good",
    material: "Plastic"
  },
  {
    name: "Premium Coffee Maker",
    price: 95.00,
    details: "High-end pour-over coffee maker with temperature control and programmable settings. Makes the perfect cup of coffee every time. Only used a handful of times.",
    category: "Kitchen",
    condition: "Like New",
    material: "Stainless Steel/Glass"
  },
  {
    name: "Vintage Concert Posters",
    price: 110.00,
    details: "Collection of 6 authentic vintage concert posters from legendary 70s rock shows. All preserved in excellent condition and ready for framing.",
    category: "Collectibles",
    condition: "Good",
    material: "Paper"
  },
  {
    name: "Modern Floor Lamp",
    price: 85.00,
    details: "Contemporary floor lamp with adjustable arm and dimmable LED light. Matte black finish with brass accents. Perfect for reading or ambient lighting.",
    category: "Home Decor",
    condition: "Excellent",
    material: "Metal"
  },
  {
    name: "Handmade Quilted Blanket",
    price: 75.00,
    details: "Handcrafted patchwork quilt made from upcycled cotton fabrics. Queen size with intricate stitching patterns. Warm, durable, and machine washable.",
    category: "Home Goods",
    condition: "Brand New",
    material: "Cotton"
  },
  {
    name: "Telescope",
    price: 185.00,
    details: "Amateur astronomy telescope with 70mm aperture and 700mm focal length. Includes tripod, two eyepieces, and smartphone adapter. Perfect for viewing planets and lunar details.",
    category: "Hobbies",
    condition: "Excellent",
    material: "Aluminum/Glass"
  },
  {
    name: "Vintage Board Game Collection",
    price: 95.00,
    details: "Set of 6 classic board games from the 60s and 70s, all complete with original pieces and instructions. Includes Monopoly, Risk, Clue, and more.",
    category: "Games",
    condition: "Good",
    material: "Cardboard/Paper"
  },
  {
    name: "Electric Keyboard",
    price: 165.00,
    details: "61-key digital piano with weighted keys, 100+ instrument sounds, and built-in speakers. Includes sustain pedal, stand, and headphones. Great for beginners or intermediate players.",
    category: "Musical Instruments",
    condition: "Like New",
    material: "Plastic/Metal"
  },
  {
    name: "Antique Brass Compass",
    price: 45.00,
    details: "Beautifully crafted reproduction vintage compass with brass casing and glass face. Fully functional with precise directional tracking. Comes in a presentation box.",
    category: "Collectibles",
    condition: "Brand New",
    material: "Brass/Glass"
  },
  {
    name: "Hiking Backpack",
    price: 85.00,
    details: "50L waterproof hiking backpack with adjustable straps, multiple compartments, and hydration bladder compatibility. Used on only two trips and in pristine condition.",
    category: "Outdoor Gear",
    condition: "Excellent",
    material: "Nylon"
  },
  {
    name: "Designer Wallet",
    price: 65.00,
    details: "Authentic designer bifold wallet in soft grain leather. Features 8 card slots, bill compartment, and coin pocket. Barely used and in immaculate condition.",
    category: "Accessories",
    condition: "Like New",
    material: "Leather"
  },
  {
    name: "Vintage Record Player",
    price: 135.00,
    details: "Restored 1970s record player with new needle and belt. Built-in speakers with auxiliary output for external sound systems. Beautiful wooden cabinet with mid-century design.",
    category: "Electronics",
    condition: "Good",
    material: "Wood/Metal"
  },
  {
    name: "Handmade Ceramic Vase",
    price: 55.00,
    details: "Unique handcrafted ceramic vase with striking blue and white glaze. Each piece is one-of-a-kind with subtle variations in the glazing pattern. Perfect for flowers or as standalone decor.",
    category: "Home Decor",
    condition: "Brand New",
    material: "Ceramic"
  },
  {
    name: "Telescope",
    price: 195.00,
    details: "Amateur astronomy telescope with 70mm aperture and 700mm focal length. Includes tripod, two eyepieces, and smartphone adapter. Perfect for viewing planets and lunar details.",
    category: "Hobbies",
    condition: "Excellent",
    material: "Aluminum/Glass"
  },
  {
    name: "Professional Drawing Tablet",
    price: 135.00,
    details: "Medium-sized graphics tablet with 8192 levels of pressure sensitivity and tilt recognition. Compatible with all major design software. Includes stylus and extra nibs.",
    category: "Electronics",
    condition: "Like New",
    material: "Plastic"
  },
  {
    name: "Vintage Leather Briefcase",
    price: 110.00,
    details: "Classic full-grain leather briefcase with brass hardware. Features multiple internal compartments, laptop sleeve, and adjustable shoulder strap. Develops beautiful patina with use.",
    category: "Bags",
    condition: "Good",
    material: "Leather"
  },
  {
    name: "Home Espresso Machine",
    price: 225.00,
    details: "Semi-automatic espresso machine with 15-bar pressure pump, milk frother, and cup warmer. Makes cafe-quality espresso, cappuccino, and latte. Recently descaled and maintained.",
    category: "Kitchen",
    condition: "Excellent",
    material: "Stainless Steel"
  },
  {
    name: "Vintage Film Posters",
    price: 85.00,
    details: "Set of 3 reproduced classic movie posters from the golden age of Hollywood. High-quality printing on heavyweight paper. Perfect for framing and home theater decor.",
    category: "Home Decor",
    condition: "Brand New",
    material: "Paper"
  },
  {
    name: "Cast Iron Cookware Set",
    price: 95.00,
    details: "Pre-seasoned cast iron cookware set including 10-inch skillet, 5-quart dutch oven with lid, and griddle. Excellent heat retention and durability. Will last generations with proper care.",
    category: "Kitchen",
    condition: "Good",
    material: "Cast Iron"
  },
  {
    name: "Vintage Pocket Watch",
    price: 75.00,
    details: "Antique-style mechanical pocket watch with intricate engravings and visible movement through display back. Includes matching chain and presentation box. Fully functional.",
    category: "Accessories",
    condition: "Excellent",
    material: "Brass"
  },
  {
    name: "Handmade Wool Blanket",
    price: 115.00,
    details: "Luxurious hand-woven wool throw blanket in a classic herringbone pattern. Super soft, warm, and generously sized at 60 x 80 inches. Perfect for cool evenings.",
    category: "Home Goods",
    condition: "Brand New",
    material: "Wool"
  },
  {
    name: "Vintage Desk Lamp",
    price: 65.00,
    details: "Mid-century brass desk lamp with adjustable arm and swivel head. Recently rewired with modern components while maintaining authentic vintage appearance.",
    category: "Home Decor",
    condition: "Good",
    material: "Brass"
  },
  {
    name: "Mechanical Wristwatch",
    price: 185.00,
    details: "Automatic mechanical watch with skeleton dial showing the intricate movement inside. Features sapphire crystal, stainless steel case, and genuine leather band.",
    category: "Accessories",
    condition: "Like New",
    material: "Stainless Steel/Leather"
  },
  {
    name: "Indoor Plant Collection",
    price: 95.00,
    details: "Curated set of 5 thriving houseplants in decorative ceramic pots. Includes varieties suitable for different light conditions. All easy to care for and air-purifying.",
    category: "Home & Garden",
    condition: "Excellent",
    material: "Live Plants"
  },
  {
    name: "Vintage Camera Lens Set",
    price: 145.00,
    details: "Collection of 3 manual focus prime lenses from the 70s and 80s. All in working condition with minor cosmetic wear. Adaptable to modern mirrorless cameras.",
    category: "Electronics",
    condition: "Good",
    material: "Glass/Metal"
  }
];

// Create test users (if they don't exist)
const createUsers = async () => {
  for (let i = 1; i <= 15; i++) {
    const email = `test${i}@example.com`;
    const verificationCode = '123456'; // Simple verification code for testing
    
    // Check if user already exists
    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (checkUser.rows.length === 0) {
      // Create user if doesn't exist
      // Note: Using now() + interval '1 day' for code_expires to ensure it's valid
      await pool.query(
        `INSERT INTO users 
         (email, verification_code, email_verified, code_expires) 
         VALUES ($1, $2, $3, now() + interval '1 day')`,
        [email, verificationCode, true] // Set email_verified to true for testing
      );
      console.log(`Created user: ${email}`);
    } else {
      console.log(`User ${email} already exists`);
    }
  }
};

// Insert products into database
const seedProducts = async () => {
  try {
    await createUsers();
    
    // Get all test users
    const usersResult = await pool.query(
      "SELECT id, email FROM users WHERE email LIKE 'test%@example.com'"
    );
    
    const users = usersResult.rows;
    if (users.length === 0) {
      console.error('No test users found');
      return;
    }
    
    let count = 0;
    
    for (const product of products) {
      // Assign each product to a random test user
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      // Insert product with the columns that exist in the products table
      // Note: seller_email isn't in the schema, so we won't include it
      const result = await pool.query(
        `INSERT INTO products 
        (name, price, details, category, condition, seller_id) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          product.name,
          product.price,
          product.details,
          product.category,
          product.condition,
          randomUser.id
        ]
      );
      
      count++;
      console.log(`Added product ${count}: ${product.name} (seller: ${randomUser.email})`);
    }
    
    console.log(`Successfully added ${count} test products.`);
  } catch (error) {
    console.error('Error seeding products:', error);
  } finally {
    pool.end();
  }
};

// Run the seed function
seedProducts(); 