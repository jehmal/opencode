#!/usr/bin/env bun
import { existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

console.log("=== DGMSTT LOCAL DIRECTORY MONITOR ===");

const dgmsttDir = '/mnt/c/Users/jehma/Desktop/AI/DGMSTT';
const possibleSessionDirs = [
  '.dgmo',
  '.dgmo-sessions',
  'sessions',
  '.sessions',
  'data',
  '.data',
  'temp',
  '.temp',
  '.cache'
];

console.log(`Checking ${dgmsttDir} for session storage...\n`);

// First, check if any of these directories exist
let foundSessionDir = false;
possibleSessionDirs.forEach(dir => {
  const fullPath = join(dgmsttDir, dir);
  if (existsSync(fullPath)) {
    console.log(`✓ Found directory: ${dir}/`);
    try {
      const files = readdirSync(fullPath);
      const sessionFiles = files.filter(f => f.includes('ses_') || f.includes('session'));
      if (sessionFiles.length > 0) {
        foundSessionDir = true;
        console.log(`  Contains session files: ${sessionFiles.join(', ')}`);
      }
    } catch (e) {
      console.log(`  (Cannot read contents)`);
    }
  }
});

if (!foundSessionDir) {
  console.log("No existing session directories found.\n");
}

// Monitor for new directories and files
console.log("=== MONITORING FOR NEW SESSION FILES ===");
console.log("1. Run dgmo in another terminal");
console.log("2. Create agents");
console.log("3. Watch for new directories/files here\n");

// Get initial state of all files
const getAllFiles = (dir, prefix = '') => {
  const files = new Map();
  try {
    const items = readdirSync(dir);
    items.forEach(item => {
      const fullPath = join(dir, item);
      const relativePath = join(prefix, item);
      
      // Skip node_modules and .git
      if (item === 'node_modules' || item === '.git') return;
      
      try {
        const stat = statSync(fullPath);
        files.set(relativePath, {
          path: fullPath,
          isDirectory: stat.isDirectory(),
          mtime: stat.mtime
        });
        
        // Recurse into directories
        if (stat.isDirectory()) {
          const subFiles = getAllFiles(fullPath, relativePath);
          subFiles.forEach((value, key) => files.set(key, value));
        }
      } catch (e) {
        // Ignore permission errors
      }
    });
  } catch (e) {
    // Ignore errors
  }
  return files;
};

let knownFiles = getAllFiles(dgmsttDir);
console.log(`Tracking ${knownFiles.size} files/directories`);

setInterval(() => {
  const currentFiles = getAllFiles(dgmsttDir);
  
  // Check for new files
  currentFiles.forEach((info, path) => {
    if (!knownFiles.has(path)) {
      // New file/directory
      const name = basename(path);
      if (name.includes('ses_') || 
          name.includes('session') || 
          name.includes('dgmo') ||
          name.includes('agent') ||
          name.endsWith('.json')) {
        
        console.log(`\n🆕 NEW ${info.isDirectory ? 'DIRECTORY' : 'FILE'}: ${path}`);
        console.log(`   Full path: ${info.path}`);
        console.log(`   Time: ${new Date().toLocaleTimeString()}`);
        
        // If it's a JSON file, try to read it
        if (path.endsWith('.json')) {
          try {
            const content = Bun.file(info.path).text();
            const data = JSON.parse(content);
            if (data.id && data.id.startsWith('ses_')) {
              console.log(`   📌 This is a session file!`);
              console.log(`   Session ID: ${data.id}`);
              console.log(`   Type: ${data.type || 'unknown'}`);
              if (data.parentSessionId) {
                console.log(`   Parent: ${data.parentSessionId}`);
              }
            }
          } catch (e) {
            // Not a valid JSON or can't read
          }
        }
        
        // If it's a directory, show contents
        if (info.isDirectory) {
          try {
            const contents = readdirSync(info.path);
            console.log(`   Contents: ${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''}`);
          } catch (e) {
            console.log(`   (Cannot read contents)`);
          }
        }
      }
    }
  });
  
  knownFiles = currentFiles;
}, 500);

console.log("\nPress Ctrl+C to stop monitoring");
process.stdin.resume();
