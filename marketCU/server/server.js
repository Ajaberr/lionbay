// Load environment variables from Render
const express = require('express');
const cors = require('cors');
const { Client, Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { addApiTestEndpoints } = require('./api-test');
const { cleanupInactiveChats } = require('./chatCleanup');

const app = express();
const server = http.createServer(app);

// Debug Render environment variables
console.log('Render Environment Variables:');
console.log('RENDER:', process.env.RENDER);
console.log('RENDER_EXTERNAL_URL:', process.env.RENDER_EXTERNAL_URL);
console.log('RENDER_SERVICE_NAME:', process.env.RENDER_SERVICE_NAME);
console.log('RENDER_SERVICE_TYPE:', process.env.RENDER_SERVICE_TYPE);
console.log('RENDER_INSTANCE_ID:', process.env.RENDER_INSTANCE_ID);

// Debug application environment variables
console.log('Environment Variables Check:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configured' : 'Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Configured' : 'Missing');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Configured' : 'Missing');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Configured' : 'Missing');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL);
console.log('ADMIN_EMAILS:', process.env.ADMIN_EMAILS ? 'Configured' : 'Missing');

// Environment variable validation and fallbacks
const requiredEnvVars = {
  PORT: process.env.PORT || 10000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS
};

// Validate required environment variables
const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value && key !== 'PORT' && key !== 'NODE_ENV')
  .map(([key]) => key);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// API Base URL configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.RENDER_EXTERNAL_URL || 'https://lionbay-api.onrender.com'
  : 'http://localhost:10000';

console.log('API Base URL:', API_BASE_URL);

// Improved CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3003',
  'https://lionbay-api.onrender.com',
  'https://lionbay.com',
  process.env.RENDER_EXTERNAL_URL,
  process.env.FRONTEND_URL
].filter(Boolean); // Remove any undefined values

console.log('Allowed CORS origins:', allowedOrigins);

// Configure CORS with more detailed options
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log(`CORS blocked request from origin: ${origin}`);
      return callback(null, false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Origin:', req.headers.origin);
  next();
});

// Configure Socket.IO with CORS settings
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 20000
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug current working directory and paths
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Use the correct build path for Render
const distPath = path.join(process.cwd(), 'dist');
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
}

// Initialize PostgreSQL pool with SSL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL connection
  }
});

// Test database connection on startup
pool.connect((err, client, done) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Successfully connected to the database');
    done();
  }
});

// Add API test endpoints for easier debugging
addApiTestEndpoints(app, pool);

// Initialize Resend client with error handling
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Update email configuration to handle production environment
const emailConfig = {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  debug: process.env.NODE_ENV === 'development',
  logger: true
};

// Create a nodemailer transporter with proper configuration
const transporter = nodemailer.createTransport(emailConfig);

// Verify the transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to send messages');
  }
});

