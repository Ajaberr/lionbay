// Script to fix Render environment variables
// This script should be added to your build process on Render
require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('=== RENDER ENVIRONMENT SETUP ===');
console.log(`Running at: ${new Date().toISOString()}`);
console.log(`Current directory: ${process.cwd()}`);

// Check and create an environment file that combines all needed variables
async function setupEnvFile() {
  // Variables we need to ensure are set
  const requiredVars = [
    'DATABASE_URL',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'JWT_SECRET',
    'NODE_ENV',
    'PORT',
    'ADMIN_EMAILS',
    'SKIP_EMAIL_VERIFICATION'
  ];
  
  // Create a combined env object
  let envVars = {};
  
  // First check process.env for already set variables
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      envVars[varName] = process.env[varName];
    }
  });
  
  // Check all possible .env files
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'marketCU', '.env'),
    path.join(process.cwd(), 'marketCU', 'server', '.env'),
    path.join(process.cwd(), 'server', '.env')
  ];
  
  // Read variables from existing env files
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`Reading environment from: ${envPath}`);
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || line.trim() === '') continue;
          
          // Parse KEY=VALUE format
          const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)$/);
          if (match && match.length === 3) {
            const key = match[1].trim();
            const value = match[2].trim();
            
            // Only set if not already set
            if (!envVars[key]) {
              envVars[key] = value;
            }
          }
        }
      } catch (error) {
        console.error(`Error reading ${envPath}:`, error.message);
      }
    }
  }
  
  // Fix DATABASE_URL if needed
  if (envVars.DATABASE_URL && 
      envVars.DATABASE_URL.includes('dpg-') && 
      !envVars.DATABASE_URL.includes('.oregon-postgres.render.com')) {
    const originalUrl = envVars.DATABASE_URL;
    envVars.DATABASE_URL = originalUrl.replace(
      /(@dpg-[^\/]+)\//, 
      '$1.oregon-postgres.render.com/'
    );
    console.log('Fixed DATABASE_URL to include region component');
  }
  
  // Set defaults for missing critical variables
  if (!envVars.NODE_ENV) {
    envVars.NODE_ENV = 'production';
    console.log('Set default NODE_ENV=production');
  }
  
  if (!envVars.PORT) {
    envVars.PORT = '3001';
    console.log('Set default PORT=3001');
  }
  
  if (!envVars.SKIP_EMAIL_VERIFICATION) {
    envVars.SKIP_EMAIL_VERIFICATION = 'FALSE';
    console.log('Set default SKIP_EMAIL_VERIFICATION=FALSE');
  }
  
  // Generate JWT_SECRET if missing
  if (!envVars.JWT_SECRET) {
    const crypto = require('crypto');
    envVars.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    console.log('Generated new JWT_SECRET');
  }
  
  // Check for missing critical variables
  const missingVars = requiredVars.filter(varName => !envVars[varName]);
  if (missingVars.length > 0) {
    console.warn(`WARNING: The following required variables are still missing: ${missingVars.join(', ')}`);
  }
  
  // Generate environment files for all possible locations
  const outputContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  // Create .env file at root
  try {
    fs.writeFileSync(path.join(process.cwd(), '.env'), outputContent);
    console.log('Created .env file at project root');
  } catch (error) {
    console.error('Error creating root .env file:', error.message);
  }
  
  // Create .env file in marketCU/server if it exists
  const serverDir = path.join(process.cwd(), 'marketCU', 'server');
  if (fs.existsSync(serverDir) && fs.statSync(serverDir).isDirectory()) {
    try {
      fs.writeFileSync(path.join(serverDir, '.env'), outputContent);
      console.log('Created .env file in marketCU/server directory');
    } catch (error) {
      console.error('Error creating server .env file:', error.message);
    }
  }
  
  // Create .env file in marketCU if it exists
  const marketCUDir = path.join(process.cwd(), 'marketCU');
  if (fs.existsSync(marketCUDir) && fs.statSync(marketCUDir).isDirectory()) {
    try {
      fs.writeFileSync(path.join(marketCUDir, '.env'), outputContent);
      console.log('Created .env file in marketCU directory');
    } catch (error) {
      console.error('Error creating marketCU .env file:', error.message);
    }
  }
  
  // Set environment variables for the current process
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  console.log('Environment setup complete');
  
  // Log all environment variables (masked for security)
  console.log('\nCurrent environment variables:');
  Object.entries(envVars).forEach(([key, value]) => {
    if (key === 'DATABASE_URL') {
      console.log(`${key}=${value.replace(/:[^:@]*@/, ':***@')}`);
    } else if (key === 'EMAIL_PASSWORD' || key === 'JWT_SECRET') {
      console.log(`${key}=[MASKED]`);
    } else {
      console.log(`${key}=${value}`);
    }
  });
}

// Run the setup
setupEnvFile().catch(error => {
  console.error('Error setting up environment:', error);
  process.exit(1);
}); 