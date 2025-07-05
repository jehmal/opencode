# DGMO Branding Visual Guide

## Key Transformations

### 1. Package Names
```diff
- "@opencode-dgm/command-router"
+ "@dgmo/command-router"

- "@opencode-dgm/core"
+ "@dgmo/core"
```

### 2. Docker Services
```diff
services:
-  opencode:
+  dgmo:
    build:
      context: ./opencode
      dockerfile: Dockerfile
    environment:
-     - OPENCODE_API_URL=http://opencode:3000
+     - DGMO_API_URL=http://dgmo:3000
```

### 3. Database Configuration
```diff
postgres:
  environment:
-   - POSTGRES_USER=opencode_dgm
-   - POSTGRES_DB=opencode_dgm
+   - POSTGRES_USER=dgmo
+   - POSTGRES_DB=dgmo
```

### 4. Code Changes
```diff
// TypeScript
- interface OpenCodeContext {
+ interface DGMOContext {
    workspaceId: string;
    projectPath: string;
  }

- async function setupOpenCodeIntegration(context: OpenCodeContext) {
+ async function setupDGMOIntegration(context: DGMOContext) {
```

### 5. Shell Commands
```diff
# Installation
- ./setup-opencode-dgm.sh
+ ./setup-dgmo.sh

# Usage
- opencode run "create a hello world"
+ dgmo run "create a hello world"

- opencode evolve --analyze
+ dgmo evolve --analyze

- opencode tui
+ dgmo tui
```

### 6. Environment Variables
```diff
- OPENCODE_ROOT=/path/to/opencode
+ DGMO_ROOT=/path/to/dgmo

- OPENCODE_API_KEY=xxx
+ DGMO_API_KEY=xxx
```

### 7. Documentation Headers
```diff
- # OpenCode + DGM Integration
+ # DGMO Integration

- OpenCode-DGM is a self-improving AI coding assistant
+ DGMO is a self-improving AI coding assistant
```

### 8. Executable Names
```diff
# Binary file
- opencode/opencode
+ opencode/dgmo

# Global installation
- ~/.local/bin/opencode
+ ~/.local/bin/dgmo
```

### 9. Network Names
```diff
networks:
- opencode-dgm:
+ dgmo:
    driver: bridge
```

### 10. Test Descriptions
```diff
- describe('OpenCode Integration', () => {
+ describe('DGMO Integration', () => {
-   it('should handle OpenCode commands', () => {
+   it('should handle DGMO commands', () => {
```

## Visual Summary

### Before:
```
OpenCode-DGM Architecture
├── opencode/ (TypeScript service)
│   ├── opencode (executable)
│   └── packages/
│       └── @opencode-dgm/*
├── dgm/ (Python service)
└── setup-opencode-dgm.sh
```

### After:
```
DGMO Architecture
├── opencode/ (TypeScript service - dir name unchanged)
│   ├── dgmo (executable)
│   └── packages/
│       └── @dgmo/*
├── dgm/ (Python service - unchanged)
└── setup-dgmo.sh
```

## Important Notes

1. **Directory Names**: The `opencode/` and `dgm/` directory names are NOT changed to maintain compatibility.

2. **Service Architecture**: The two-service architecture remains:
   - `dgmo` service (was `opencode` service) - TypeScript/Bun
   - `dgm` service - Python (unchanged)

3. **Command Structure**: All commands change from `opencode` to `dgmo`:
   ```bash
   # Old
   opencode run "task"
   opencode evolve
   opencode tui
   
   # New
   dgmo run "task"
   dgmo evolve
   dgmo tui
   ```

4. **Import Paths**: Update all imports:
   ```typescript
   // Old
   import { Something } from '@opencode-dgm/core';
   
   // New
   import { Something } from '@dgmo/core';
   ```