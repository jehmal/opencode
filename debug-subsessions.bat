@echo off
echo === DGMO Sub-Sessions Debug Suite ===
echo.
echo Choose an option:
echo 1. Run full diagnostic test
echo 2. Monitor storage in real-time
echo 3. Simulate task execution
echo 4. Run all tests
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Running diagnostic test...
    bun run test-subsessions-debug.ts
) else if "%choice%"=="2" (
    echo.
    echo Starting real-time monitor...
    echo Create agents in DGMO and watch the output here!
    bun run monitor-subsessions.ts
) else if "%choice%"=="3" (
    echo.
    echo Simulating task execution...
    bun run simulate-task.ts
) else if "%choice%"=="4" (
    echo.
    echo Running all tests...
    echo.
    echo === TEST 1: Diagnostic ===
    bun run test-subsessions-debug.ts
    echo.
    echo === TEST 2: Simulation ===
    bun run simulate-task.ts
    echo.
    echo Press any key to continue...
    pause > nul
) else (
    echo Invalid choice!
)

echo.
echo Press any key to exit...
pause > nul
