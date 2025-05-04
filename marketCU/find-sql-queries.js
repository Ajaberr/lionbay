#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find all JavaScript files in the project
const findJsFiles = () => {
  try {
    const result = execSync('find . -type f -name "*.js" -o -name "*.jsx" | grep -v "node_modules" | grep -v "dist"', { encoding: 'utf8' });
    return result.split('\n').filter(file => file.trim().length > 0);
  } catch (error) {
    console.error('Error finding JavaScript files:', error);
    return [];
  }
};

// Check if a file contains references to the messages table
const checkFileForMessages = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Regular expressions to find SQL queries
    const sqlPatterns = [
      /SELECT.*FROM\s+messages/i,
      /UPDATE\s+messages/i,
      /INSERT\s+INTO\s+messages/i,
      /DELETE\s+FROM\s+messages/i,
      /ALTER\s+TABLE\s+messages/i,
      /CREATE\s+TABLE\s+messages/i,
      /\bmessage\b.*\bFROM\b/i, // Match 'message' as a column or field name
      /\bmessages?\b/i // Any reference to message or messages
    ];
    
    const matches = [];
    
    sqlPatterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        // Get line number of the match
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        
        // Get context (surrounding lines)
        const lines = content.split('\n');
        const startLine = Math.max(0, lineNumber - 3);
        const endLine = Math.min(lines.length, lineNumber + 3);
        const context = lines.slice(startLine, endLine).join('\n');
        
        matches.push({
          pattern: pattern.toString(),
          match: match[0],
          lineNumber,
          context
        });
      }
    });
    
    if (matches.length > 0) {
      return { file: filePath, matches };
    }
    
    return null;
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error);
    return null;
  }
};

// Main function
const main = () => {
  console.log('Searching for SQL queries referencing messages table...');
  
  const files = findJsFiles();
  console.log(`Found ${files.length} JavaScript files to check`);
  
  const results = [];
  
  for (const file of files) {
    const result = checkFileForMessages(file);
    if (result) {
      results.push(result);
    }
  }
  
  console.log(`Found ${results.length} files with relevant SQL queries`);
  
  // Output the results
  for (const result of results) {
    console.log(`\nFile: ${result.file}`);
    result.matches.forEach(match => {
      console.log(`  Line ${match.lineNumber}: ${match.pattern}`);
      console.log(`  Match: ${match.match}`);
      console.log(`  Context:\n${match.context}`);
      console.log('  ' + '-'.repeat(50));
    });
  }
};

main(); 