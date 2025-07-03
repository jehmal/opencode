# Instructions for Next DGMO Terminal-Based Stagewise Integration Agent

You are continuing the implementation of DGMO Visual Mode Integration. The project is 0% complete
with DGMO fully functional and Stagewise analyzed. Your task is to integrate Stagewise's visual
coding capabilities into DGMO's terminal chat interface, enabling users to select UI elements in
their browser and have those selections appear as prompts in their active DGMO terminal session.

## Project Context

- Working Directory: /mnt/c/Users/jehma/Desktop/AI/DGMSTT
- Key Repositories:
  - DGMO Core: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode
  - Stagewise: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/stagewise
  - DGM Integration: /mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm
- Architecture: Terminal-first approach where DGMO runs in terminal and receives visual prompts
- Related Systems: MCP servers, Evolution Engine, Tool Protocol

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "DGMO MCP NATIVE INTEGRATION Phase 3 Complete"
2. Search: "Stagewise SRPC communication toolbar extension"
3. Search: "DGMO terminal chat interface CLI commands"
4. Search: "CONTINUATION PROMPT TEMPLATE dgmo integration"
5. Search: "WebSocket server TypeScript implementation patterns"

## Completed Components (DO NOT RECREATE)

✅ DGMO Core System - Terminal-based AI coding assistant with chat interface ✅ MCP Native
Integration - 12 MCP commands fully implemented ✅ Evolution Engine - DGM integration with
TypeScript orchestration ✅ DGMO Branding - Complete rebranding from OpenCode to DGMO ✅ Tool
Protocol - Unified tool system with performance tracking ✅ Stagewise Analysis - Full understanding
of toolbar/extension architecture

## Critical Files to Reference

### DGMO Terminal Components:

- /opencode/packages/opencode/src/cli/cmd/index.ts - CLI command registry
- /opencode/packages/opencode/src/cli/cmd/run.ts - Main chat interface
- /opencode/packages/opencode/src/session/index.ts - Session management
- /opencode/packages/opencode/src/ui/ui.ts - Terminal UI components

### Stagewise Communication:

- /stagewise/packages/extension-toolbar-srpc-contract/src/contract.ts - SRPC protocol
- /stagewise/toolbar/core/src/srpc.ts - Toolbar discovery mechanism
- /stagewise/apps/vscode-extension/src/utils/dispatch-agent-call.ts - Agent routing

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: DGMO Visual Mode Server

Create WebSocket server that runs alongside DGMO terminal session

- Create /opencode/packages/opencode/src/visual/server.ts
- Implement SRPC server compatible with Stagewise protocol
- Start server when user runs: dgmo --visual or dgmo run --visual
- Display server status in terminal: "Visual mode active on port 5746"
- Route incoming prompts to active terminal chat session
- Handle multiple browser connections to single DGMO instance Location:
  /opencode/packages/opencode/src/visual/ Dependencies: WebSocket, SRPC contract, existing session
  management

### Sub-Agent 2: Terminal Chat Integration

Modify DGMO chat to receive and display visual prompts

- Extend RunCommand to accept --visual flag
- Create visual prompt injection into active chat stream
- Add visual context indicator: "🎯 Visual selection from browser:"
- Parse and format DOM context for terminal display
- Maintain chat history with visual selections marked
- Add visual mode status to terminal UI header Location:
  /opencode/packages/opencode/src/cli/cmd/run.ts Dependencies: Existing chat interface, visual
  server

### Sub-Agent 3: Stagewise DGMO Adapter

Create minimal adapter to make DGMO appear as supported IDE

- Create /opencode/packages/opencode/src/visual/stagewise-adapter.ts
- Implement getSessionInfo to identify DGMO terminal sessions
- Handle triggerAgentPrompt by forwarding to terminal chat
- Add DGMO detection to Stagewise toolbar
- Ensure toolbar auto-connects to running DGMO instances
- Support session ID for multi-terminal scenarios Location: /opencode/packages/opencode/src/visual/
  Dependencies: SRPC contract, terminal session tracking

### Sub-Agent 4: Browser Integration & Setup

Create seamless browser-to-terminal experience

- Add dgmo visual setup command for project configuration
- Create toolbar injection helper for common frameworks
- Implement visual context formatter for terminal display
- Add visual mode indicators and connection status
- Create examples showing visual mode usage
- Write documentation for visual workflow Location:
  /opencode/packages/opencode/src/cli/cmd/visual-setup.ts Dependencies: Framework detection, toolbar
  configuration

## Integration Requirements

1. **Terminal-First**: Visual selections must appear in active DGMO terminal chat
2. **No IDE Required**: Works with just terminal + browser, no VS Code needed
3. **Session Persistence**: Visual mode survives page refreshes
4. **Context Preservation**: Full DOM/component info passed to terminal
5. **Bidirectional Flow**: Terminal can request browser to highlight elements

## Technical Constraints

- **Single Server**: One DGMO instance = one visual server (no port conflicts)
- **Terminal UI**: Visual prompts must render cleanly in terminal
- **Chat Flow**: Visual selections integrate naturally into conversation
- **Performance**: Minimal overhead on normal DGMO operation
- **Stagewise Compatibility**: Must speak exact SRPC protocol

## Success Criteria

1. Run `dgmo --visual` starts terminal chat with visual server
2. Browser toolbar auto-detects and connects to DGMO
3. Selecting elements sends formatted prompts to terminal
4. Visual prompts appear inline in terminal chat
5. DGMO processes visual context and generates appropriate code
6. Connection status visible in both terminal and browser
7. Works without any IDE or VS Code extension
8. Multiple browser tabs can connect to same DGMO session
9. Visual mode can be toggled on/off during chat
10. Terminal shows clear visual selection indicators

## Testing Approach

After implementation:

1. Start DGMO with: dgmo run --visual "help me fix this button"
2. Open browser to localhost app with Stagewise toolbar
3. Select button element and add comment
4. Verify prompt appears in terminal with DOM context
5. Test DGMO generates correct code changes
6. Test connection recovery after browser refresh
7. Test multiple browser windows to same session
8. Verify clean terminal UI with visual indicators

## Known Issues & Solutions

- Issue: Stagewise expects VS Code-like extension Solution: Minimal adapter that mimics VS Code SRPC
  responses

- Issue: Terminal can't display rich DOM trees Solution: Smart formatting with collapsible context
  sections

- Issue: Port conflicts with other tools Solution: Auto-increment from 5746 if port in use

- Issue: Toolbar might not auto-detect DGMO Solution: Broadcast presence on localhost for discovery

## Important Notes

- DGMO terminal remains the primary interface
- Visual mode is an enhancement, not a replacement
- Browser selections are just another input method
- The terminal chat history should show visual context clearly
- Remember: Users work in terminal but test in browser

Start by searching memory for the mentioned queries to understand the current state, then launch
your sub-agents to complete the implementation. Focus on creating a seamless terminal-to-browser
experience where visual selections enhance the existing DGMO chat workflow.

## Workflow Example

1. Developer runs: `dgmo run --visual "help me style this component"`
2. DGMO starts with: "Visual mode active on port 5746 🎯"
3. Developer opens localhost:3000 in browser with Stagewise toolbar
4. Selects a button element and comments "make this primary color"
5. In terminal, the developer sees:
   ```
   🎯 Visual selection from browser:
   Component: Button (React)
   Path: src/components/Button.tsx
   User comment: "make this primary color"
   DOM: <button class="btn-secondary">Click me</button>
   ```
6. DGMO processes this context and responds with appropriate code changes
7. Developer continues chatting in terminal with visual context available
