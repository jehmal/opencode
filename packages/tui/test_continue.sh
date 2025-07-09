#!/usr/bin/env bash

# Test script for debugging /continue command
echo "=== DGMO Continue Command Debug Test ==="
echo "This will run dgmo-debug and capture continuation-related debug output"
echo ""
echo "Instructions:"
echo "1. Type a message to start a conversation"
echo "2. Wait for the response"
echo "3. Type /continue"
echo "4. Watch for continuation behavior"
echo "5. Press Ctrl+C to exit and see filtered logs"
echo ""
echo "Starting dgmo-debug..."
echo ""

# Create log files
LOG_FILE="continue_test_full.log"
FILTERED_LOG="continue_test_filtered.log"
ERROR_LOG="continue_test_errors.log"

# Clear previous logs
> "$LOG_FILE"
> "$FILTERED_LOG"
> "$ERROR_LOG"

# Function to filter logs on exit
cleanup() {
    echo ""
    echo "=== Filtering continuation-related logs ==="
    
    # Filter for continuation-related messages
    grep -E -i "(continue|continuation|Continue|CONTINUE|handleContinue|session\.continue|continueConversation)" "$LOG_FILE" > "$FILTERED_LOG"
    
    # Also check for errors
    grep -E -i "(error|ERROR|Error|failed|Failed|FAILED)" "$LOG_FILE" > "$ERROR_LOG"
    
    echo ""
    echo "Log files created:"
    echo "- Full log: $LOG_FILE ($(wc -l < "$LOG_FILE") lines)"
    echo "- Filtered log: $FILTERED_LOG ($(wc -l < "$FILTERED_LOG") lines)"
    echo "- Error log: $ERROR_LOG ($(wc -l < "$ERROR_LOG") lines)"
    
    if [ -s "$FILTERED_LOG" ]; then
        echo ""
        echo "Last 20 continuation-related messages:"
        tail -20 "$FILTERED_LOG"
    else
        echo ""
        echo "No continuation-related messages found!"
    fi
    
    if [ -s "$ERROR_LOG" ]; then
        echo ""
        echo "Errors found:"
        cat "$ERROR_LOG"
    fi
    
    exit 0
}

# Set up trap to run cleanup on exit
trap cleanup INT TERM EXIT

# Run dgmo-debug with output capture
./dgmo-debug 2>&1 | tee "$LOG_FILE"