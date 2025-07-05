@echo off
echo === Sub-Session Fix Tools ===
echo.
echo 1. Repair missing indexes (FIX THE ISSUE)
echo 2. Debug index creation
echo 3. Trace storage implementation
echo 4. Quick check current status
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Repairing indexes in WSL...
    wsl bash -c "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && bun run repair-indexes.ts"
) else if "%choice%"=="2" (
    echo.
    echo Debugging index creation...
    wsl bash -c "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && bun run debug-index-creation.ts"
) else if "%choice%"=="3" (
    echo.
    echo Tracing storage...
    wsl bash -c "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && bun run trace-storage.ts"
) else if "%choice%"=="4" (
    echo.
    echo Quick check...
    wsl bash -c "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && chmod +x quick-check.sh && ./quick-check.sh"
) else (
    echo Invalid choice!
)

echo.
pause
