# Instructions for Next DGMSTT Agent

You are continuing the implementation of DGMSTT (Darwin Gödel Machine Self-Testing Tool). The project is 98% complete with full DGMO branding applied and all core functionality working. Your task is to fix the Python virtual environment path error preventing the evolution engine from running.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT`
- Key Repositories: 
  - OpenCode: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/` (TypeScript/Bun)
  - DGM: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/` (Python evolution engine)
- Architecture Doc: See Qdrant memories for full integration architecture
- Related Systems: DGM bridge at `opencode/packages/dgm-integration/`

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT DGMSTT Evolution Engine Error Python Virtual Environment"
2. Search: "DGM bridge Python environment dgmo evolve error"
3. Search: "SUCCESS PATTERN virtual environment setup WSL"
4. Search: "ERROR RESOLVED Python path venv dgm integration"
5. Search: "DGMSTT Phase 3 Evolution Engine implementation"

## Completed Components (DO NOT RECREATE)

✅ DGMO Branding (100% Complete)
   - ASCII art displays "DGM-O" with "Self Improv" tagline
   - All CLI commands show "dgmo" instead of "opencode"
   - URLs updated to dgmo.ai throughout codebase
   - Help text fully branded

✅ Core CLI Commands (100% Working)
   - `dgmo run` - AI code generation working perfectly
   - `dgmo auth` - Authentication management functional
   - `dgmo serve` - Headless server mode operational
   - `dgmo tui` - Terminal UI mode working
   - `dgmo upgrade` - Version management functional

✅ MCP Integration Phase 1 (100% Complete)
   - `dgmo mcp list` - Lists all MCP servers with status
   - `dgmo mcp status` - Detailed health checks
   - `dgmo mcp test` - Connection validation
   - `dgmo mcp tools` - Tool inspection

✅ Bug Fixes Applied
   - TUI mode server URL construction fixed
   - Session cleanup errors resolved
   - Go language server detection improved
   - Evolution command verbose flag conflict fixed

## Critical Files to Reference

1. DGM Bridge:
   - `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/dgm-integration/src/dgm-bridge.ts` - Line 70 has hardcoded Python path
   - `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/dgm-integration/src/index.ts` - Main integration exports

2. Evolution Command:
   - `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/cli/cmd/evolve.ts` - Evolution command implementation

3. DGM Python:
   - `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/` - Main DGM directory
   - `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/requirements.txt` - Python dependencies

## Required Tasks (USE 2 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Diagnose and Fix Python Path
Investigate the Python virtual environment issue and implement a robust fix

- Check if `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/venv` exists
- If not, create it: `cd dgm && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt`
- Update dgm-bridge.ts to handle missing venv gracefully
- Consider using system Python as fallback or making path configurable
- Test the fix with `dgmo evolve --analyze`

Location: `opencode/packages/dgm-integration/src/dgm-bridge.ts`
Dependencies: Python 3.x, DGM requirements

### Sub-Agent 2: Enhance Evolution Integration
While Sub-Agent 1 fixes the path, improve the evolution integration

- Add better error messages for missing Python dependencies
- Implement Python path auto-detection logic
- Add configuration option for custom Python paths
- Create setup instructions in README for evolution feature
- Add validation to check DGM dependencies before running

Location: `opencode/packages/dgm-integration/` and documentation
Dependencies: Evolution command implementation

## Integration Requirements

1. Maintain backward compatibility with existing installations
2. Preserve all current DGMO branding (no OpenCode references)
3. Ensure cross-platform compatibility (Windows WSL, Linux, macOS)
4. Keep error messages helpful and actionable

## Technical Constraints

- Python Path: Must work in WSL environment where script is run
- Virtual Environment: Should create if missing or use system Python
- Error Handling: Must not crash entire CLI if evolution fails
- Performance: Evolution should start within 2 seconds

## Success Criteria

1. `dgmo evolve --analyze` runs without Python path errors
2. Virtual environment automatically created if missing
3. Clear error messages if Python or dependencies missing
4. Evolution engine successfully analyzes performance patterns
5. All other dgmo commands continue working normally
6. No regression in existing functionality

## Testing Approach

After implementation:

1. Run `dgmo evolve --analyze` (should work without errors)
2. Delete venv and test auto-creation: `rm -rf dgm/venv && dgmo evolve --analyze`
3. Test with missing dependencies to verify error messages
4. Run full command suite: `dgmo --help`, `dgmo run "test"`, `dgmo mcp list`
5. Verify performance data collection works
6. Test evolution with actual usage patterns if available

## Known Issues & Solutions

- Issue: ENOENT error for Python path
  Solution: Create venv or use system Python fallback
  
- Issue: DGM dependencies not installed
  Solution: Auto-install or provide clear setup instructions

- Issue: WSL path differences from Windows
  Solution: Use consistent Unix-style paths

## Important Notes

- The project is a monorepo with TypeScript (OpenCode) and Python (DGM) components
- Evolution feature is the crown jewel - it enables self-improvement
- All branding must remain as DGMO (Darwin Gödel Machine + OpenCode)
- This is the final issue preventing 100% functionality
- Remember: The goal is a self-improving AI coding assistant

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. This is the final step to achieve a fully functional self-improving AI coding assistant!