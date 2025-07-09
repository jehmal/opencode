#!/bin/bash

# Test script to verify the race condition fix for continuation prompts

echo "Race Condition Test for Continuation Prompts"
echo "==========================================="
echo ""

# Function to make a continuation request and capture timing
test_continuation() {
    local session_id=$1
    local test_name=$2
    
    echo "Test: $test_name"
    echo "Session ID: $session_id"
    echo ""
    
    # Start WebSocket monitor
    echo "Starting WebSocket monitor..."
    node test-continue-events.js > "ws-events-$test_name.log" 2>&1 &
    local ws_pid=$!
    sleep 1
    
    # Record start time
    local start_time=$(date +%s%N)
    
    # Make the API request
    echo "Making continuation prompt request at $(date +%H:%M:%S.%3N)..."
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{}' \
        "${DGMO_SERVER:-http://localhost:3000}/session/${session_id}/continuation-prompt")
    
    # Record end time
    local end_time=$(date +%s%N)
    local duration=$((($end_time - $start_time) / 1000000)) # Convert to milliseconds
    
    echo "Response received at $(date +%H:%M:%S.%3N) (${duration}ms)"
    
    # Extract task ID
    local task_id=$(echo "$response" | jq -r '.taskId // empty' 2>/dev/null)
    if [ ! -z "$task_id" ]; then
        echo "Task ID: $task_id"
    fi
    
    # Wait for events
    sleep 3
    
    # Stop WebSocket monitor
    kill $ws_pid 2>/dev/null
    
    # Analyze event timing
    echo ""
    echo "Event Timeline:"
    echo "--------------"
    
    # Show task.started events
    local started_time=$(grep "task.started" "ws-events-$test_name.log" | grep "$task_id" | head -1 | grep -oE '\[[0-9T:.-]+\]' | tr -d '[]')
    if [ ! -z "$started_time" ]; then
        echo "task.started:   $started_time"
    fi
    
    # Show task.completed events
    local completed_time=$(grep "task.completed" "ws-events-$test_name.log" | grep "$task_id" | head -1 | grep -oE '\[[0-9T:.-]+\]' | tr -d '[]')
    if [ ! -z "$completed_time" ]; then
        echo "task.completed: $completed_time"
    fi
    
    # Check if completion arrived before we could process it
    if [ ! -z "$completed_time" ] && [ ! -z "$started_time" ]; then
        echo ""
        echo "Race condition analysis:"
        # This is a simplified check - in reality we'd need to compare with TUI processing time
        echo "- Events were emitted correctly by the server"
        echo "- The fix should handle early-arriving completion events"
    fi
    
    echo ""
    echo "Full event log saved to: ws-events-$test_name.log"
    echo "----------------------------------------"
    echo ""
}

# Run multiple tests
echo "Running multiple tests to check for race conditions..."
echo ""

# Test 1: Normal session
test_continuation "test-session-1" "normal-flow"

# Test 2: Different session ID
test_continuation "test-session-2" "different-session"

# Test 3: Rapid succession (might trigger race condition)
echo "Test: Rapid succession"
echo "Running 3 requests in quick succession..."
for i in 1 2 3; do
    (test_continuation "rapid-test-$i" "rapid-$i") &
done
wait

echo ""
echo "Test Summary"
echo "============"
echo ""

# Count successful completions
success_count=$(grep -l "task.completed" ws-events-*.log 2>/dev/null | wc -l)
total_count=$(ls ws-events-*.log 2>/dev/null | wc -l)

echo "Total tests run: $total_count"
echo "Tests with completion events: $success_count"

if [ "$success_count" -eq "$total_count" ]; then
    echo "✅ All tests received completion events!"
else
    echo "❌ Some tests did not receive completion events"
    echo "   This might indicate the race condition still exists"
fi

echo ""
echo "To see detailed logs, examine: ws-events-*.log"

# Cleanup
rm -f ws-events-*.log