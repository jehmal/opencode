#!/usr/bin/env bun
import { watch } from 'fs/promises';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log("=== SUB-SESSION TRACE ===");

// Focus on the OpenCode project directory where sub-sessions were found
const projectDir = '/home/jehma/.local/share/opencode/User/workspaceStorage/mnt-c-Users-jehma-Desktop-AI-DGMSTT-opencode';
const sessionDir = join(projectDir, 'dgmo', 'sessions');

if (!existsSync(sessionDir)) {
  console.error(`Session directory not found: ${sessionDir}`);
  process.exit(1);
}

// Get initial state
const getSubSessions = () => {
  const files = readdirSync(sessionDir)
    .filter(f => f.startsWith('ses_') && f.endsWith('.json'))
    .map(f => ({
      file: f,
      path: join(sessionDir, f),
      mtime: statSync(join(sessionDir, f)).mtime
    }));
  return files;
};

let currentSessions = getSubSessions();
console.log(`\nInitial state: ${currentSessions.length} session files`);
currentSessions.forEach(s => console.log(`  - ${s.file}`));

console.log("\n=== MONITORING ===");
console.log("1. Run dgmo in another terminal");
console.log("2. Create agents with: 'Create 2 agents to test'");
console.log("3. Watch for new sub-session files here\n");

// Poll for changes (more reliable than fs.watch on WSL)
setInterval(() => {
  try {
    const newSessions = getSubSessions();
    
    // Check for new files
    newSessions.forEach(newSession => {
      const existing = currentSessions.find(s => s.file === newSession.file);
      if (!existing) {
        console.log(`\n🆕 NEW SESSION CREATED: ${newSession.file}`);
        console.log(`   Path: ${newSession.path}`);
        console.log(`   Time: ${new Date().toLocaleTimeString()}`);
        
        // Try to read and show content
        try {
          const content = Bun.file(newSession.path).text();
          const data = JSON.parse(content);
          console.log(`   Type: ${data.type || 'unknown'}`);
          console.log(`   Agent: ${data.agentName || 'unknown'}`);
          console.log(`   Parent: ${data.parentSessionId || 'none'}`);
        } catch (e) {
          console.log(`   (Could not read content)`);
        }
      } else if (existing.mtime.getTime() !== newSession.mtime.getTime()) {
        console.log(`\n📝 SESSION UPDATED: ${newSession.file}`);
        console.log(`   Time: ${new Date().toLocaleTimeString()}`);
      }
    });
    
    // Check for deleted files
    currentSessions.forEach(oldSession => {
      if (!newSessions.find(s => s.file === oldSession.file)) {
        console.log(`\n🗑️  SESSION DELETED: ${oldSession.file}`);
        console.log(`   Time: ${new Date().toLocaleTimeString()}`);
      }
    });
    
    currentSessions = newSessions;
  } catch (error) {
    // Ignore errors, keep monitoring
  }
}, 500); // Check every 500ms

// Also monitor the index file
const indexPath = join(projectDir, 'dgmo', 'sessions', 'index.json');
let lastIndexMtime = existsSync(indexPath) ? statSync(indexPath).mtime : null;

setInterval(() => {
  try {
    if (existsSync(indexPath)) {
      const currentMtime = statSync(indexPath).mtime;
      if (!lastIndexMtime || currentMtime.getTime() !== lastIndexMtime.getTime()) {
        console.log(`\n📋 INDEX UPDATED at ${new Date().toLocaleTimeString()}`);
        
        // Show current index content
        try {
          const indexContent = JSON.parse(Bun.file(indexPath).text());
          const sessionCount = Object.keys(indexContent.sessions || {}).length;
          console.log(`   Total sessions: ${sessionCount}`);
          
          // Count sub-sessions
          let subSessionCount = 0;
          Object.values(indexContent.sessions || {}).forEach(session => {
            if (session.subSessions && session.subSessions.length > 0) {
              subSessionCount += session.subSessions.length;
              console.log(`   Session ${session.id} has ${session.subSessions.length} sub-sessions`);
            }
          });
          console.log(`   Total sub-sessions: ${subSessionCount}`);
        } catch (e) {
          console.log(`   (Could not read index content)`);
        }
        
        lastIndexMtime = currentMtime;
      }
    }
  } catch (error) {
    // Ignore errors
  }
}, 1000); // Check every second

console.log("Press Ctrl+C to stop monitoring");

// Keep the process running
process.stdin.resume();
