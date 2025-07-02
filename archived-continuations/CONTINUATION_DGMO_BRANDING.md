# Instructions for Next DGMO Branding Agent

You are continuing the DGMO (Darwin Gödel Machine + OpenCode) project. The project is 95% complete with all functionality working. Your task is to update the TUI (Terminal User Interface) to display "DGMO" branding instead of "OpenCode".

## Project Context
- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/`
- Key Repository: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/`
- Architecture: TypeScript/Bun OpenCode with Python DGM integration
- Global Command: `dgmo` (already working)

## Memory Search Commands
First, retrieve the current project state and patterns:
1. Search: "DGMO troubleshooting fixes completed"
2. Search: "OpenCode TUI terminal interface"
3. Search: "DGMO Darwin Gödel Machine OpenCode"
4. Search: "UI Style logo branding"
5. Search: "terminal UI components"

## Completed Components (DO NOT RECREATE)
✅ Global `dgmo` command setup and working
✅ All runtime errors fixed (TUI, session cleanup, evolution)
✅ DGM bridge integration with proper Python environment
✅ Evolution command functioning with performance tracking
✅ Repository cleaned for fork pushing
✅ Comprehensive .gitignore created

## Critical Files to Reference
1. TUI Components:
   - `/opencode/packages/opencode/src/cli/ui.ts` - Main UI utilities and logo
   - `/opencode/tui/cmd/opencode/main.go` - Go TUI entry point
   - `/opencode/packages/opencode/src/index.ts` - CLI entry point with logo usage

2. Branding Locations:
   - `/opencode/packages/opencode/src/cli/cmd/tui.ts` - TUI command
   - `/opencode/packages/opencode/src/cli/cmd/run.ts` - Run command output
   - `/opencode/packages/opencode/src/cli/cmd/evolve.ts` - Evolution command
   - Any file using `UI.logo()` function

## Required Tasks (USE 2 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Update TypeScript UI Components
Update all OpenCode branding to DGMO in TypeScript files
- Update the logo ASCII art in `/opencode/packages/opencode/src/cli/ui.ts`
- Change "OpenCode" text to "DGMO" in the logo function
- Keep the existing ASCII art style but modify letters
- Update any window titles or headers mentioning OpenCode
Location: `/opencode/packages/opencode/src/`
Dependencies: None

### Sub-Agent 2: Update Go TUI Components
Update TUI branding in Go files
- Check `/opencode/tui/` directory for OpenCode references
- Update any hardcoded "OpenCode" strings to "DGMO"
- Modify window titles, headers, and help text
- Ensure consistency with TypeScript branding
Location: `/opencode/tui/`
Dependencies: None

## Integration Requirements
1. ASCII Art: Maintain the existing style but spell "DGMO" instead of "OpenCode"
2. Colors: Keep the same color scheme (gray/white split)
3. Spacing: Preserve the exact spacing and alignment
4. Commands: Keep all command names the same (dgmo run, dgmo evolve, etc.)

## Technical Constraints
- ASCII Art Width: Keep within 50 characters for terminal compatibility
- Style: Use the same block characters as current logo
- Case: "DGMO" should be in caps like "OPENCODE" was
- Backwards Compatibility: Don't break any existing commands

## Success Criteria
1. Running `dgmo` shows "DGMO" ASCII art logo
2. Running `dgmo --help` shows "DGMO" in header
3. Running `dgmo run` shows "DGMO" branding
4. TUI mode displays "DGMO" in title/header
5. All "OpenCode" text references updated to "DGMO"

## Testing Approach
After implementation:
1. Run `dgmo --help` and verify logo
2. Run `dgmo` (TUI mode) and check branding
3. Run `dgmo run "test"` and verify output header
4. Search for any remaining "OpenCode" references
5. Test all commands still function properly

## Known Issues & Solutions
- Issue: Some strings might be in binary Go files
  Solution: Rebuild Go TUI after changes with `go build`
- Issue: Cached output might show old branding
  Solution: Clear any cache directories

## Important Notes
- The ASCII art is in the `logo()` function in ui.ts
- The current logo uses block characters: █▀▀█ █▀▀ etc.
- Maintain the gray/white color split in the logo
- Remember: This is cosmetic only - don't change functionality

Start by searching memory for the mentioned queries to understand the current branding implementation, then launch your sub-agents to update all branding from "OpenCode" to "DGMO". The functionality is perfect - we just need the visual branding updated.