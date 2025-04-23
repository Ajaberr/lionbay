// Simple script to check for the frontend build directory
const fs = require('fs');
const path = require('path');

console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Define possible dist paths
const possibleDistPaths = [
  path.join(__dirname, 'dist'),                // ./dist
  path.join(__dirname, 'marketCU/dist'),       // ./marketCU/dist
  path.join(__dirname, '../dist'),             // ../dist
  path.join(__dirname, '../marketCU/dist'),    // ../marketCU/dist
  '/Users/abdullahalzahrani/Projects/marketCU/dist',
  '/Users/abdullahalzahrani/Projects/marketCU/marketCU/dist'
];

// Check each path
console.log('Checking for dist directories:');
possibleDistPaths.forEach((distPath, index) => {
  const exists = fs.existsSync(distPath);
  console.log(`[${index}] ${distPath} - exists: ${exists}`);
  
  if (exists) {
    // List contents
    try {
      const files = fs.readdirSync(distPath);
      console.log(`  Contents: ${files.join(', ')}`);
    } catch (err) {
      console.error(`  Error reading directory: ${err.message}`);
    }
  }
});

// Recursively find all dist directories
console.log('\nRecursively finding all dist directories:');
function findDistDirs(startPath, maxDepth = 2, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  
  let results = [];
  
  try {
    const files = fs.readdirSync(startPath);
    
    for (const file of files) {
      if (file === 'node_modules' || file === '.git') continue;
      
      const filePath = path.join(startPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        if (file === 'dist') {
          results.push(filePath);
        }
        results = results.concat(findDistDirs(filePath, maxDepth, currentDepth + 1));
      }
    }
  } catch (err) {
    console.error(`Error searching ${startPath}: ${err.message}`);
  }
  
  return results;
}

const distDirs = findDistDirs('/Users/abdullahalzahrani/Projects/marketCU');
distDirs.forEach(dir => {
  console.log(`Found dist directory: ${dir}`);
  try {
    const files = fs.readdirSync(dir);
    console.log(`  Contents: ${files.join(', ')}`);
  } catch (err) {
    console.error(`  Error reading directory: ${err.message}`);
  }
}); 