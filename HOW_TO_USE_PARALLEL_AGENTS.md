# How to Use Parallel Agents in DGMO

## What We've Implemented

1. **`/agent` command** - Sets the mode (read-only or all-tools) for sub-agents
2. **Task Tool Enabled** - The task tool is now available to DGMO
3. **System Prompt Updated** - DGMO knows it should use task tools for parallel agents

## How DGMO Should Handle Parallel Agent Requests

When a user says something like:

- "use your sub agents to create 3 poems about Kendrick and Drake"
- "create multiple agents to analyze this code"
- "launch parallel agents to..."

DGMO should:

1. **Recognize the request** for parallel agents
2. **Use the task tool** (shown as "Agent" in the UI) to create real sub-agents
3. **Call multiple task tools in ONE message** to make them run in parallel

## Example Response

When user says: "use your sub agents to create 3 poems about Kendrick and Drake"

DGMO should respond like this:

```
I'll create 3 parallel sub-agents to write unique poems about Kendrick and Drake.

[Agent Tool 1]
prompt: "Write a 20-line poem about the Kendrick and Drake beef from a hip-hop historian's perspective. Focus on their rise to fame, the competitive nature of hip-hop, and specific album references. Make it lyrical with a clear rhyme scheme."

[Agent Tool 2]
prompt: "Create a 20-line poem analyzing the Kendrick vs Drake rivalry from a technical rap perspective. Compare their different styles, flow patterns, wordplay, and production choices. Include specific examples from their songs."

[Agent Tool 3]
prompt: "Compose a 20-line poem about the cultural impact of Kendrick and Drake's rivalry. Explore what their competition means for hip-hop culture, their different audiences, and the genre's evolution."
```

## Important Notes

1. **DO NOT** simulate agents with bash commands or file writes
2. **DO NOT** write the poems yourself sequentially
3. **DO** use actual Agent/task tools that will create sub-sessions
4. **DO** call all tools in one message for parallel execution

## After Implementation

- The sub-agents will work in parallel
- Their results will be returned to DGMO
- Sub-sessions will be created (viewable with `/sub-session`)
- Each agent respects the mode set by `/agent` command

## Current Status

✅ Task tool is now enabled in the codebase
✅ `/agent` command works for setting mode
✅ System prompt includes parallel agent instructions
❌ DGMO needs to start using the task tool instead of simulating agents

The next time you try, DGMO should use the actual Agent tool to create real parallel sub-agents!
