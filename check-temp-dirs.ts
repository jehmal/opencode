#!/usr/bin/env bun
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

console.log("=== TEMP DIRECTORY CHECK ===");

// Common temp locations where dgmo might store files
const tempDirs = [
  '/tmp',
  '/tmp/dgmo',
  '/tmp/dgmo-sessions',
  '/var/tmp',
  process.env.TMPDIR || '/tmp',
  join(process.env.HOME || '/home/jehma', '.cache', 'dgmo'),
  join(process.env.HOME || '/home/jehma', '.local', 'state', 'dgmo')
];

console.log("Checking temporary directories for dgmo files...\n");

let foundDgmoFiles = false;

tempDirs.forEach(dir => {
  if (existsSync(dir)) {
    try {
      const files = readdirSync(dir);
      const dgmoFiles = files.filter(f => 
        f.includes('dgmo') || 
        f.includes('ses_') || 
        f.includes('session')
      );
      
      if (dgmoFiles.length > 0) {
        foundDgmoFiles = true;
        console.log(`✓ Found in ${dir}:`);
        dgmoFiles.forEach(f => console.log(`  - ${f}`));
        console.log();
      }
    } catch (e) {
      // Permission denied, skip
    }
  }
});

if (!foundDgmoFiles) {
  console.log("No dgmo-related files found in temp directories.\n");
}

// Monitor /tmp for new files
console.log("=== MONITORING /tmp ===");
console.log("Watching for new dgmo files...");
console.log("Run dgmo and create agents in another terminal\n");

const tmpDir = '/tmp';
let knownFiles = new Set();

// Get initial state
try {
  const files = readdirSync(tmpDir);
  files.forEach(f => knownFiles.add(f));
} catch (e) {
  console.error("Cannot read /tmp directory");
  process.exit(1);
}

// Poll for changes
setInterval(() => {
  try {
    const currentFiles = readdirSync(tmpDir);
    
    currentFiles.forEach(file => {
      if (!knownFiles.has(file)) {
        // New file appeared
        if (file.includes('dgmo') || file.includes('ses_') || file.includes('session')) {
          console.log(`\n🆕 NEW TEMP FILE: ${file}`);
          console.log(`   Path: ${join(tmpDir, file)}`);
          console.log(`   Time: ${new Date().toLocaleTimeString()}`);
          
          // Check if it's a directory
          const fullPath = join(tmpDir, file);
          try {
            if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
              console.log(`   Type: Directory`);
              const subFiles = readdirSync(fullPath);
              if (subFiles.length > 0) {
                console.log(`   Contents: ${subFiles.slice(0, 5).join(', ')}${subFiles.length > 5 ? '...' : ''}`);
              }
            }
          } catch (e) {
            // Ignore
          }
        }
        knownFiles.add(file);
      }
    });
    
    // Update known files
    knownFiles = new Set(currentFiles);
  } catch (error) {
    // Ignore errors
  }
}, 500);

console.log("Press Ctrl+C to stop monitoring");
process.stdin.resume();
