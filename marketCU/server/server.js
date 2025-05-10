// Load environment variables from .env files
const path = require('path');
const dotenv = require('dotenv');

const serverEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');

// For backward compatibility, retain default behaviour too (will be a no-op now)
// require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Client, Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { cleanupInactiveChats } = require('./chatCleanup');

const app = express();
const server = http.createServer(app);

// Load environment variables
require('dotenv').config();

// Server configuration
const PORT = process.env.PORT || 3003;
const API_URL = process.env.API_URL || 'http://localhost:3003/api';

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
  'https://lionbay-api.onrender.com',
  'https://lionbay.com',
  'https://lionbay.org',
  'https://www.lionbay.org',
  'https://lionbay.onrender.com',
  process.env.FRONTEND_URL
    ].filter(Boolean)
  : (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3003,http://localhost:5173').split(',');

console.log('Environment:', process.env.NODE_ENV);
console.log('API URL:', API_URL);
console.log('Allowed CORS origins:', allowedOrigins);

// Configure CORS with more detailed options
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      console.log('CORS error:', msg, 'Origin:', origin);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests
app.options('*', cors());

// Configure Socket.IO with CORS settings
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug current working directory and paths
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Use the exact build path we confirmed exists for local development
let distPath = '/Users/abdullahalzahrani/Projects/marketCU/marketCU/dist';

// For Render or other production environments, use a different path
if (process.env.NODE_ENV === 'production') {
  distPath = path.join(__dirname, '../dist');
  console.log('Using production build path:', distPath);
}

console.log(`Checking dist path: ${distPath} - exists: ${fs.existsSync(distPath)}`);

if (fs.existsSync(distPath)) {
  console.log('Frontend build found. Serving static files from:', distPath);
  app.use(express.static(distPath));
  
  // Add a catch-all route for client-side routing
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
  
  console.log('Added catch-all route for SPA navigation');
} else {
  console.log('WARNING: Frontend build not found at:', distPath);
  console.log('Attempting alternative dist locations...');
  
  // Try alternative dist locations
  const alternativeDistPaths = [
    path.join(__dirname, '../dist'),
    path.join(__dirname, '../../dist'),
    path.join(process.cwd(), 'dist')
  ];
  
  let found = false;
  for (const altPath of alternativeDistPaths) {
    console.log(`Checking alternative path: ${altPath} - exists: ${fs.existsSync(altPath)}`);
    if (fs.existsSync(altPath)) {
      console.log('Frontend build found at alternative location:', altPath);
      app.use(express.static(altPath));
      
      // Add a catch-all route for client-side routing
      app.get('*', (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api/')) {
          return next();
        }
        res.sendFile(path.join(altPath, 'index.html'));
      });
      
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log('WARNING: No frontend build found in any location.');
  }
}

// Initialize PostgreSQL pool for connection management
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  }
});

// Configure Nodemailer transporter
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  console.log('Nodemailer transporter configured for Gmail.');
  } else {
  console.warn('Email credentials (EMAIL_USER, EMAIL_PASSWORD) not found in environment variables. Email sending will be disabled.');
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({ error: 'No authentication token provided' });
  }
  
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    console.log('Token validated successfully for user:', user.email);
    next();
  } catch (err) {
    console.log('Token validation failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Admin middleware
const getAdminEmails = () => {
  const envAdmins = process.env.ADMIN_EMAILS;
  if (envAdmins) {
    return envAdmins.split(',').map(email => email.trim());
  }
  return ['aaa2485@columbia.edu', 'amj2234@columbia.edu']; // Default admins if not set in env
};

const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  // Get admin emails from environment variable
  const adminEmails = getAdminEmails();
  
  // Check if user email is in admin list
  if (adminEmails.includes(req.user.email)) {
    req.isAdmin = true;
    next();
  } else {
    return res.status(403).json({ error: 'Admin access required' });
  }
};

// Check if user is admin (for non-protected routes)
const checkAdmin = (email) => {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email);
};

