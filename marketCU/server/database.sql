-- Create tables in PostgreSQL

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_code TEXT,
  code_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
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

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cart_items table for the shopping cart
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  cart_type TEXT NOT NULL CHECK (cart_type IN ('CONTACTED', 'CART_ONLY')),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  chat_id UUID REFERENCES chats(id),
  UNIQUE(user_id, product_id)
);

-- Create help_messages table for user-admin communication
CREATE TABLE IF NOT EXISTS help_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  is_from_admin BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create verification_attempts table to track rate limiting
CREATE TABLE IF NOT EXISTS verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reset_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '20 minutes',
  UNIQUE(email)
); 