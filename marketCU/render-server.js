// Attempt to find and start the server from various possible locations
console.log('Starting server from render-server.js');
console.log('Current directory:', process.cwd());
console.log('Directory contents:');

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file path and directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log directory contents for debugging
try {
  console.log(execSync('ls -la').toString());
  console.log('\nSearching for server files:');
  console.log(execSync('find . -name "*.js" | grep -E "server|index"').toString());
} catch (e) {
  console.log('Error listing directory:', e.message);
}

// Try to require the server from various possible locations
const possiblePaths = [
  './server.js',
  './server/server.js',
  './server/index.js',
  './marketCU/server.js',
  './marketCU/server/server.js',
  './marketCU/server/index.js',
  './index.js',
  './app.js',
  './src/server.js',
  './src/index.js'
];

let serverStarted = false;

for (const relativePath of possiblePaths) {
  try {
    console.log(`Attempting to start server from: ${relativePath}`);
    // Resolve path properly relative to current working directory
    const fullPath = path.resolve(process.cwd(), relativePath);
    
    if (fs.existsSync(fullPath)) {
      console.log(`Found server file at ${relativePath}, starting...`);
      
      // Convert file path to URL format for ESM imports
      const fileUrl = new URL(`file://${fullPath}`);
      
      // Use dynamic import with URL object
      const module = await import(fileUrl);
      serverStarted = true;
      break;
    } else {
      console.log(`File not found: ${relativePath}`);
    }
  } catch (err) {
    console.error(`Error starting server from ${relativePath}:`, err.message);
  }
}

if (!serverStarted) {
  console.error('Failed to start server from any known location.');
  // As a last resort, try to start Express directly
  try {
    console.log('Attempting to start a basic Express server...');
    
    // Make sure express is in dependencies
    console.log('Checking for express module...');
    const expressPath = path.resolve(process.cwd(), 'node_modules/express');
    
    if (fs.existsSync(expressPath)) {
      // Use dynamic import for express
      const { default: express } = await import('express');
      const app = express();
      const PORT = process.env.PORT || 3000;
      
      app.get('/', (req, res) => {
        res.send('Server is running. Please configure the correct server path.');
      });
      
      app.listen(PORT, () => {
        console.log(`Emergency server running on port ${PORT}`);
      });
    } else {
      console.error('Express module not found in node_modules. Try running "npm install express" first.');
    }
  } catch (err) {
    console.error('Failed to start emergency Express server:', err.message);
    process.exit(1);
  }
}