// Products API
app.get('/api/products', async (req, res) => {
  try {
    // Extract query parameters if they exist
    const { exclude, categories, seller_id } = req.query;
    
    // Build base query
    let query = 'SELECT p.*, u.email as seller_email FROM products p JOIN users u ON p.seller_id = u.id';
    const params = [];
    const conditions = [];
    
    // Add filter for excluded product IDs
    if (exclude && exclude.length > 0) {
      const excludedIds = exclude.split(',').filter(id => id);
      if (excludedIds.length > 0) {
        conditions.push(`p.id NOT IN (${excludedIds.map((_, i) => `$${i + 1}`).join(',')})`);
        params.push(...excludedIds);
      }
    }
    
    // Add filter for categories
    if (categories && categories.length > 0) {
      const categoryList = categories.split(',').filter(cat => cat);
      if (categoryList.length > 0) {
        conditions.push(`p.category IN (${categoryList.map((_, i) => `$${params.length + i + 1}`).join(',')})`);
        params.push(...categoryList);
      }
    }
    
    // Add filter for seller_id if provided
    if (seller_id) {
      conditions.push(`p.seller_id = $${params.length + 1}`);
      params.push(seller_id);
    }
    
    // Add conditions to query if any exist
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Add ordering
    query += ' ORDER BY p.created_at DESC';
    
    // Execute the query
    const productsResult = await pool.query(query, params);
    
    res.json(productsResult.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, details, price, condition, category, image_path } = req.body;
    
    // Validate required fields
    if (!name || !details || !price || !condition || !category || !image_path) {
      return res.status(400).json({ error: 'All fields including image are required' });
    }

    // Validate image URL format
    if (!image_path.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) && 
        !image_path.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format. Please provide a valid image URL or base64 data' });
    }
    
    const result = await pool.query(
      'INSERT INTO products (seller_id, name, details, price, condition, category, image_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user.userId, name, details, price, condition, category, image_path]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const productResult = await pool.query(
      'SELECT p.*, u.email as seller_email FROM products p JOIN users u ON p.seller_id = u.id WHERE p.id = $1',
      [req.params.id]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(productResult.rows[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Update product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, details, price, condition, category, image_path } = req.body;
    
    // Validate required fields
    if (!name || !details || !price || !condition || !category || !image_path) {
      return res.status(400).json({ error: 'All fields including image are required' });
    }

    // Validate image paths (can be multiple images separated by |)
    const imagePaths = image_path.split('|');
    for (const path of imagePaths) {
      if (!path.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) && 
          !path.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid image format. Please provide valid image URLs or base64 data' });
      }
    }
    
    // First check if product exists and user is the seller
    const productCheck = await pool.query(
      'SELECT seller_id FROM products WHERE id = $1',
      [productId]
    );
    
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Verify user is the seller of the product
    if (productCheck.rows[0].seller_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized: You can only edit your own products' });
    }
    
    // Update the product
    const result = await pool.query(
      `UPDATE products 
       SET name = $1, details = $2, price = $3, condition = $4, category = $5, image_path = $6
       WHERE id = $7
       RETURNING *`,
      [name, details, price, condition, category, image_path, productId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.userId; // Get user ID from token
    
    // First check if product exists and user is the seller
    const productCheck = await pool.query(
      'SELECT seller_id FROM products WHERE id = $1',
      [productId]
    );
    
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Verify user is the seller of the product
    if (productCheck.rows[0].seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own products' });
    }
    
    // Delete related items first to avoid foreign key constraint errors
    console.log(`Deleting related items for product ID: ${productId}`);

    // 1. Delete cart items referencing this product
    await pool.query('DELETE FROM cart_items WHERE product_id = $1', [productId]);
    console.log(`Deleted cart_items for product ${productId}`);

    // 2. Delete messages associated with chats for this product
    await pool.query(
      'DELETE FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE product_id = $1)',
      [productId]
    );
    console.log(`Deleted messages for product ${productId}`);

    // 3. Delete chats associated with this product
    await pool.query('DELETE FROM chats WHERE product_id = $1', [productId]);
    console.log(`Deleted chats for product ${productId}`);

    // 4. Delete the product itself
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    console.log(`Deleted product ${productId}`);
    
    res.json({ success: true, message: 'Product and related items deleted successfully' });
  } catch (error) {
    console.error('Error deleting product and related items:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Chat and messages API
app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { product_id, seller_id } = req.body;
    const buyer_id = req.user.userId;
    
    console.log(`Creating chat for product: ${product_id}, seller: ${seller_id}, buyer: ${buyer_id}`);
    
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    
    // If no seller_id provided, fetch it from the product
    let finalSellerId = seller_id;
    let productName = '';
    if (!finalSellerId) {
      console.log('No seller_id provided, fetching from product');
      const productResult = await pool.query(
        'SELECT seller_id, name FROM products WHERE id = $1',
        [product_id]
      );
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      finalSellerId = productResult.rows[0].seller_id;
      productName = productResult.rows[0].name;
      console.log(`Fetched seller_id: ${finalSellerId} from product`);
    } else {
      // Get product name for email
      const productResult = await pool.query(
        'SELECT name FROM products WHERE id = $1',
        [product_id]
      );
      
      if (productResult.rows.length > 0) {
        productName = productResult.rows[0].name;
      }
    }
    
    // Don't allow chats with yourself
    if (finalSellerId === buyer_id) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }
    
    // Check if chat already exists
    console.log(`Checking for existing chat with product: ${product_id}, buyer: ${buyer_id}, seller: ${finalSellerId}`);
    const existingChatResult = await pool.query(
      'SELECT * FROM chats WHERE product_id = $1 AND buyer_id = $2 AND seller_id = $3',
      [product_id, buyer_id, finalSellerId]
    );
    
    let chat;
    
    if (existingChatResult.rows.length > 0) {
      console.log('Existing chat found:', existingChatResult.rows[0].id);
      chat = existingChatResult.rows[0];
    } else {
    // Create new chat
    console.log('Creating new chat');
    const newChatResult = await pool.query(
      'INSERT INTO chats (product_id, buyer_id, seller_id) VALUES ($1, $2, $3) RETURNING *',
      [product_id, buyer_id, finalSellerId]
    );
    
      chat = newChatResult.rows[0];
      console.log('New chat created:', chat.id);
      
      // Get buyer and seller email addresses for notification
      const usersResult = await pool.query(
        'SELECT id, email FROM users WHERE id IN ($1, $2)',
        [buyer_id, finalSellerId]
      );
      
      const users = usersResult.rows.reduce((acc, user) => {
        acc[user.id] = user.email;
        return acc;
      }, {});
      
      const buyerEmail = users[buyer_id];
      const sellerEmail = users[finalSellerId];
      
      // Send email notification to seller about new buyer interest
      if (sellerEmail && process.env.EMAIL_USER) {
        try {
          await transporter.sendMail({
            from: `"Lion Bay" <${process.env.EMAIL_USER}>`,
            to: sellerEmail,
            subject: `New Interest in Your Product: ${productName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1c4587;">Lion Bay</h1>
                <p>Good news! A buyer is interested in your product "${productName}".</p>
                <p>User with email ${buyerEmail} has contacted you about this item.</p>
                <p>Please log in to Lion Bay to respond to their message.</p>
                <div style="margin-top: 20px; text-align: center;">
                  <a href="${process.env.NODE_ENV === 'production' 
                    ? (process.env.FRONTEND_URL || 'https://lionbay.org')  
                    : 'http://localhost:3000'}/chats/${chat.id}" 
                     style="background-color: #1c4587; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    View Messages
                  </a>
                </div>
              </div>
            `
          });
          
          console.log(`Notification email sent to seller ${sellerEmail}`);
        } catch (emailError) {
          console.error('Error sending seller notification email:', emailError);
          // Continue even if email fails
        }
      }
    }
    
    res.status(existingChatResult.rows.length > 0 ? 200 : 201).json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // First check if messages has a 'content' or 'message' column
    try {
      // Try a query to check the column structure
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'content'
      `);
      
      // Use appropriate query based on column existence
      const useContentColumn = columnCheck.rows.length > 0;
      
      const chatsQuery = `
        SELECT c.*, 
          p.name as product_name, p.price as product_price, p.image_path as product_image,
          u1.email as buyer_email, u2.email as seller_email,
          (SELECT MAX(created_at) FROM messages WHERE chat_id = c.id) as calculated_last_message_at,
          (SELECT ${useContentColumn ? 'content' : 'message'} FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender_id
        FROM chats c
        JOIN products p ON c.product_id = p.id
        JOIN users u1 ON c.buyer_id = u1.id
        JOIN users u2 ON c.seller_id = u2.id
        WHERE c.buyer_id = $1 OR c.seller_id = $1 
        ORDER BY calculated_last_message_at DESC NULLS LAST, c.created_at DESC
      `;
      
      const chatsResult = await pool.query(chatsQuery, [userId]);
      res.json(chatsResult.rows);
    } catch (columnError) {
      console.error('Error checking column structure:', columnError);
      // If the column check fails, use a fallback approach without referencing messages
      const fallbackQuery = `
        SELECT c.*, 
          p.name as product_name, p.price as product_price, p.image_path as product_image,
          u1.email as buyer_email, u2.email as seller_email 
        FROM chats c
        JOIN products p ON c.product_id = p.id
        JOIN users u1 ON c.buyer_id = u1.id
        JOIN users u2 ON c.seller_id = u2.id
        WHERE c.buyer_id = $1 OR c.seller_id = $1 
        ORDER BY c.created_at DESC
      `;
      
      const fallbackResult = await pool.query(fallbackQuery, [userId]);
      res.json(fallbackResult.rows);
    }
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.get('/api/chats/:id', authenticateToken, async (req, res) => {
  try {
    const chatResult = await pool.query(
      `SELECT c.*, 
        p.name as product_name, p.image_path as product_image, p.price as product_price,
        u1.email as buyer_email, u2.email as seller_email
      FROM chats c
      JOIN products p ON c.product_id = p.id
      JOIN users u1 ON c.buyer_id = u1.id
      JOIN users u2 ON c.seller_id = u2.id
      WHERE c.id = $1`,
      [req.params.id]
    );
    
    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const chat = chatResult.rows[0];
    
    // Ensure user is authorized to access this chat
    if (chat.buyer_id !== req.user.userId && chat.seller_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized access to chat' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

app.get('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    
    // Verify user has access to chat
    const chatResult = await pool.query(
      'SELECT * FROM chats WHERE id = $1',
      [chatId]
    );
    
    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const chat = chatResult.rows[0];
    
    // Ensure user is authorized to access this chat
    if (chat.buyer_id !== req.user.userId && chat.seller_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized access to messages' });
    }
    
    const messagesResult = await pool.query(
      `SELECT m.*, u.email as sender_email 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1 
      ORDER BY m.created_at ASC`,
      [chatId]
    );
    
    res.json(messagesResult.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Delete a specific chat and its messages, also remove from cart if it was added
app.delete('/api/chats/:id', authenticateToken, async (req, res) => {
  console.log(`[DeleteChat] Attempting to delete chat ID: ${req.params.id} by user ID: ${req.user.userId}`); // Log entry
  try {
    const chatId = req.params.id;
    const userId = req.user.userId;
    
    // Verify chat exists and the user has access to it
    const chatResult = await pool.query(
      'SELECT * FROM chats WHERE id = $1',
      [chatId]
    );
    
    if (chatResult.rows.length === 0) {
      console.log(`[DeleteChat] Chat not found for ID: ${chatId}`);
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const chat = chatResult.rows[0];
    console.log(`[DeleteChat] Chat data: ${JSON.stringify(chat)}`);
    console.log(`[DeleteChat] Comparing userId (${userId}) with chat.buyer_id (${chat.buyer_id}) and chat.seller_id (${chat.seller_id})`);
    
    // Ensure user is authorized to delete this chat (must be buyer or seller)
    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      console.log(`[DeleteChat] User ${userId} is NOT authorized to delete chat ${chatId}. Authorization failed.`);
      return res.status(403).json({ error: 'Unauthorized to delete this chat' });
    }
    console.log(`[DeleteChat] User ${userId} IS authorized to delete chat ${chatId}.`);
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // 1. Delete associated cart items (if user is the buyer AND cart is linked by product_id)
      // This existing logic might be for a different type of cart association.
      if (chat.buyer_id === userId) {
        console.log(`[DeleteChat] User ${userId} is buyer, attempting to delete cart_items by user_id and product_id ${chat.product_id}`);
        await pool.query(
          'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
          [userId, chat.product_id]
        );
      }

      // 1b. NEW: Delete any cart_items directly referencing this chat_id
      // This addresses the cart_items_chat_id_fkey constraint.
      console.log(`[DeleteChat] Deleting cart_items directly linked to chat_id ${chatId}`);
      const cartDeleteResult = await pool.query('DELETE FROM cart_items WHERE chat_id = $1 RETURNING id', [chatId]);
      console.log(`[DeleteChat] Deleted ${cartDeleteResult.rowCount} cart_items linked by chat_id.`);
      
      // 2. Delete all messages in the chat
      await pool.query(
        'DELETE FROM messages WHERE chat_id = $1',
        [chatId]
      );
      
      // 3. Delete the chat itself
      await pool.query(
        'DELETE FROM chats WHERE id = $1',
        [chatId]
      );
      
      // Commit the transaction
      await pool.query('COMMIT');
      
      // Notify both users involved in the chat via Socket.IO
      if (io) { // Ensure io is defined
        console.log(`Emitting chat_deleted event for chat ${chatId} to buyer ${chat.buyer_id} and seller ${chat.seller_id}`);
        io.to(chat.buyer_id).emit('chat_deleted', { chatId });
        io.to(chat.seller_id).emit('chat_deleted', { chatId });
      } else {
        console.warn('Socket.IO (io) is not defined. Cannot emit chat_deleted event.');
      }

      res.json({ 
        success: true, 
        message: 'Chat and all associated messages have been deleted successfully' 
      });
    } catch (err) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Endpoint to mark a chat payment as completed (now a full "complete deal" flow)
app.post('/api/chats/:id/complete-payment', authenticateToken, async (req, res) => {
  const completingChatId = req.params.id;
  const userId = req.user.userId;
  console.log(`[CompleteDealFlow] Received request for chat ID: ${completingChatId}, User ID: ${userId}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[CompleteDealFlow] Transaction started.');

    const completingChatResult = await client.query('SELECT * FROM chats WHERE id = $1', [completingChatId]);
    if (completingChatResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chat not found' });
    }
    const completingChat = completingChatResult.rows[0];
    const productId = completingChat.product_id;

    // Determine role of the user initiating the request for THIS specific chat
    const isSellerOfThisChat = completingChat.seller_id === userId;
    const isBuyerOfThisChat = completingChat.buyer_id === userId;

    if (!isSellerOfThisChat && !isBuyerOfThisChat) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized to modify this chat' });
    }

    if (isSellerOfThisChat) {
      // SELLER'S ACTION: Full "Complete Deal" logic
      console.log(`[CompleteDealFlow] Seller ${userId} is completing the deal for product ${productId}.`);

      const productResult = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found, cannot complete deal.' });
      }

      console.log(`[CompleteDealFlow] SKIPPING archive product ID ${productId} to SoldProducts for seller action.`);

      const allChatsForProductResult = await client.query('SELECT id, buyer_id, seller_id FROM chats WHERE product_id = $1', [productId]);
      const chatsToDelete = allChatsForProductResult.rows;
      const chatIdsToDelete = chatsToDelete.map(c => c.id);
      console.log(`[CompleteDealFlow] Seller action: Found ${chatsToDelete.length} chats to delete for product ${productId}.`);

      let messagesDeletedCount = 0;
      if (chatIdsToDelete.length > 0) {
        await client.query('DELETE FROM cart_items WHERE chat_id = ANY($1::uuid[])', [chatIdsToDelete]);
        console.log(`[CompleteDealFlow] Seller action: Deleted cart_items linked to specific chats for product ${productId}.`);
        
        const deleteMessagesResult = await client.query('DELETE FROM messages WHERE chat_id = ANY($1::uuid[]) RETURNING id', [chatIdsToDelete]);
        messagesDeletedCount = deleteMessagesResult.rowCount;
        console.log(`[CompleteDealFlow] Seller action: Deleted ${messagesDeletedCount} messages for product ${productId}.`);

        await client.query('DELETE FROM chats WHERE id = ANY($1::uuid[])', [chatIdsToDelete]);
        console.log(`[CompleteDealFlow] Seller action: Deleted ${chatIdsToDelete.length} chat records for product ${productId}.`);
      }

      console.log(`[CompleteDealFlow] Seller action: Deleting all cart_items for product ID ${productId}.`);
      const productCartDeleteResult = await client.query('DELETE FROM cart_items WHERE product_id = $1 RETURNING id', [productId]);
      console.log(`[CompleteDealFlow] Seller action: Deleted ${productCartDeleteResult.rowCount} cart_items linked directly to product ${productId}.`);

      console.log(`[CompleteDealFlow] Seller action: Deleting product ID ${productId} from Products table.`);
      await client.query('DELETE FROM products WHERE id = $1', [productId]);
      
      await client.query('COMMIT');
      console.log('[CompleteDealFlow] Seller action: Transaction committed.');

      if (io && chatIdsToDelete.length > 0) {
        chatsToDelete.forEach(chatInfo => {
          io.to(chatInfo.buyer_id.toString()).emit('chat_deleted', { chatId: chatInfo.id, productId: productId });
          io.to(chatInfo.seller_id.toString()).emit('chat_deleted', { chatId: chatInfo.id, productId: productId });
        });
      }
      return res.json({
        success: true,
        message: 'Deal completed by seller. Product removed and all associated chats cleared. (Archiving skipped)',
        action: 'seller_deal_completed',
        productIdDeleted: productId,
        chatsDeletedCount: chatIdsToDelete.length,
        messagesDeletedCount
      });

    } else if (isBuyerOfThisChat) {
      // BUYER'S ACTION: Mark chat as buyer_requested_completion, send system message, and email seller.
      console.log(`[CompleteDealFlow] Buyer ${userId} is requesting completion for chat ${completingChatId}.`);

      // Get current chat state to see if buyer already requested completion
      // Use the already fetched completingChat object which is effectively currentChatBeforeUpdate for this check
      if (completingChat.buyer_requested_completion) {
        await client.query('COMMIT'); // Ensure transaction is properly closed
        console.log(`[CompleteDealFlow] Buyer action: Completion already requested for chat ${completingChatId}.`);
        return res.json({
          success: true,
          message: 'You have already requested to complete this deal.',
          action: 'buyer_completion_already_requested',
          chat: completingChat // Send the current chat state
        });
      }

      // If we reach here, buyer_requested_completion is false, so proceed with update and notification.

      // 1. Update chat to mark buyer_requested_completion = true
      const updatedChatResult = await client.query(
        'UPDATE chats SET buyer_requested_completion = TRUE WHERE id = $1 RETURNING *',
        [completingChatId]
      );
      if (updatedChatResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Chat not found or could not be updated.' });
      }
      const updatedChat = updatedChatResult.rows[0];
      console.log('[CompleteDealFlow] Buyer action: Chat updated to buyer_requested_completion=true.');

      // 2. Create and send the system message
      const systemMessageContent = "🟡 The buyer has requested to complete the transaction. If you\'ve received payment, click Complete Deal to mark the item as sold.";
      const systemMessageResult = await client.query(
        'INSERT INTO messages (chat_id, sender_id, content, is_system_message) VALUES ($1, $2, $3, TRUE) RETURNING *',
        [completingChatId, userId, systemMessageContent]
      );
      const systemMessage = systemMessageResult.rows[0];
      console.log('[CompleteDealFlow] Buyer action: System message created.', JSON.stringify(systemMessage));
      
      // ---- START EMAIL NOTIFICATION LOGIC ----
      try {
        const sellerResult = await pool.query('SELECT email FROM users WHERE id = $1', [updatedChat.seller_id]);
        if (sellerResult.rows.length > 0) {
          const sellerEmail = sellerResult.rows[0].email;
          const frontendUrl = process.env.FRONTEND_URL || 'https://lionbay.org'; // Fallback URL
          const chatLink = `${frontendUrl}/chats/${completingChatId}`;
          
          const mailOptions = {
            from: process.env.EMAIL_USER, // Sender address
            to: sellerEmail, // List of receivers
            subject: 'Buyer Requested to Complete the Deal on LionBay', // Subject line
            html: `
              <p>A buyer has requested to complete the deal for one of your listings, "${updatedChat.product_name}", indicating they have paid.</p>
              <p>Please log in to your LionBay account to confirm that you've received payment and click "Complete Deal" to mark the item as sold.</p>
              <p><a href="${chatLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px;">View Deal / Go to Chat</a></p>
              <br>
              <p>Listing: ${updatedChat.product_name}</p>
              <p>If you did not expect this, please ignore this email or contact support.</p>
            `
          };

          if (transporter) { // Check if transporter is configured
            await transporter.sendMail(mailOptions);
            console.log(`[CompleteDealFlow] Buyer action: Email notification sent to seller ${sellerEmail} for chat ${completingChatId}.`);
          } else {
            console.warn(`[CompleteDealFlow] Buyer action: Email transporter not configured. Skipping email to ${sellerEmail} for chat ${completingChatId}.`);
          }
        } else {
          console.error(`[CompleteDealFlow] Buyer action: Could not find seller email for seller_id ${updatedChat.seller_id}.`);
        }
      } catch (emailError) {
        console.error(`[CompleteDealFlow] Buyer action: Failed to send email notification for chat ${completingChatId}:`, emailError);
        // Do not rollback or fail the request due to email error
      }
      // ---- END EMAIL NOTIFICATION LOGIC ----

      await client.query('COMMIT');
      console.log('[CompleteDealFlow] Buyer action: Transaction committed.');

      // 3. Emit new_message event for the system message
      if (io) {
        const senderResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        const formattedSystemMessage = {
          ...systemMessage,
          sender_email: senderResult.rows[0]?.email || 'system'
        };
        io.to(completingChatId.toString()).emit('new_message', formattedSystemMessage);
        console.log('[CompleteDealFlow] Buyer action: new_message event emitted for system message.');
      }
      
      // 4. Emit an event to specifically update chat state on clients, including the new buyer_requested_completion flag
      if (io) {
          io.to(updatedChat.buyer_id.toString()).emit('chat_updated', updatedChat);
          io.to(updatedChat.seller_id.toString()).emit('chat_updated', updatedChat);
          console.log('[CompleteDealFlow] Buyer action: chat_updated event emitted.');
      }

      return res.json({
        success: true,
        message: 'Request to complete deal sent to seller.',
        action: 'buyer_completion_requested',
        chat: updatedChat
      });
    }

  } catch (error) {
    if (client) { 
      await client.query('ROLLBACK');
      console.log('[CompleteDealFlow] Transaction rolled back due to error.');
    }
    console.error(`[CompleteDealFlow] Error for chat ID ${completingChatId}:`, error.message, error.stack);
    res.status(500).json({ error: 'Failed to process request.', details: error.message });
  } finally {
    if (client) {
      client.release();
      console.log('[CompleteDealFlow] Database client released.');
    }
  }
});

// We're removing the unread-count endpoint and implementing it client-side

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chat_id = req.params.id;
    const sender_id = req.user.userId;
    const { content } = req.body;
    
    // Verify chat exists and user has access
    const chatResult = await pool.query(
      'SELECT * FROM chats WHERE id = $1',
      [chat_id]
    );
    
    if (chatResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const chat = chatResult.rows[0];
    
    // Ensure user is authorized to send message in this chat
    if (chat.buyer_id !== sender_id && chat.seller_id !== sender_id) {
      return res.status(403).json({ error: 'Unauthorized to send message' });
    }
    
    // Create new message 
    const newMessageResult = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, content) 
      VALUES ($1, $2, $3) 
      RETURNING *`,
      [chat_id, sender_id, content]
    );
    
    // Get the sender email
    const senderResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [sender_id]
    );
    
    const newMessage = {
      ...newMessageResult.rows[0],
      sender_email: senderResult.rows[0].email
    };
    
    // Emit new message event to socket
    io.to(chat_id).emit('new_message', newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Cart API Endpoints
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all cart items for the user with product and chat details
    const cartResult = await pool.query(
      `SELECT ci.*, 
        p.name as product_name, p.price as product_price, p.image_path as product_image, p.condition as product_condition,
        p.seller_id, u.email as seller_email,
        c.id as chat_id
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN users u ON p.seller_id = u.id
      LEFT JOIN chats c ON ci.chat_id = c.id
      WHERE ci.user_id = $1
      ORDER BY ci.added_at DESC`,
      [userId]
    );
    
    res.json(cartResult.rows);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ error: 'Failed to fetch cart items' });
  }
});

// Add new endpoint to get cart count
app.get('/api/cart/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get count of cart items for the user
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM cart_items WHERE user_id = $1',
      [userId]
    );
    
    res.json({ count: parseInt(countResult.rows[0].count) });
  } catch (error) {
    console.error('Error fetching cart count:', error);
    res.status(500).json({ error: 'Failed to fetch cart count' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { product_id, cart_type, chat_id } = req.body;
    const user_id = req.user.userId;
    
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    
    if (!['CONTACTED', 'CART_ONLY'].includes(cart_type)) {
      return res.status(400).json({ error: 'Invalid cart type. Must be CONTACTED or CART_ONLY' });
    }
    
    // Check if product exists
    const productResult = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [product_id]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Don't allow adding your own products to cart
    if (productResult.rows[0].seller_id === user_id) {
      return res.status(400).json({ error: 'Cannot add your own product to cart' });
    }
    
    // Check if item is already in cart - if yes, update it
    const existingCartItem = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [user_id, product_id]
    );
    
    if (existingCartItem.rows.length > 0) {
      // Update the existing cart item
      const updatedItem = await pool.query(
        'UPDATE cart_items SET cart_type = $1, chat_id = $2 WHERE user_id = $3 AND product_id = $4 RETURNING *',
        [cart_type, chat_id, user_id, product_id]
      );
      
      return res.json(updatedItem.rows[0]);
    }
    
    // Add new item to cart
    const result = await pool.query(
      'INSERT INTO cart_items (user_id, product_id, cart_type, chat_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, product_id, cart_type, chat_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const cartItemId = req.params.id;
    const userId = req.user.userId;
    
    // Verify the cart item belongs to the user
    const cartItemCheck = await pool.query(
      'SELECT * FROM cart_items WHERE id = $1 AND user_id = $2',
      [cartItemId, userId]
    );
    
    if (cartItemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found or not authorized' });
    }
    
    // Delete the cart item
    await pool.query(
      'DELETE FROM cart_items WHERE id = $1',
      [cartItemId]
    );
    
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

app.put('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const cartItemId = req.params.id;
    const userId = req.user.userId;
    const { cart_type, chat_id } = req.body;
    
    if (!['CONTACTED', 'CART_ONLY'].includes(cart_type)) {
      return res.status(400).json({ error: 'Invalid cart type. Must be CONTACTED or CART_ONLY' });
    }
    
    // Verify the cart item belongs to the user
    const cartItemCheck = await pool.query(
      'SELECT * FROM cart_items WHERE id = $1 AND user_id = $2',
      [cartItemId, userId]
    );
    
    if (cartItemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found or not authorized' });
    }
    
    // Update the cart item
    const result = await pool.query(
      'UPDATE cart_items SET cart_type = $1, chat_id = $2 WHERE id = $3 RETURNING *',
      [cart_type, chat_id, cartItemId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

// Admin API
app.get('/api/admin/dashboard', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Get user stats
    const userStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_last_week
      FROM users
    `);
    
    // Get product stats
    const productStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_products_last_week
      FROM products
    `);
    
    // Get chat stats
    const chatStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_chats,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_chats_last_week
      FROM chats
    `);
    
    // Get message stats
    const messageStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_messages_last_week
      FROM messages
    `);
    
    // Get recent users
    const recentUsersResult = await pool.query(`
      SELECT id, email, email_verified, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    // Get recent products
    const recentProductsResult = await pool.query(`
      SELECT p.id, p.name, p.price, p.category, p.created_at, u.email as seller_email
      FROM products p
      JOIN users u ON p.seller_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    
    res.json({
      stats: {
        users: userStatsResult.rows[0],
        products: productStatsResult.rows[0],
        chats: chatStatsResult.rows[0],
        messages: messageStatsResult.rows[0]
      },
      recentUsers: recentUsersResult.rows,
      recentProducts: recentProductsResult.rows
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch admin dashboard data' });
  }
});

// Admin verification code bypass
app.get('/api/admin/verification-code/:email', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email } = req.params;
    
    const userResult = await pool.query(
      'SELECT verification_code FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      email, 
      verificationCode: userResult.rows[0].verification_code 
    });
  } catch (error) {
    console.error('Error fetching verification code:', error);
    res.status(500).json({ error: 'Failed to fetch verification code' });
  }
});

// Admin help messages
app.post('/api/admin/help-messages', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const user_id = req.user.userId;
    
    const result = await pool.query(
      'INSERT INTO help_messages (user_id, message, is_from_admin) VALUES ($1, $2, $3) RETURNING *',
      [user_id, message, false]
    );
    
    // Notify admins via socket about new help message
    io.to('admin-room').emit('new_help_message', {
      ...result.rows[0],
      user_email: req.user.email
    });
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating help message:', error);
    res.status(500).json({ error: 'Failed to send help message' });
  }
});

app.get('/api/admin/help-messages', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId;
    const isUserAdmin = checkAdmin(req.user.email);
    
    let query;
    let params;
    
    if (isUserAdmin) {
      // Admins can see all help messages with user details
      query = `
        SELECT hm.*, u.email as user_email, response_user.email as admin_email
        FROM help_messages hm
        JOIN users u ON hm.user_id = u.id
        LEFT JOIN users response_user ON hm.is_from_admin = true AND hm.user_id = response_user.id
        ORDER BY hm.created_at DESC
      `;
      params = [];
    } else {
      // Regular users can only see their own messages
      query = `
        SELECT hm.*, u.email as user_email, response_user.email as admin_email
        FROM help_messages hm
        JOIN users u ON hm.user_id = u.id
        LEFT JOIN users response_user ON hm.is_from_admin = true AND hm.user_id = response_user.id
        WHERE hm.user_id = $1 OR (hm.is_from_admin = true AND hm.to_user_id = $1)
        ORDER BY hm.created_at DESC
      `;
      params = [user_id];
    }
    
    const result = await pool.query(query, params);
    
    // Group messages by conversation
    const conversations = {};
    
    for (const message of result.rows) {
      const conversationUserId = message.is_from_admin ? message.to_user_id : message.user_id;
      
      if (!conversations[conversationUserId]) {
        conversations[conversationUserId] = {
          userId: conversationUserId,
          userEmail: message.is_from_admin ? null : message.user_email,
          messages: []
        };
      }
      
      // If we don't have the user's email yet, and this is from the user, add it
      if (!conversations[conversationUserId].userEmail && !message.is_from_admin) {
        conversations[conversationUserId].userEmail = message.user_email;
      }
      
      conversations[conversationUserId].messages.push(message);
    }
    
    // For admins, return a structured response with conversations
    if (isUserAdmin) {
      res.json({
        conversations: Object.values(conversations),
        allMessages: result.rows
      });
    } else {
      // For regular users, just return their messages
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching help messages:', error);
    res.status(500).json({ error: 'Failed to fetch help messages' });
  }
});

app.post('/api/admin/respond-help', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { message, to_user_id } = req.body;
    const admin_id = req.user.userId;
    
    const result = await pool.query(
      'INSERT INTO help_messages (user_id, to_user_id, message, is_from_admin) VALUES ($1, $2, $3, $4) RETURNING *',
      [admin_id, to_user_id, message, true]
    );
    
    // Notify the user about admin response
    io.to(to_user_id).emit('admin_response', result.rows[0]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating admin response:', error);
    res.status(500).json({ error: 'Failed to send admin response' });
  }
});

// Clear all chats and messages
app.delete('/api/chats/clear-all', authenticateToken, isAdmin, async (req, res) => {
  try {
    // First delete all messages
    await pool.query('DELETE FROM messages');
    
    // Then delete all chats
    await pool.query('DELETE FROM chats');
    
    console.log('All chats and messages cleared by admin:', req.user.email);
    
    res.status(200).json({ 
      success: true, 
      message: 'All chats and messages have been cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing chats and messages:', error);
    res.status(500).json({ error: 'Failed to clear chats and messages' });
  }
});

// Add endpoint to get admin emails
app.get('/api/admin/emails', async (req, res) => {
  try {
    const adminEmails = getAdminEmails();
    res.json({ emails: adminEmails });
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    res.status(500).json({ error: 'Failed to fetch admin emails' });
  }
});

// Add admin endpoint to manually clean up inactive chats
app.post('/api/admin/cleanup-chats', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('Admin-triggered chat cleanup started by:', req.user.email);
    
    const result = await cleanupInactiveChats();
    
    console.log('Admin-triggered chat cleanup complete:', result);
    
    res.json({
      success: true,
      message: 'Chat cleanup completed successfully',
      ...result
    });
  } catch (error) {
    console.error('Error in admin chat cleanup:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clean up chats',
      message: error.message
    });
  }
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid token'));
    
    // Add user data to socket
    socket.user = decoded;
    
    // Continue
    next();
  });
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} for user ${socket.user.userId}`);
  
  // Check if user is admin and join admin room
  if (checkAdmin(socket.user.email)) {
    socket.join('admin-room');
    console.log(`Admin ${socket.user.email} joined admin-room`);
  }
  
  // Join personal room for direct messages
  socket.join(socket.user.userId);
  console.log(`User ${socket.user.email} joined personal room ${socket.user.userId}`);
  
  // Handle joining a chat room
  socket.on('join_chat', (chatId) => {
    if (!chatId) return;
    
    const roomName = chatId;
    console.log(`User ${socket.user.userId} joining room: ${roomName}`);
    socket.join(roomName);
  });
  
  // Handle sending a message
  socket.on('send_message', async (data) => {
    try {
      const { chat_id, message } = data;
      
      if (!chat_id || !message) {
        socket.emit('error', 'Chat ID and message are required');
        return;
      }
      
      console.log(`Message received from user ${socket.user.userId} in chat ${chat_id}: ${message.content}`);
      
      // Verify the user is a participant in this chat
      const chatResult = await pool.query(
        'SELECT * FROM chats WHERE id = $1',
        [chat_id]
      );
      
      if (chatResult.rows.length === 0) {
        socket.emit('error', 'Chat not found');
        return;
      }
      
      const chat = chatResult.rows[0];
      
      // Check if user is authorized to send messages in this chat
      if (chat.buyer_id !== socket.user.userId && chat.seller_id !== socket.user.userId) {
        socket.emit('error', 'Unauthorized to send messages in this chat');
        return;
      }
      
      // Insert the message into the database
      const newMessageResult = await pool.query(
        'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
        [chat_id, socket.user.userId, message.content]
      );
      
      // Get sender email
      const senderResult = await pool.query(
        'SELECT email FROM users WHERE id = $1',
        [socket.user.userId]
      );
      
      // Format the message with sender info
      const formattedMessage = {
        ...newMessageResult.rows[0],
        sender_email: senderResult.rows[0].email,
        created_at: new Date().toISOString() // Use current time for immediate display
      };
      
      // Broadcast the message to all clients in the room
      console.log(`Broadcasting message to room: ${chat_id}`);
      io.to(chat_id).emit('new_message', formattedMessage);
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', 'Server error processing message');
    }
  });
  
  // Handle help messages
  socket.on('send_help_message', async (data) => {
    try {
      const { message } = data;
      
      if (!message) {
        socket.emit('error', 'Message is required');
        return;
      }
      
      console.log(`Help message received from user ${socket.user.userId} (${socket.user.email}): ${message}`);
      
      // Insert the help message into the database
      const result = await pool.query(
        'INSERT INTO help_messages (user_id, message, is_from_admin) VALUES ($1, $2, $3) RETURNING *',
        [socket.user.userId, message, false]
      );
      
      // Get complete user data to include email
      const newMessage = result.rows[0];
      
      // Get the user's email
      const userResult = await pool.query(
        'SELECT email FROM users WHERE id = $1',
        [socket.user.userId]
      );
      
      // Format message with user email
      const formattedMessage = {
        ...newMessage,
        user_email: userResult.rows[0].email
      };
      
      // Notify admins about new help message
      console.log(`Broadcasting help message to admin room: ${message}`);
      io.to('admin-room').emit('new_help_message', formattedMessage);
      
      // Send confirmation to the user
      socket.emit('help_message_sent', formattedMessage);
    } catch (error) {
      console.error('Error processing help message:', error);
      socket.emit('error', 'Server error processing help message');
    }
  });
  
  // Handle admin responses to help messages
  socket.on('send_admin_response', async (data) => {
    try {
      const { message, to_user_id } = data;
      
      if (!message || !to_user_id) {
        socket.emit('error', 'Message and recipient user ID are required');
        return;
      }
      
      // Verify sender is an admin
      if (!checkAdmin(socket.user.email)) {
        socket.emit('error', 'Unauthorized: Only admins can send admin responses');
        return;
      }
      
      console.log(`Admin response from ${socket.user.email} to user ${to_user_id}: ${message}`);
      
      // Insert the admin response into the database
      const result = await pool.query(
        'INSERT INTO help_messages (user_id, to_user_id, message, is_from_admin) VALUES ($1, $2, $3, $4) RETURNING *',
        [socket.user.userId, to_user_id, message, true]
      );
      
      // Get admin email and user email
      const adminResult = await pool.query('SELECT email FROM users WHERE id = $1', [socket.user.userId]);
      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [to_user_id]);
      
      // Format response with additional data
      const formattedResponse = {
        ...result.rows[0],
        admin_email: adminResult.rows[0].email,
        to_user_email: userResult.rows[0].email
      };
      
      // Send the response to the specific user's room
      console.log(`Emitting admin_response to user ${to_user_id}`);
      io.to(to_user_id).emit('admin_response', formattedResponse);
      
      // Also send to all admins to keep them in sync
      io.to('admin-room').emit('admin_response_sent', formattedResponse);
      
      // Confirm to the sending admin
      socket.emit('admin_response_confirmed', formattedResponse);
    } catch (error) {
      console.error('Error processing admin response:', error);
      socket.emit('error', 'Server error processing admin response');
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Check multiple possible locations for index.html
  const possibleIndexPaths = [
    path.join(__dirname, '../dist/index.html'),
    path.join(__dirname, '../../dist/index.html'),
    path.join(__dirname, '../../marketCU/dist/index.html'),
    path.join(process.cwd(), 'dist/index.html'),
    path.join(process.cwd(), 'marketCU/dist/index.html')
  ];
  
  // Try each path in order
  for (const indexPath of possibleIndexPaths) {
    if (fs.existsSync(indexPath)) {
      console.log('Serving index.html from:', indexPath);
      return res.sendFile(indexPath);
    }
  }
  
  // Try to use the fallback HTML
  const fallbackPath = path.join(__dirname, 'fallback-index.html');
  if (fs.existsSync(fallbackPath)) {
    console.log('No frontend build found! Serving fallback index.html');
    return res.sendFile(fallbackPath);
  }
  
  // If no index.html found, return debugging info
  const dirs = [
    path.join(__dirname, '..'),
    path.join(__dirname, '../..'),
    process.cwd()
  ];
  
  const debugInfo = {
    error: 'Frontend build not found',
    searchedPaths: possibleIndexPaths,
    currentDirectory: process.cwd(),
    directoryContents: {}
  };
  
  // Get directory listings for debugging
  dirs.forEach(dir => {
    try {
      debugInfo.directoryContents[dir] = fs.readdirSync(dir);
    } catch (err) {
      debugInfo.directoryContents[dir] = `Error: ${err.message}`;
    }
  });
  
  res.status(404).json(debugInfo);
});

