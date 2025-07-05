@echo off
echo === DGMO Sub-Sessions Debug (via WSL) ===
echo.
echo This will run the debug scripts inside WSL where DGMO is running.
echo.
echo Choose an option:
echo 1. Run diagnostic test
echo 2. Monitor storage in real-time
echo 3. Check storage directly
echo 4. Open WSL terminal for manual debugging
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Running diagnostic test in WSL...
    wsl bash -c "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && bun run test-subsessions-wsl.ts"
) else if "%choice%"=="2" (
    echo.
    echo Starting real-time monitor in WSL...
    echo Create agents in DGMO and watch the output here!
    wsl bash -c "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && bun run monitor-subsessions-wsl.ts"
) else if "%choice%"=="3" (
    echo.
    echo Checking storage in WSL...
    wsl bash -c "cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT && chmod +x debug-subsessions-wsl.sh && ./debug-subsessions-wsl.sh"
) else if "%choice%"=="4" (
    echo.
    echo Opening WSL terminal...
    echo Run these commands:
    echo   cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT
    echo   chmod +x debug-subsessions-wsl.sh
    echo   ./debug-subsessions-wsl.sh
    echo.
    wsl
) else (
    echo Invalid choice!
)

echo.
pause
