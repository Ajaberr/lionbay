// render-start.js - Smart server starter for Render
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get current file path and directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log environment for debugging
console.log('Current directory:', process.cwd());
console.log('Directory contents:');

try {
  console.log(execSync('ls -la').toString());
  console.log('\nSearching for server files:');
  console.log(execSync('find . -name "server.js" -type f').toString());
} catch (e) {
  console.log('Error listing directory:', e.message);
}

// Possible server file locations
const serverPaths = [
  './server/server.js',
  './marketCU/server/server.js',
  './server.js',
  './index.js',
  './server/index.js',
  './marketCU/server.js'
];

// Try to find and require the server file
let serverStarted = false;

for (const serverPath of serverPaths) {
  const fullPath = path.resolve(process.cwd(), serverPath);
  console.log(`Checking ${fullPath}`);
  
  if (fs.existsSync(fullPath)) {
    console.log(`Found server at ${fullPath}, starting...`);
    try {
      // Use dynamic import instead of require
      const module = await import(fullPath);
      serverStarted = true;
      break;
    } catch (err) {
      console.error(`Error starting server from ${fullPath}:`, err.message);
    }
  } else {
    console.log(`${fullPath} does not exist`);
  }
}

if (!serverStarted) {
  console.error('CRITICAL: Could not find any server file to start!');
  process.exit(1);
}
