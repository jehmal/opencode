# DGMO Sub-Sessions Debug PowerShell Script
Write-Host "=== DGMO Sub-Sessions Debug Suite ===" -ForegroundColor Cyan
Write-Host ""

function Show-Menu {
    Write-Host "Choose an option:" -ForegroundColor Yellow
    Write-Host "1. Run full diagnostic test" -ForegroundColor Green
    Write-Host "2. Monitor storage in real-time" -ForegroundColor Green
    Write-Host "3. Simulate task execution" -ForegroundColor Green
    Write-Host "4. Check storage files directly" -ForegroundColor Green
    Write-Host "5. Run all tests" -ForegroundColor Green
    Write-Host "6. Exit" -ForegroundColor Red
    Write-Host ""
}

function Check-Storage {
    Write-Host "`nChecking storage files..." -ForegroundColor Yellow
    
    $storagePath = "$env:LOCALAPPDATA\opencode\project"
    
    if (Test-Path $storagePath) {
        Write-Host "Storage base path: $storagePath" -ForegroundColor Cyan
        
        # Find all project directories
        $projects = Get-ChildItem -Path $storagePath -Directory
        
        foreach ($project in $projects) {
            Write-Host "`nProject: $($project.Name)" -ForegroundColor Yellow
            
            # Check sub-sessions
            $subSessionPath = Join-Path $project.FullName "storage\session\sub-sessions"
            if (Test-Path $subSessionPath) {
                $subSessions = Get-ChildItem -Path $subSessionPath -Filter "*.json"
                Write-Host "  Sub-sessions: $($subSessions.Count) files" -ForegroundColor Green
                
                # Show last 3
                $subSessions | Select-Object -Last 3 | ForEach-Object {
                    $content = Get-Content $_.FullName | ConvertFrom-Json
                    Write-Host "    - $($_.Name): Parent=$($content.parentSessionId), Status=$($content.status)" -ForegroundColor Gray
                }
            } else {
                Write-Host "  Sub-sessions: Directory not found" -ForegroundColor Red
            }
            
            # Check index files
            $indexPath = Join-Path $project.FullName "storage\session\sub-session-index"
            if (Test-Path $indexPath) {
                $indexes = Get-ChildItem -Path $indexPath -Filter "*.json"
                Write-Host "  Index files: $($indexes.Count) files" -ForegroundColor Green
                
                # Show last 3
                $indexes | Select-Object -Last 3 | ForEach-Object {
                    $content = Get-Content $_.FullName | ConvertFrom-Json
                    Write-Host "    - $($_.Name): $($content.Count) sub-sessions" -ForegroundColor Gray
                }
            } else {
                Write-Host "  Index files: Directory not found" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Storage path not found: $storagePath" -ForegroundColor Red
    }
}

do {
    Show-Menu
    $choice = Read-Host "Enter your choice"
    
    switch ($choice) {
        "1" {
            Write-Host "`nRunning diagnostic test..." -ForegroundColor Yellow
            bun run test-subsessions-debug.ts
        }
        "2" {
            Write-Host "`nStarting real-time monitor..." -ForegroundColor Yellow
            Write-Host "Create agents in DGMO and watch the output here!" -ForegroundColor Cyan
            bun run monitor-subsessions.ts
        }
        "3" {
            Write-Host "`nSimulating task execution..." -ForegroundColor Yellow
            bun run simulate-task.ts
        }
        "4" {
            Check-Storage
        }
        "5" {
            Write-Host "`nRunning all tests..." -ForegroundColor Yellow
            Write-Host "`n=== TEST 1: Diagnostic ===" -ForegroundColor Cyan
            bun run test-subsessions-debug.ts
            Write-Host "`n=== TEST 2: Simulation ===" -ForegroundColor Cyan
            bun run simulate-task.ts
            Write-Host "`n=== TEST 3: Storage Check ===" -ForegroundColor Cyan
            Check-Storage
        }
        "6" {
            Write-Host "Exiting..." -ForegroundColor Red
            break
        }
        default {
            Write-Host "Invalid choice!" -ForegroundColor Red
        }
    }
    
    if ($choice -ne "6") {
        Write-Host "`nPress any key to continue..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Clear-Host
    }
} while ($choice -ne "6")
