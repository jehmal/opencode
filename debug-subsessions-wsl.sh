#!/bin/bash
# WSL Sub-Sessions Debug Script

echo "=== DGMO Sub-Sessions Debug (WSL) ==="
echo ""
echo "Choose an option:"
echo "1. Run diagnostic test"
echo "2. Monitor storage in real-time" 
echo "3. Check storage directly"
echo "4. Run all tests"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Running diagnostic test..."
        bun run test-subsessions-wsl.ts
        ;;
    2)
        echo ""
        echo "Starting real-time monitor..."
        echo "Create agents in DGMO and watch the output here!"
        bun run monitor-subsessions-wsl.ts
        ;;
    3)
        echo ""
        echo "Checking storage files..."
        
        # Find opencode storage
        STORAGE_BASE="$HOME/.local/share/opencode/project"
        
        if [ -d "$STORAGE_BASE" ]; then
            echo "Storage base: $STORAGE_BASE"
            echo ""
            
            # List projects
            for project in "$STORAGE_BASE"/*; do
                if [ -d "$project" ]; then
                    echo "Project: $(basename "$project")"
                    
                    # Check sub-sessions
                    SUB_DIR="$project/storage/session/sub-sessions"
                    if [ -d "$SUB_DIR" ]; then
                        count=$(find "$SUB_DIR" -name "*.json" 2>/dev/null | wc -l)
                        echo "  Sub-sessions: $count files"
                        
                        # Show recent ones
                        echo "  Recent sub-sessions:"
                        find "$SUB_DIR" -name "*.json" -printf "    %f (modified: %TY-%Tm-%Td %TH:%TM)\n" 2>/dev/null | sort -r | head -3
                    else
                        echo "  Sub-sessions: Directory not found"
                    fi
                    
                    # Check index files
                    INDEX_DIR="$project/storage/session/sub-session-index"
                    if [ -d "$INDEX_DIR" ]; then
                        count=$(find "$INDEX_DIR" -name "*.json" 2>/dev/null | wc -l)
                        echo "  Index files: $count"
                        
                        # Show recent ones
                        echo "  Recent indexes:"
                        for idx in $(find "$INDEX_DIR" -name "*.json" -printf "%T@ %p\n" 2>/dev/null | sort -rn | head -3 | cut -d' ' -f2); do
                            session_id=$(basename "$idx" .json)
                            sub_count=$(jq '. | length' "$idx" 2>/dev/null || echo "?")
                            echo "    - $session_id: $sub_count sub-sessions"
                        done
                    else
                        echo "  Index files: Directory not found"
                    fi
                    
                    echo ""
                fi
            done
        else
            echo "Storage directory not found: $STORAGE_BASE"
        fi
        ;;
    4)
        echo ""
        echo "Running all tests..."
        echo ""
        echo "=== TEST 1: Diagnostic ==="
        bun run test-subsessions-wsl.ts
        echo ""
        echo "Press Enter to continue..."
        read
        echo "=== TEST 2: Storage Check ==="
        $0 3  # Run option 3
        ;;
    *)
        echo "Invalid choice!"
        ;;
esac

echo ""
echo "Press Enter to exit..."
read
