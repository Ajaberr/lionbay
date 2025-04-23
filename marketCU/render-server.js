// Attempt to find and start the server from various possible locations
console.log('Starting server from render-server.js');
console.log('Current directory:', process.cwd());
console.log('Directory contents:');

const fs = require('fs');
const { execSync } = require('child_process');

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

for (const path of possiblePaths) {
  try {
    console.log(`Attempting to start server from: ${path}`);
    if (fs.existsSync(path)) {
      console.log(`Found server file at ${path}, starting...`);
      require(path);
      serverStarted = true;
      break;
    } else {
      console.log(`File not found: ${path}`);
    }
  } catch (err) {
    console.error(`Error starting server from ${path}:`, err.message);
  }
}

if (!serverStarted) {
  console.error('Failed to start server from any known location.');
  // As a last resort, try to start Express directly
  try {
    console.log('Attempting to start a basic Express server...');
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    app.get('/', (req, res) => {
      res.send('Server is running. Please configure the correct server path.');
    });
    
    app.listen(PORT, () => {
      console.log(`Emergency server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start emergency Express server:', err.message);
    process.exit(1);
  }
}