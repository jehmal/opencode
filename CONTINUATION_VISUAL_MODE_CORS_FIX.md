# Instructions for Next DGMSTT Agent

You are continuing the implementation of DGMSTT (Darwin Gödel Machine Self-Testing Tool). The
project is 99% complete with a CORS error preventing Stagewise toolbar from loading in local HTML
files. Your task is to document and implement proper solutions for this browser security issue.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT`
- Key Repositories:
  - OpenCode TypeScript: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
  - DGM Python: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm`
  - Visual Mode: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/visual`
- Architecture Doc: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/SIMPLE_INTEGRATION_ARCHITECTURE.md`
- Related Systems: Stagewise toolbar, SRPC protocol, WebSocket server

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "PROJECT SNAPSHOT DGMSTT Visual Mode CORS Issue 99% Complete"
2. Search: "ERROR RESOLVED CORS Policy Blocking Stagewise Toolbar Script"
3. Search: "DGMO VISUAL MODE INTEGRATION COMPLETE Stagewise SRPC"
4. Search: "dgmo visual-setup framework detection HTML injection"
5. Search: "WebSocket Server visual/server.ts SRPC protocol"

## Completed Components (DO NOT RECREATE)

✅ DGMO Branding - Complete rebranding from OpenCode to DGMO ✅ Core CLI Commands - All basic
commands (run, evolve, auth, serve, tui) ✅ MCP Integration Phase 3 - All 12 MCP commands
implemented ✅ Visual Mode Server - WebSocket server with SRPC protocol ✅ Stagewise Adapter - Makes
DGMO discoverable by toolbar ✅ Visual Setup Command - Framework detection and setup ✅ Evolution
Engine - DGM integration fully functional ✅ Cross-language Bridge - TypeScript-Python communication

## Critical Files to Reference

1. Visual Mode Components:
   - `/opencode/packages/opencode/src/visual/server.ts` - WebSocket SRPC server
   - `/opencode/packages/opencode/src/visual/stagewise-adapter.ts` - Toolbar adapter
   - `/opencode/packages/opencode/src/cli/cmd/visual-setup.ts` - Setup command
   - `/opencode/packages/opencode/src/cli/cmd/run.ts` - Visual flag integration

2. Documentation:
   - `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/VISUAL_MODE_README.md` - User guide
   - `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/IMPLEMENTATION_SUMMARY.md` - Technical details

## Required Tasks (USE 3 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: CORS Documentation & Examples

Create comprehensive documentation for CORS solutions:

1. Update VISUAL_MODE_README.md with CORS troubleshooting section
2. Add example HTML files showing proper Stagewise integration
3. Create visual-mode-examples/ directory with:
   - example-with-server.html (for HTTP server usage)
   - example-with-local-script.html (downloaded toolbar)
   - example-with-dgmo.html (using dgmo visual server)
4. Add CORS explanation to help users understand the issue

Location: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/visual-mode-examples/` Dependencies: Existing visual
mode documentation

### Sub-Agent 2: Enhanced Visual Setup Command

Improve the visual-setup command to handle CORS:

1. Add --download-toolbar flag to visual-setup command
2. Implement toolbar download functionality to local project
3. Update generated HTML to use local script when downloaded
4. Add --serve flag to start simple HTTP server after setup
5. Provide clear instructions about CORS in command output

Location: `/opencode/packages/opencode/src/cli/cmd/visual-setup.ts` Dependencies: Node.js https
module, fs module

### Sub-Agent 3: Development Server Integration

Add built-in development server for visual mode:

1. Create simple HTTP server in visual/dev-server.ts
2. Add dgmo visual serve command to start dev server
3. Integrate with existing visual mode infrastructure
4. Auto-open browser when server starts
5. Provide CORS-enabled server for local development

Location: `/opencode/packages/opencode/src/visual/dev-server.ts` Dependencies: Node.js http module,
existing visual server

## Integration Requirements

1. All solutions must work with existing visual mode infrastructure
2. Maintain zero-configuration philosophy where possible
3. Provide clear error messages explaining CORS to users
4. Ensure backward compatibility with current visual mode usage
5. Update all relevant documentation with new options

## Technical Constraints

- Must work with Stagewise toolbar version 0.4.9
- Maintain SRPC protocol compatibility
- Don't modify core visual server functionality
- Keep terminal-first approach
- Ensure all solutions work cross-platform

## Success Criteria

1. Users can load Stagewise toolbar without CORS errors
2. Clear documentation explains all available solutions
3. visual-setup command provides automated solutions
4. Example files demonstrate each approach
5. Built-in dev server option available
6. Error messages guide users to solutions
7. All existing visual mode features still work
8. No breaking changes to current API

## Testing Approach

After implementation:

1. Test example HTML files with each solution
2. Verify visual-setup --download-toolbar works
3. Test dgmo visual serve command
4. Confirm Stagewise toolbar connects to DGMO
5. Test on Windows, macOS, and Linux
6. Verify all documentation is accurate
7. Test error messages are helpful

## Known Issues & Solutions

- Issue: CORS blocks loading from file:// protocol Solution: Provide multiple approaches (HTTP
  server, local script, dgmo server)

- Issue: Users may not understand CORS Solution: Add clear explanations in docs and error messages

- Issue: Different frameworks have different setups Solution: Framework-specific examples and
  instructions

## Important Notes

- CORS is a browser security feature, not a bug in our code
- The visual mode server itself works perfectly
- This is about making the user experience smoother
- Focus on education and providing easy solutions
- Remember: DGMSTT is a self-improving tool - make it easy to improve

Start by searching memory for the mentioned queries to understand the current state, then launch
your sub-agents to complete the implementation. Focus on making visual mode accessible to all users
regardless of their web development experience.
