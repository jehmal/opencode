# Parallel Agents Example for DGMO

## When User Asks for Parallel Agents

### BAD (What NOT to do):

```bash
# DON'T simulate agents with bash
echo "Creating 3 agents..."
echo "Agent 1 writing poem..." > poem1.txt
```

### GOOD (What TO do):

When user says: "use your sub agents to create 3 poems about Kendrick and Drake"

You should respond with ONE message containing MULTIPLE task tool uses:

```
I'll create 3 parallel sub-agents to write poems about Kendrick and Drake from different perspectives.

[Task Tool 1]
prompt: "Write a 20-line poem about the Kendrick and Drake beef from a hip-hop historian's perspective. Focus on the historical context, their rise to fame, and how this beef fits into hip-hop's competitive tradition. Include specific references to their albums and key moments."

[Task Tool 2]
prompt: "Create a 20-line poem analyzing the Kendrick vs Drake beef from a technical rap perspective. Focus on their different styles, lyrical techniques, flow patterns, and production choices. Compare their approaches to crafting verses and hooks."

[Task Tool 3]
prompt: "Compose a 20-line poem about the cultural impact of the Kendrick and Drake rivalry. Explore what their beef represents for hip-hop culture, their different fan bases, and the broader implications for the genre's future."
```

## Key Points:

1. Use the `task` tool (also shown as "Agent" in the UI)
2. All task tools must be in ONE message to run in parallel
3. Each agent gets a detailed, specific prompt
4. Agents work independently and return results
5. Results will appear as they complete

## The agents will:

- Run simultaneously (not sequentially)
- Have access to tools based on /agent mode setting
- Create sub-sessions visible with /sub-session command
- Return their results which you then present to the user