// Schedule daily cleanup of inactive chats (midnight every day)
const scheduleCleanup = () => {
  const now = new Date();
  
  // Calculate time until midnight
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const timeUntilMidnight = midnight.getTime() - now.getTime();
  
  console.log(`Scheduling chat cleanup to run in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`);
  
  // Schedule first run
  setTimeout(async () => {
    try {
      console.log('Running scheduled chat cleanup');
      const result = await cleanupInactiveChats();
      console.log('Chat cleanup complete:', result);
      
      // Schedule next run in 24 hours
      setInterval(async () => {
        try {
          console.log('Running daily chat cleanup');
          const result = await cleanupInactiveChats();
          console.log('Chat cleanup complete:', result);
        } catch (error) {
          console.error('Error in scheduled chat cleanup:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    } catch (error) {
      console.error('Error in initial chat cleanup:', error);
    }
  }, timeUntilMidnight);
};

// Call the function to schedule cleanup
scheduleCleanup();

// Get user profile data
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      `SELECT 
        full_name,
        email,
        class_year,
        major,
        phone_number,
        bio,
        profile_image
      FROM users 
      WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    const profile = result.rows[0];
    res.json({
      fullName: profile.full_name,
      email: profile.email,
      classYear: profile.class_year,
      major: profile.major,
      phoneNumber: profile.phone_number,
      bio: profile.bio,
      profileImage: profile.profile_image
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Add this before any other routes
app.get('/', (req, res) => {
  res.json({ message: 'Server is running', status: 'ok' });
});

// Email verification endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    
    if (!email || !verificationCode) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    
    // Find user by email and verification code
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND verification_code = $2',
      [email, verificationCode]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    const user = userResult.rows[0];
    
    // Update user's email_verified status
    await pool.query(
      'UPDATE users SET email_verified = true, verification_code = NULL WHERE id = $1',
      [user.id]
    );
    
    // Generate new JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        email_verified: true
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// In-memory store for rate limiting verification code requests
// Structure: { email: [timestamp1, timestamp2, ...], ... }
const verificationRequests = {};
const RATE_LIMIT_WINDOW = 20 * 60 * 1000; // 20 minutes in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 5;

// Send verification code endpoint - WITH RATE LIMITING
app.post('/api/auth/send-verification', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  // --- Rate Limiting Logic Start ---
  const now = Date.now();
  const userTimestamps = verificationRequests[email] || [];
  
  // Filter out timestamps older than the window
  const recentTimestamps = userTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  
  if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`Rate limit exceeded for email: ${email}`);
    // Calculate time until next request is allowed
    const oldestRecentTimestamp = Math.min(...recentTimestamps);
    const timeWaited = now - oldestRecentTimestamp;
    const timeLeft = RATE_LIMIT_WINDOW - timeWaited;
    const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
    
    return res.status(429).json({
      error: `Too many verification requests. Please wait ${minutesLeft} minute(s) before trying again.`,
      retryAfterMinutes: minutesLeft
    });
  }
  // --- Rate Limiting Logic End ---

  try {
    // Check if email is a Columbia email
    if (!email.endsWith('@columbia.edu')) {
      return res.status(400).json({ error: 'Only Columbia University emails are allowed' });
    }
    
    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    let userId;
    
    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await pool.query(
        'INSERT INTO users (email, verification_code) VALUES ($1, $2) RETURNING id',
        [email, verificationCode]
      );
      userId = newUserResult.rows[0].id;
    } else {
      // Update existing user's verification code
      userId = userResult.rows[0].id;
      await pool.query(
        'UPDATE users SET verification_code = $1 WHERE id = $2',
        [verificationCode, userId]
      );
    }
    
    // Send email with verification code if transporter is configured
    if (transporter) {
      const mailOptions = {
        from: `"Lion Bay" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Lion Bay Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h1 style="color: #1c4587; text-align: center;">Lion Bay</h1>
            <p style="font-size: 16px;">Hello,</p>
            <p style="font-size: 16px;">Your verification code is:</p>
            <p style="font-size: 24px; font-weight: bold; text-align: center; background-color: #f0f0f0; padding: 10px; border-radius: 4px; letter-spacing: 2px;">
              ${verificationCode}
            </p>
            <p style="font-size: 16px;">This code will expire in 10 minutes. Please enter it on the login page to complete your sign-in.</p>
            <p style="font-size: 14px; color: #666;">If you did not request this code, please ignore this email.</p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent successfully to ${email}`);
        
        // Record the successful request timestamp AFTER sending the email
        verificationRequests[email] = [...recentTimestamps, now];
        
        res.json({
          success: true,
          message: 'Verification code sent successfully to your email.'
        });
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        // Return a generic error to the user, but log the details
        res.status(500).json({ error: 'Failed to send verification code email. Please try again later.' });
      }
    } else {
      // If email sending is disabled, return code in development for testing
      console.warn('Email sending is disabled. Returning code in response (dev only).');
      const response = {
        success: true,
        message: 'Verification code generated (email sending disabled)'
      };
      
      if (process.env.NODE_ENV !== 'production') {
        response.code = verificationCode;
      }
      
      // Record the successful request timestamp even if email is disabled (for testing the limit)
      verificationRequests[email] = [...recentTimestamps, now];
      
      res.json(response);
    }

  } catch (error) {
    console.error('Error in send-verification endpoint processing:', error);
    res.status(500).json({ error: 'Failed to process verification request' });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 