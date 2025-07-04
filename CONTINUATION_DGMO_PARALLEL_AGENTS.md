# Instructions for Next DGMO Parallel Agent Execution Implementation

You are continuing the implementation of DGMO's parallel agent execution system. The project is 0% complete with requirements gathered and architecture planned. Your task is to implement the complete parallel agent system with tool selection, sub-session management, and inline task display.

## Project Context

- Working Directory: `/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode`
- Key Repositories: `/packages/opencode` (TypeScript), `/packages/tui` (Go)
- Architecture Doc: See memory snapshots for existing agent mode implementation
- Related Systems: Task tool, Session management, TUI components, MCP integration

## Memory Search Commands

First, retrieve the current project state and patterns:

1. Search: "DGMO agent mode implementation complete session filtering"
2. Search: "DGMO Tasks UI implementation WebSocket real-time"
3. Search: "DGMO tool filtering bug session-level fix"
4. Search: "DGMO sub-session management agent tracking"
5. Search: "DGMO MCP integration vision capabilities always available"

## Completed Components (DO NOT RECREATE)

✅ Agent Mode System - Full implementation with modes (but has filtering bug)
✅ TUI /agent Command - Working dialog for mode selection
✅ Configuration System - Persists agentMode in config.json
✅ CLI Support - --agent-mode flag works
✅ Tool Lists - Defined in agent-config.ts
✅ Tasks UI Panel - WebSocket-based real-time updates (as separate panel)
✅ MCP Integration - Fully functional and must remain accessible
✅ Vision Capabilities - Working in all modes

## Critical Files to Reference

1. **Agent Configuration:**

   - `/packages/opencode/src/config/agent-config.ts` - Tool filtering lists
   - `/packages/opencode/src/session/index.ts:425` - Bug: uses global mode instead of session mode
   - `/packages/opencode/src/tool/task.ts:111` - Sets session mode but not retrieved

2. **Task Tool:**

   - `/packages/opencode/src/tool/task.ts` - Main task execution
   - `/packages/opencode/src/tool/task.txt` - Documentation
   - `/packages/opencode/src/events/task-events/` - Event system

3. **TUI Components:**

   - `/packages/tui/internal/tui/tui.go` - Main TUI handler
   - `/packages/tui/internal/components/dialog/agent.go` - Agent dialog
   - `/packages/tui/internal/app/app.go` - Chat message handling

4. **Session Management:**
   - `/packages/opencode/src/session/index.ts` - Session creation
   - `/packages/opencode/src/storage/storage.ts` - Persistence layer

## Required Tasks (USE 4 SUB-AGENTS IN PARALLEL)

### Sub-Agent 1: Fix Tool Filtering & Enhance Task Tool [CRITICAL]

**Reflexion Pattern**: Learn from previous bug where session mode wasn't used

