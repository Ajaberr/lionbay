-- Add is_verified column to users table
ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  full_name VARCHAR(255),
  class_year VARCHAR(4),
  major VARCHAR(255),
  phone_number VARCHAR(20),
  bio TEXT,
  profile_image LONGTEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
); 