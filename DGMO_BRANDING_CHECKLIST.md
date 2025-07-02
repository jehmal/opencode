# DGMO Branding Update Checklist

This checklist details all OpenCode → DGMO branding changes needed in the DGMSTT-branding worktree.

## 1. Package Names and Metadata

### package.json files
- [ ] Root package.json
  - `"name": "@opencode-dgm/command-router"` → `"name": "@dgmo/command-router"`
  - `"description": "Command routing system for OpenCode-DGM integration"` → `"description": "Command routing system for DGMO integration"`
  - `"author": "OpenCode-DGM Team"` → `"author": "DGMO Team"`
  - `"keywords": ["opencode", "dgm", ...]` → `"keywords": ["dgmo", ...]`

- [ ] All other package.json files in packages/
  - Update all `@opencode-dgm/` references to `@dgmo/`
  - Update descriptions removing "OpenCode-DGM" → "DGMO"
  - Update author fields

## 2. Docker Configuration

### docker-compose.yml
- [ ] Service names
  - `opencode:` → `dgmo:`
  - Keep `dgm:` as is (it's the core DGM service)
  
- [ ] Environment variables
  - `OPENCODE_API_URL=http://opencode:3000` → `DGMO_API_URL=http://dgmo:3000`
  
- [ ] Network names
  - `opencode-dgm:` → `dgmo:`
  - All references to `opencode-dgm` network → `dgmo`
  
- [ ] Database configuration
  - `POSTGRES_USER=opencode_dgm` → `POSTGRES_USER=dgmo`
  - `POSTGRES_DB=opencode_dgm` → `POSTGRES_DB=dgmo`

### Dockerfiles
- [ ] Update comments mentioning OpenCode
- [ ] Update any LABEL entries

## 3. Shell Scripts

### setup-opencode-dgm.sh → setup-dgmo.sh
- [ ] Rename file
- [ ] Update header comments
- [ ] `OpenCode + DGM One-Click Setup Script` → `DGMO One-Click Setup Script`
- [ ] All print statements mentioning "OpenCode + DGM" → "DGMO"
- [ ] Executable creation section - create `dgmo` instead of `opencode`
- [ ] Global command installation - install as `dgmo` not `opencode`
- [ ] Test commands - use `dgmo` instead of `opencode`

### Other shell scripts
- [ ] Update all references in scripts/*.sh
- [ ] Update executable names in scripts

## 4. TypeScript/JavaScript Code

### Interface and Type Names
- [ ] `interface OpenCodeContext` → `interface DGMOContext`
- [ ] `function setupOpenCodeIntegration` → `function setupDGMOIntegration`

### Comments and Documentation
- [ ] All comments mentioning "OpenCode" → "DGMO"
- [ ] JSDoc comments
- [ ] Example descriptions

### Import statements
- [ ] Update package imports from `@opencode-dgm/` to `@dgmo/`

## 5. Python Code

### Module imports
- [ ] Update any imports referencing opencode packages

### Comments and docstrings
- [ ] Update all references to OpenCode in comments
- [ ] Update module docstrings

### Configuration
- [ ] Environment variable names `OPENCODE_*` → `DGMO_*`

## 6. Documentation Files

### README.md
- [ ] Main title and description
- [ ] Installation instructions
- [ ] Usage examples changing `opencode` commands to `dgmo`
- [ ] Architecture descriptions

### Other .md files
- [ ] docs/DEVELOPMENT.md
- [ ] All files in archived-docs/
- [ ] Any references to OpenCode-DGM → DGMO

## 7. Configuration Files

### nginx/nginx.dev.conf
- [ ] Update upstream names if referencing opencode
- [ ] Update comments

### .env.example
- [ ] `OPENCODE_*` variables → `DGMO_*`

### jest.config.js, tsconfig.json, etc.
- [ ] Update project names in comments
- [ ] Update module name mappings if any

## 8. Examples Directory

### examples/opencode-integration.ts → examples/dgmo-integration.ts
- [ ] Rename file
- [ ] Update all code examples
- [ ] Update comments
- [ ] Update console.log statements

## 9. Binary/Executable Files

### opencode/opencode → opencode/dgmo
- [ ] Rename the executable file
- [ ] Update the executable wrapper script content
- [ ] Ensure proper permissions (chmod +x)

## 10. Test Files

### Update test descriptions
- [ ] All test files mentioning OpenCode in descriptions
- [ ] Test file names if they include 'opencode'
- [ ] Mock data and fixtures

## 11. Special Considerations

### DO NOT CHANGE:
- The `opencode/` directory name itself (keep for compatibility)
- The `dgm/` directory name (it's the core DGM system)
- External package names that aren't part of this project

### CAREFUL WITH:
- File paths in scripts - update references but not directory names
- Git repository URLs - only update if pointing to the project repo
- External documentation links - leave as is

## 12. Verification Steps

After making changes:
1. [ ] Run `npm install` to ensure package resolution works
2. [ ] Run `npm test` to ensure tests pass
3. [ ] Run `docker-compose config` to validate Docker configuration
4. [ ] Test the executable: `./opencode/dgmo --help`
5. [ ] Build the project: `npm run build`
6. [ ] Check for any remaining references: `grep -r "opencode" . --exclude-dir=node_modules`

## 13. Git Commit

When complete:
```bash
git add -A
git commit -m "feat: Rebrand from OpenCode to DGMO

- Update all package names from @opencode-dgm to @dgmo
- Rename executables and setup scripts
- Update Docker service names and configuration
- Update all documentation and examples
- Maintain compatibility with existing directory structure"
```