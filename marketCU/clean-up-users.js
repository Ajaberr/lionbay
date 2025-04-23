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

async function cleanupUsers() {
  try {
    // Get all users that don't have 'test' in their email and aren't 'aaa2485@columbia.edu'
    console.log("Finding users to delete...");
    const usersToDelete = await pool.query(`
      SELECT id, email
      FROM users
      WHERE 
        email NOT ILIKE '%test%' 
        AND email != 'aaa2485@columbia.edu'
    `);
    
    console.log(`Found ${usersToDelete.rows.length} users to delete:`);
    usersToDelete.rows.forEach(user => {
      console.log(`- ${user.email} (ID: ${user.id})`);
    });
    
    // Get the user IDs for deletion
    const userIds = usersToDelete.rows.map(user => user.id);
    
    if (userIds.length === 0) {
      console.log("No users to delete.");
      return;
    }
    
    // First get the product IDs associated with these users
    console.log("\nFinding products for these users...");
    const productsToDelete = await pool.query(`
      SELECT id, name, seller_id
      FROM products
      WHERE seller_id = ANY($1)
    `, [userIds]);
    
    console.log(`Found ${productsToDelete.rows.length} products to delete.`);
    
    // Get product IDs
    const productIds = productsToDelete.rows.map(product => product.id);
    
    if (productIds.length > 0) {
      // First delete from cart_items table (remove foreign key constraints)
      console.log("\nDeleting cart items referencing these products...");
      const deletedCartItems = await pool.query(`
        DELETE FROM cart_items
        WHERE product_id = ANY($1)
        RETURNING id
      `, [productIds]);
      
      console.log(`Deleted ${deletedCartItems.rows.length} cart items.`);
      
      // Check for any chats related to these products and delete them too
      console.log("\nDeleting chats related to these products...");
      // First find any chat IDs
      const chatsToDelete = await pool.query(`
        SELECT id
        FROM chats
        WHERE product_id = ANY($1)
      `, [productIds]);
      
      const chatIds = chatsToDelete.rows.map(chat => chat.id);
      
      if (chatIds.length > 0) {
        // Delete messages first
        const deletedMessages = await pool.query(`
          DELETE FROM messages
          WHERE chat_id = ANY($1)
          RETURNING id
        `, [chatIds]);
        
        console.log(`Deleted ${deletedMessages.rows.length} messages from chats.`);
        
        // Then delete the chats
        const deletedChats = await pool.query(`
          DELETE FROM chats
          WHERE id = ANY($1)
          RETURNING id
        `, [chatIds]);
        
        console.log(`Deleted ${deletedChats.rows.length} chats.`);
      } else {
        console.log("No chats found for these products.");
      }
      
      // Now delete the products
      console.log("\nDeleting products...");
      const deletedProducts = await pool.query(`
        DELETE FROM products 
        WHERE id = ANY($1)
        RETURNING id, name
      `, [productIds]);
      
      console.log(`Deleted ${deletedProducts.rows.length} products.`);
    } else {
      console.log("No products found for these users.");
    }
    
    // Now delete from cart (if user has a cart)
    console.log("\nDeleting carts for these users...");
    const deletedCarts = await pool.query(`
      DELETE FROM cart_items
      WHERE user_id = ANY($1)
      RETURNING id
    `, [userIds]);
    
    console.log(`Deleted ${deletedCarts.rows.length} cart items owned by these users.`);
    
    // Delete help messages
    console.log("\nDeleting help messages from these users...");
    const deletedHelpMessages = await pool.query(`
      DELETE FROM help_messages
      WHERE user_id = ANY($1)
      RETURNING id
    `, [userIds]);
    
    console.log(`Deleted ${deletedHelpMessages.rows.length} help messages.`);
    
    // Check for other foreign key constraints
    console.log("\nChecking for other constraints...");
    // List tables referencing users
    const constraints = await pool.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'
    `);
    
    console.log("Tables with foreign keys to 'users':");
    constraints.rows.forEach(row => {
      console.log(`- ${row.table_name}.${row.column_name} references users.${row.foreign_column_name}`);
    });
    
    // Try to handle each constraint table
    for (const constraint of constraints.rows) {
      const tableName = constraint.table_name;
      const columnName = constraint.column_name;
      
      if (tableName !== 'products' && tableName !== 'cart_items' && tableName !== 'help_messages') {
        console.log(`\nDeleting from ${tableName} where ${columnName} references users being deleted...`);
        try {
          const deleted = await pool.query(`
            DELETE FROM ${tableName}
            WHERE ${columnName} = ANY($1)
            RETURNING id
          `, [userIds]);
          
          console.log(`Deleted ${deleted.rows.length} rows from ${tableName}.`);
        } catch (error) {
          console.error(`Error deleting from ${tableName}:`, error.message);
        }
      }
    }
    
    // Finally delete the users
    console.log("\nDeleting users...");
    const deletedUsers = await pool.query(`
      DELETE FROM users 
      WHERE id = ANY($1)
      RETURNING id, email
    `, [userIds]);
    
    console.log(`Deleted ${deletedUsers.rows.length} users.`);
    
    // Verify the cleanup
    console.log("\nRemaining users:");
    const remainingUsers = await pool.query(`
      SELECT email 
      FROM users 
      ORDER BY email
    `);
    
    remainingUsers.rows.forEach(user => {
      console.log(`- ${user.email}`);
    });
    
    console.log(`\nTotal remaining users: ${remainingUsers.rows.length}`);
    
  } catch (error) {
    console.error("Error cleaning up users:", error);
    console.error("Error details:", error.detail);
  } finally {
    pool.end();
  }
}

// Ask for confirmation before running
const args = process.argv.slice(2);
if (args.includes('--confirm')) {
  console.log("Confirmation received. Proceeding with cleanup...");
  cleanupUsers();
} else {
  console.log(`
WARNING: This script will delete all users that don't have 'test' in their email 
and aren't 'aaa2485@columbia.edu', along with all their products, cart items, chats,
and other related data.

To confirm, run the script with the --confirm flag:
node clean-up-users.js --confirm
`);
} 