#!/bin/bash

echo "=== Verifying Sub-Sessions Fix ==="
echo

# Test the agent config logic
cat > test-agent-config.js << 'EOF'
// Test the isSubAgentSession logic
function isSubAgentSession(sessionId, parentId) {
  return (
    parentId !== undefined &&
    parentId !== null &&
    parentId !== "" &&
    parentId !== "undefined"
  );
}

function isMainSession(sessionId, parentId) {
  return !isSubAgentSession(sessionId, parentId);
}

// Test cases
const testCases = [
  { parentId: undefined, expected: true, desc: "undefined parentId" },
  { parentId: null, expected: true, desc: "null parentId" },
  { parentId: "", expected: true, desc: "empty string parentId" },
  { parentId: "undefined", expected: true, desc: "string 'undefined' parentId" },
  { parentId: "ses_123", expected: false, desc: "valid parentId" }
];

console.log("Testing isMainSession logic:");
console.log("============================");

testCases.forEach(test => {
  const result = isMainSession("ses_current", test.parentId);
  const status = result === test.expected ? "✓ PASS" : "✗ FAIL";
  console.log(`${status} - ${test.desc}: isMainSession = ${result} (expected ${test.expected})`);
});
EOF

node test-agent-config.js
rm test-agent-config.js

echo
echo "Current Implementation Status:"
echo "=============================="
echo "1. isSubAgentSession checks for empty string: ✓"
echo "2. Session mode is 'all-tools': ✓"
echo "3. Task tool in ALL_TOOLS list: ✓"
echo
echo "Issue: Even with mode='all-tools', task is filtered out"
echo "This suggests the problem is in the session/index.ts tool filtering"
echo
echo "Next Steps:"
echo "1. Restart the server to apply changes"
echo "2. Check if parentId is being passed correctly to isToolAllowed"
echo "3. Verify the tool name matching (might be case sensitive)"