#!/usr/bin/env bun
/**
 * Test different prompts to see what triggers the task tool
 */

console.log("=== TASK TOOL TRIGGER PATTERNS ===\n")

console.log("Based on task.txt, the task tool is designed for:")
console.log("- Launching agents to search for keywords")
console.log("- Research tasks across multiple files")
console.log("- Concurrent agent execution\n")

console.log("Try these prompts in DGMO:\n")

console.log("1. Research prompt (should work):")
console.log('   "Use an agent to search for all files containing "config" in this codebase"\n')

console.log("2. Multi-agent research (should work):")
console.log('   "Launch 2 agents: one to find all error handling code, another to find all test files"\n')

console.log("3. Explicit task tool usage:")
console.log('   "Use the task tool to create an agent that writes a poem about nature"\n')

console.log("4. Direct agent instruction:")
console.log('   "Launch an agent with the task: Write a short poem about debugging code"\n')

console.log("\nThe issue is that 'Create X agents to write poems' doesn't match")
console.log("the expected patterns for the task tool based on its description.")
console.log("\nThe task tool expects research/search tasks, not creative tasks.")
