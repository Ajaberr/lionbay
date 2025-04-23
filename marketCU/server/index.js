// server/index.js - Bridge file for Render deployment
console.log('Redirecting to actual server file...');

// Try multiple possible paths to find the server
try {
  console.log('Trying ./server.js');
  require('./server.js');
} catch (err) {
  console.log('Error loading ./server.js:', err.message);
  
  try {
    console.log('Trying ../server.js');
    require('../server.js');
  } catch (err2) {
    console.log('Error loading ../server.js:', err2.message);
    
    try {
      // For marketCU structure
      console.log('Trying ../marketCU/server/server.js');
      require('../marketCU/server/server.js');
    } catch (err3) {
      console.log('Error loading ../marketCU/server/server.js:', err3.message);
      console.error('CRITICAL: Could not find server file. Directory listing:');
      const { execSync } = require('child_process');
      try {
        console.log(execSync('find . -type f -name "*.js" | sort').toString());
      } catch (e) {
        console.log('Could not list directory:', e.message);
      }
    }
  }
}