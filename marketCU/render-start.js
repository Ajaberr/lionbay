// render-start.js - Smart server starter for Render
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

// Get current file path and directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log environment for debugging
console.log('Current directory:', process.cwd());
console.log('Directory contents:');

try {
  // Use dir for Windows instead of ls
  console.log(execSync('dir').toString());
} catch (e) {
  console.log('Error listing directory:', e.message);
}

// Instead of trying to import the server file directly (which causes ESM/CommonJS issues),
// we'll spawn a new Node process to run it
const serverPaths = [
  './server/server.js',
  '../server/server.js',  // Try relative to this file
  './server.js',
  './index.js',
  './server/index.js'
];

// Try to find and run the server file with a child process
let serverStarted = false;

for (const serverPath of serverPaths) {
  const fullPath = path.resolve(process.cwd(), serverPath);
  console.log(`Checking ${fullPath}`);
  
  if (fs.existsSync(fullPath)) {
    console.log(`Found server at ${fullPath}, starting with Node...`);
    try {
      // Instead of importing directly, spawn a new Node process
      const server = spawn('node', [fullPath], { 
        stdio: 'inherit',  // Forward all stdio to parent process
        cwd: process.cwd() // Use same working directory
      });
      
      server.on('error', (err) => {
        console.error(`Failed to start server process: ${err.message}`);
      });
      
      // Don't exit this process
      serverStarted = true;
      console.log(`Server process started with PID: ${server.pid}`);
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

// Keep parent process running
process.stdin.resume();