- Fix session/index.ts:425 to use: `AgentConfig.getSessionAgentMode(session) || await AgentConfig.getAgentMode()`
- Ensure DGMO main agent ALWAYS has all tools (check if it's a sub-agent session)
- Modify task.ts to always run in parallel (remove sequential execution)
- Add automatic failure detection and debugging without user intervention
- Generate backend summaries for DGMO context (not shown to user)
- Test with both read-only and all-tools modes
  Location: `/packages/opencode/src/session/` and `/packages/opencode/src/tool/`
  Dependencies: AgentConfig, Session system

### Sub-Agent 2: Implement Sub-Session Storage & Management

**Hierarchical Decomposition**: Parent sessions contain child sub-sessions

- Create SubSession type extending Session with parentSessionId
- Implement storage in Storage namespace with date/time organization
- Add search functionality by task description
- Implement storage limits and cleanup policies
- Create deletion capabilities for users
- Store complete agent execution history
- Ensure sub-sessions persist across DGMO restarts
  Location: `/packages/opencode/src/session/sub-session.ts` (new)
  Dependencies: Storage, Session types

### Sub-Agent 3: Create /sub-session Command & Navigation

**ReAct Pattern**: Thought → Action → Observation for navigation flow

- Implement /sub-session command in TUI (Go)
- Create dropdown dialog showing all sub-sessions for current session
- Display: agent name, task summary, timestamp, status
- Implement navigation into sub-session (show full history)
- Add Ctrl+B to return to parent session
- Maintain navigation stack for nested sessions
- Update command registry and help text
  Location: `/packages/tui/internal/components/dialog/subsession.go` (new)
  Dependencies: TUI framework, Session API

### Sub-Agent 4: Implement Inline Task Display in Chat

**Iterative Refinement**: Start simple, then add progress updates

- Modify chat rendering to include agent task status
- Display format: "Agent 1: [current activity with tool calls]"
- Stack multiple agents vertically (Agent 1, then 2, then 3)
- Show "✓ Completed" when done (keep visible)
- Real-time updates via existing WebSocket infrastructure
- Integrate with chat flow (after user input, before DGMO response)
- Ensure clean visual hierarchy
  Location: `/packages/tui/internal/tui/tui.go` and `/packages/opencode/src/cli/`
  Dependencies: WebSocket events, Chat renderer

## Integration Requirements

1. **Tool Access Rules**:

   - Main DGMO: ALWAYS all tools
   - Sub-agents: Respect mode (read-only or all-tools)
   - MCP & Vision: ALWAYS available regardless of mode

2. **Parallel Execution**:

   - Maximum 3 concurrent sub-agents
   - Automatic task delegation for complex requests
   - Context isolation between agents

3. **UI/UX Consistency**:
   - Use existing dropdown patterns for /sub-session
   - Match aesthetic of other commands
   - Clear visual indicators for agent activity

## Technical Constraints

- **Backward Compatibility**: Don't break existing functionality
- **Performance**: Handle 50+ sub-sessions efficiently
- **Security**: Enforce tool restrictions at session level
- **Architecture**: Maintain clean separation between TypeScript and Go

## Success Criteria

1. Tool filtering works correctly (read-only agents cannot write/edit/bash)
2. All agent tasks execute in parallel (up to 3 concurrent)
3. Sub-sessions are created, stored, and searchable
4. /sub-session command shows dropdown with navigation
5. Inline task display shows real-time agent activity
6. Automatic failure handling without user prompts
7. Backend summaries sent to DGMO for context
8. MCP and vision work in all modes
9. Main DGMO always has full tool access
10. Clean visual integration with existing UI

## Testing Approach

After implementation:

1. Test tool filtering: Create read-only agent, verify write/edit/bash blocked
2. Test parallel execution: Complex task spawning 3 agents
3. Test sub-session storage: Create, search, delete operations
4. Test navigation: Enter/exit sub-sessions with Ctrl+B
5. Test inline display: Verify real-time updates
6. Test failure handling: Force agent errors, verify auto-recovery
7. Test MCP access: Verify MCP tools work in read-only mode
8. Performance test: 50+ sub-sessions

## Known Issues & Solutions

- Issue: Previous tool filtering used global mode instead of session mode
  Solution: Use session-specific mode with getSessionAgentMode()
- Issue: WeakMap may not persist across session boundaries
  Solution: Store mode in session object itself
- Issue: Tasks UI was separate panel
  Solution: Integrate inline with chat flow instead

## Important Notes

- Default mode is ALWAYS read-only for safety
- /agents command changes mode for current session only
- Sub-agents are context isolated but share parent session ID
- Automatic agent creation for complex tasks to save context
- Remember: DGMO philosophy - powerful, efficient, user-friendly

Start by searching memory for the mentioned queries to understand the current state, then launch your sub-agents to complete the implementation. Focus on the tool filtering fix first as it's critical for security.

## Multi-Agent Coordination Strategy

**Supervisor Agent (You)**: Orchestrate the 4 sub-agents below, monitor progress, integrate results

**Communication Protocol**:

- Each agent reports status via structured updates
- Agents share discoveries through memory storage
- Supervisor handles conflicts and dependencies

**Reflexion Implementation**:

1. Each agent stores self-reflections on what worked/failed
2. Use these reflections to improve subsequent attempts
3. If an agent fails, analyze the failure and retry with improvements
4. Store successful patterns for future use

**Hierarchical Structure**:

```
Supervisor (Main DGMO)
├── Sub-Agent 1: Core Fixes (Critical Path)
├── Sub-Agent 2: Storage Layer
├── Sub-Agent 3: UI Commands
└── Sub-Agent 4: Display Integration
```

**Parallel Execution Plan**:

- Agents 1 & 2 start immediately (independent)
- Agent 3 depends on Agent 2's storage API
- Agent 4 can start UI work, integrate later
- Continuous integration as components complete
