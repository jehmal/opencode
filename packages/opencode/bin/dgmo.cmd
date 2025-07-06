@echo off
setlocal enabledelayedexpansion

if defined DGMO_BIN_PATH (
    set "resolved=%DGMO_BIN_PATH%"
    goto :execute
)
rem Get the directory of this script
set "script_dir=%~dp0"
set "script_dir=%script_dir:~0,-1%"

rem Find the project root (where packages directory is)
set "project_root=%script_dir%"

:find_root
if exist "%project_root%\packages\tui" goto :found_root
rem Move up one directory
for %%i in ("%project_root%") do set "parent_dir=%%~dpi"
set "parent_dir=%parent_dir:~0,-1%"
rem Check if we've reached the root
if "%project_root%"=="%parent_dir%" goto :root_not_found
set "project_root=%parent_dir%"
goto :find_root

:root_not_found
echo Error: Could not find project root directory >&2
exit /b 1

:found_root
rem Look for the TUI binary
set "binary=dgmo.exe"
set "resolved=%project_root%\packages\tui\%binary%"

if not exist "%resolved%" (
    rem Try the root directory as fallback
    set "resolved=%project_root%\%binary%"
    
    if not exist "!resolved!" (
        echo Error: DGMO TUI binary not found >&2
        echo Please build the TUI first by running: >&2
        echo   cd %project_root%\packages\tui ^&^& go build -o %binary% cmd/dgmo/main.go >&2
        exit /b 1
    )
)

:execute
rem Execute the binary with all arguments
"%resolved%" %*