// Test endpoint for email functionality
app.get('/api/test-email', async (req, res) => {
  try {
    console.log('Attempting to send test email');
    
    const info = await transporter.sendMail({
      from: `"Lion Bay Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Lion Bay Email Test',
      html: '<h1>Test Email</h1><p>This is a test email from Lion Bay.</p>'
    });
    
    console.log('Test email sent successfully:', info.messageId);
    res.status(200).json({ 
      message: 'Test email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Test email error details:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response
    });
    res.status(500).json({ 
      error: 'Failed to send test email',
      message: error.message,
      code: error.code
    });
  }
});

// Replace the email verification endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  // Define verification code outside try block so it's accessible in catch
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const codeExpiry = new Date(Date.now() + 15 * 60000); // 15 minutes
  
  try {
    const { email } = req.body;
    
    // Check if it's a valid Columbia University email
    if (!email.endsWith('@columbia.edu')) {
      return res.status(400).json({ error: 'Only Columbia University emails (@columbia.edu) are allowed' });
    }

    // Check rate limiting
    const MAX_ATTEMPTS = 5;
    const RATE_LIMIT_WINDOW = 20; // minutes
    
    const attemptResult = await pool.query(
      'SELECT * FROM verification_attempts WHERE email = $1',
      [email]
    );
    
    const now = new Date();
    
    if (attemptResult.rows.length > 0) {
      const attempt = attemptResult.rows[0];
      const resetTime = new Date(attempt.reset_time);
      
      // If we're past the reset time, reset the counter
      if (now > resetTime) {
        await pool.query(
          'UPDATE verification_attempts SET attempt_count = 1, last_attempt = NOW(), reset_time = NOW() + INTERVAL \'20 minutes\' WHERE email = $1',
          [email]
        );
      } 
      // Otherwise, check if they've exceeded the limit
      else if (attempt.attempt_count >= MAX_ATTEMPTS) {
        const timeLeft = Math.ceil((resetTime - now) / 60000); // Time left in minutes
        return res.status(429).json({ 
          error: 'Too many verification attempts',
          message: `You have reached the maximum number of verification attempts. Please try again in ${timeLeft} minutes.`,
          resetTime: resetTime
        });
      } 
      // Increment their attempt count
      else {
        await pool.query(
          'UPDATE verification_attempts SET attempt_count = attempt_count + 1, last_attempt = NOW() WHERE email = $1',
          [email]
        );
      }
    } else {
      // First attempt, create a record
      await pool.query(
        'INSERT INTO verification_attempts (email, attempt_count, last_attempt, reset_time) VALUES ($1, 1, NOW(), NOW() + INTERVAL \'20 minutes\')',
        [email]
      );
    }
    
    // Get the current attempt count after update
    const currentAttemptResult = await pool.query(
      'SELECT attempt_count, reset_time FROM verification_attempts WHERE email = $1',
      [email]
    );
    
    const attemptsLeft = MAX_ATTEMPTS - currentAttemptResult.rows[0].attempt_count;
    const resetTime = new Date(currentAttemptResult.rows[0].reset_time);
    
    // Create or update user
    try {
      // Check if user exists
      const existingUserResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUserResult.rows.length > 0) {
        // Update existing user
        await pool.query(
          'UPDATE users SET verification_code = $1, code_expires = $2 WHERE email = $3',
          [verificationCode, codeExpiry.toISOString(), email]
        );
      } else {
        // Create new user
        await pool.query(
          'INSERT INTO users (email, verification_code, code_expires, email_verified) VALUES ($1, $2, $3, $4)',
          [email, verificationCode, codeExpiry.toISOString(), false]
        );
      }
    } catch (dbError) {
      // If user doesn't exist, fail gracefully and continue
      console.error('Database error:', dbError);
      // Continue anyway - we'll send email even if database fails
    }
    
    // Skip actual email sending if SKIP_EMAIL_VERIFICATION is TRUE
    if (process.env.SKIP_EMAIL_VERIFICATION === 'TRUE') {
      console.log('Skipping email verification. Code for testing:', verificationCode);
      return res.status(200).json({
        message: 'Verification code ready (email sending skipped)',
        code: verificationCode,
        attempts: {
          count: currentAttemptResult.rows[0].attempt_count,
          remaining: attemptsLeft,
          resetTime: resetTime
        }
      });
    }
    
    // Send email with Nodemailer
    try {
      const info = await transporter.sendMail({
        from: `"Lion Bay" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Lion Bay Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1c4587;">Lion Bay</h1>
            <p>Here is your verification code:</p>
            <div style="background-color: #f0f0f0; padding: 10px 20px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
              ${verificationCode}
            </div>
            <p>This code will expire in 15 minutes.</p>
            <p><small>You have ${attemptsLeft} verification attempts remaining in this 20-minute period.</small></p>
          </div>
        `
      });
      
      console.log('Email sent successfully:', info.messageId);
      res.status(200).json({ 
        message: 'Verification code sent to email',
        code: verificationCode, // For development only, remove in production
        attempts: {
          count: currentAttemptResult.rows[0].attempt_count,
          remaining: attemptsLeft,
          resetTime: resetTime
        }
      });
    } catch (emailError) {
      console.error('Email sending error details:', {
        error: emailError.message,
        stack: emailError.stack,
        code: emailError.code,
        command: emailError.command,
        responseCode: emailError.responseCode,
        response: emailError.response
      });
      res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }
  } catch (error) {
    console.error('Verification process error:', error);
    res.status(500).json({ error: 'Error in verification process' });
  }
});

// Verify code and authenticate user
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    // Verify email is from Columbia University
    if (!email.endsWith('@columbia.edu')) {
      return res.status(400).json({ error: 'Only Columbia University emails (@columbia.edu) are allowed' });
    }
    
    console.log(`Verifying code: ${code} for email: ${email}`);
    
    // First check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return res.status(400).json({ error: 'User not found with this email' });
    }
    
    const user = userResult.rows[0];
    
    console.log('User found:', user.id);
    console.log('Stored code:', user.verification_code);
    console.log('Submitted code:', code);
    
    // Trim and normalize both codes to ensure consistent comparison
    const storedCode = String(user.verification_code).trim();
    const submittedCode = String(code).trim();
    
    // For development/testing purposes, allow admin bypass
    if (submittedCode === '000000' && process.env.NODE_ENV !== 'production') {
      console.log('Admin bypass code used');
    } 
    // Regular code check
    else if (storedCode !== submittedCode) {
      console.log(`Code mismatch: Stored "${storedCode}" vs Submitted "${submittedCode}"`);
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Check if code is expired (skip for admin bypass)
    if (code !== '000000' && new Date() > new Date(user.code_expires)) {
      console.log('Code expired');
      return res.status(400).json({ error: 'Verification code expired' });
    }
    
    // Update user as verified
    await pool.query(
      'UPDATE users SET email_verified = true, verification_code = null WHERE id = $1',
      [user.id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('Verification successful');
    res.status(200).json({
      message: 'Email verified successfully',
      token,
      userId: user.id,
      isAdmin: checkAdmin(user.email)
    });
  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
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

    // Validate image URL format
    if (!image_path.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) && 
        !image_path.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format. Please provide a valid image URL or base64 data' });
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
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own products' });
    }
    
    // Delete the product
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
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
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/chats/${chat.id}" 
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
    
    const chatsResult = await pool.query(
      `SELECT c.*, 
        p.name as product_name, p.price as product_price, p.image_path as product_image,
        u1.email as buyer_email, u2.email as seller_email,
        (SELECT EXISTS(
          SELECT 1 FROM messages m 
          WHERE m.chat_id = c.id 
            AND m.sender_id != $1 
            AND m.is_read = false
        )) as has_unread,
        (SELECT MAX(created_at) FROM messages WHERE chat_id = c.id) as last_message_at,
        (SELECT message FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender_id
      FROM chats c
      JOIN products p ON c.product_id = p.id
      JOIN users u1 ON c.buyer_id = u1.id
      JOIN users u2 ON c.seller_id = u2.id
      WHERE c.buyer_id = $1 OR c.seller_id = $1 
      ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC`,
      [userId]
    );
    
    res.json(chatsResult.rows);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Helper function to validate UUID
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Update chat endpoints to use UUID validation
app.get('/api/chats/:id', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    
    // Validate chat ID is a valid UUID
    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID format' });
    }
    
    const chatResult = await pool.query(
      `SELECT c.*, 
        p.name as product_name, p.image_path as product_image,
        u1.email as buyer_email, u2.email as seller_email
      FROM chats c
      JOIN products p ON c.product_id = p.id
      JOIN users u1 ON c.buyer_id = u1.id
      JOIN users u2 ON c.seller_id = u2.id
      WHERE c.id = $1`,
      [chatId]
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

// Update mark-read endpoint
app.post('/api/chats/:id/mark-read', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    
    // Validate chat ID is a valid UUID
    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID format' });
    }
    
    const userId = req.user.userId;
    
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
    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to chat' });
    }
    
    // Mark messages from other users as read
    await pool.query(
      `UPDATE messages 
      SET is_read = true 
      WHERE chat_id = $1 AND sender_id != $2 AND is_read = false`,
      [chatId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Update messages endpoint
app.get('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    
    // Validate chat ID is a valid UUID
    if (!isValidUUID(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID format' });
    }
    
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

// Check if user has any unread messages
app.get('/api/chats/has-unread', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Check for messages where user is not the sender and is_read is false
    const unreadResult = await pool.query(
      `SELECT EXISTS(
        SELECT 1
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        WHERE (c.buyer_id = $1 OR c.seller_id = $1)
          AND m.sender_id != $1
          AND m.is_read = false
      ) as has_unread`,
      [userId]
    );
    
    res.json({ hasUnread: unreadResult.rows[0].has_unread });
  } catch (error) {
    console.error('Error checking unread messages:', error);
    res.status(500).json({ error: 'Failed to check unread messages' });
  }
});

// Mark all messages in a chat as read
app.post('/api/chats/:id/mark-read', authenticateToken, async (req, res) => {
  try {
    const chatId = req.params.id;
    const userId = req.user.userId;
    
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
    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to chat' });
    }
    
    // Mark messages from other users as read
    await pool.query(
      `UPDATE messages 
      SET is_read = true 
      WHERE chat_id = $1 AND sender_id != $2 AND is_read = false`,
      [chatId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// We're removing the unread-count endpoint and implementing it client-side

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  try {
    const chat_id = req.params.id;
    const sender_id = req.user.userId;
    const { message } = req.body;
    
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
    
    // Create new message with is_read = false
    const newMessageResult = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, message, is_read) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *`,
      [chat_id, sender_id, message, false]
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
    
    // Also emit to the recipient's personal room for unread count
    const recipientId = chat.buyer_id === sender_id ? chat.seller_id : chat.buyer_id;
    io.to(recipientId).emit('unread_message', newMessage);
    
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
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
  
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
      
      console.log(`Message received from user ${socket.user.userId} in chat ${chat_id}: ${message}`);
      
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
        'INSERT INTO messages (chat_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *',
        [chat_id, socket.user.userId, message]
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
      
      // Also emit to the recipient's personal room for unread count
      const recipientId = chat.buyer_id === socket.user.userId ? chat.seller_id : chat.buyer_id;
      socket.to(recipientId).emit('unread_message', formattedMessage);
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

// Start the server with proper error handling
const PORT = process.env.PORT || 10000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

server.listen(PORT, HOST, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Allowed Origins:', allowedOrigins);
  console.log('API Base URL:', API_BASE_URL);
  
  // Test database connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection test failed:', err);
    } else {
      console.log('Database connection test successful:', res.rows[0]);
    }
  });
  
  // Test email configuration
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter.verify((error, success) => {
      if (error) {
        console.error('Email configuration test failed:', error);
      } else {
        console.log('Email configuration test successful');
      }
    });
  }
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
}); 