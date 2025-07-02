#!/usr/bin/env python3
"""
DGMO Branding Update Script
Updates all OpenCode references to DGMO in Python files and related configurations
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Color codes for terminal output
class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'

def print_step(message: str):
    print(f"\n{Colors.BLUE}==>{Colors.END} {message}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓{Colors.END} {message}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠{Colors.END} {message}")

def print_error(message: str):
    print(f"{Colors.RED}✗{Colors.END} {message}")

# Replacement patterns
REPLACEMENTS = {
    # Package names
    r'@opencode-dgm': '@dgmo',
    r'opencode-dgm': 'dgmo',
    r'opencode_dgm': 'dgmo',
    
    # Proper names
    r'OpenCode-DGM': 'DGMO',
    r'OpenCode DGM': 'DGMO',
    r'OpenCode\+DGM': 'DGMO',
    r'OpenCode \+ DGM': 'DGMO',
    
    # Environment variables
    r'OPENCODE_': 'DGMO_',
    
    # Class/Interface names
    r'OpenCodeContext': 'DGMOContext',
    r'setupOpenCodeIntegration': 'setupDGMOIntegration',
    r'OpenCodeIntegration': 'DGMOIntegration',
    
    # Comments and docs
    r'OpenCode-specific': 'DGMO-specific',
    r'OpenCode Integration': 'DGMO Integration',
    r'OpenCode TypeScript Service': 'DGMO TypeScript Service',
    
    # Commands
    r'opencode run': 'dgmo run',
    r'opencode evolve': 'dgmo evolve',
    r'opencode tui': 'dgmo tui',
    r'opencode --help': 'dgmo --help',
    r'`opencode': '`dgmo',
    r"'opencode": "'dgmo",
    r'"opencode': '"dgmo',
    
    # Paths
    r'/opencode/opencode': '/opencode/dgmo',
    r'opencode/opencode': 'opencode/dgmo',
    r'setup-opencode-dgm': 'setup-dgmo',
    
    # Miscellaneous
    r'OpenCode launcher': 'DGMO launcher',
    r'OpenCode is working': 'DGMO is working',
    r'OpenCode test failed': 'DGMO test failed',
    r'OpenCode execution failed': 'DGMO execution failed',
    r'OpenCode help works': 'DGMO help works',
}

# File patterns to process
FILE_PATTERNS = {
    'Python': ['*.py'],
    'TypeScript': ['*.ts', '*.tsx'],
    'JavaScript': ['*.js', '*.jsx'],
    'Markdown': ['*.md'],
    'JSON': ['*.json'],
    'YAML': ['*.yml', '*.yaml'],
    'Shell': ['*.sh'],
    'Docker': ['Dockerfile*', 'docker-compose*.yml'],
    'Config': ['.env.example', 'Makefile', '*.conf'],
}

# Files to rename
FILE_RENAMES = {
    'setup-opencode-dgm.sh': 'setup-dgmo.sh',
    'examples/opencode-integration.ts': 'examples/dgmo-integration.ts',
    'opencode/opencode': 'opencode/dgmo',
}

def update_file_content(filepath: Path, dry_run: bool = False) -> bool:
    """Update content of a single file with all replacements."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_content = f.read()
    except Exception as e:
        print_error(f"Could not read {filepath}: {e}")
        return False
    
    modified_content = original_content
    
    # Apply all replacements
    for pattern, replacement in REPLACEMENTS.items():
        modified_content = re.sub(pattern, replacement, modified_content)
    
    # Check if content was modified
    if modified_content != original_content:
        if not dry_run:
            try:
                # Create backup
                backup_path = filepath.with_suffix(filepath.suffix + '.bak')
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(original_content)
                
                # Write modified content
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(modified_content)
                
                # Remove backup
                backup_path.unlink()
                
                print_success(f"Updated: {filepath}")
            except Exception as e:
                print_error(f"Could not update {filepath}: {e}")
                return False
        else:
            print_success(f"Would update: {filepath}")
        return True
    
    return False

def find_files_to_update(root_dir: Path) -> Dict[str, List[Path]]:
    """Find all files that need updating, organized by type."""
    files_by_type = {file_type: [] for file_type in FILE_PATTERNS}
    
    # Directories to skip
    skip_dirs = {'.git', 'node_modules', '__pycache__', 'venv', 'dist', 'build', '.next'}
    
    for file_type, patterns in FILE_PATTERNS.items():
        for pattern in patterns:
            if '*' in pattern:
                # It's a glob pattern
                for filepath in root_dir.rglob(pattern):
                    if not any(skip_dir in filepath.parts for skip_dir in skip_dirs):
                        files_by_type[file_type].append(filepath)
            else:
                # It's a specific filename
                filepath = root_dir / pattern
                if filepath.exists():
                    files_by_type[file_type].append(filepath)
    
    return files_by_type

def rename_files(root_dir: Path, dry_run: bool = False) -> List[Tuple[Path, Path]]:
    """Rename files according to the rename mapping."""
    renamed = []
    
    for old_name, new_name in FILE_RENAMES.items():
        old_path = root_dir / old_name
        new_path = root_dir / new_name
        
        if old_path.exists():
            if not dry_run:
                try:
                    new_path.parent.mkdir(parents=True, exist_ok=True)
                    old_path.rename(new_path)
                    print_success(f"Renamed: {old_name} → {new_name}")
                except Exception as e:
                    print_error(f"Could not rename {old_name}: {e}")
                    continue
            else:
                print_success(f"Would rename: {old_name} → {new_name}")
            
            renamed.append((old_path, new_path))
    
    return renamed

def check_remaining_references(root_dir: Path):
    """Check for any remaining OpenCode references."""
    print_step("Checking for remaining OpenCode references...")
    
    remaining_files = []
    patterns_to_check = ['opencode', 'OpenCode', 'OPENCODE']
    
    for pattern in patterns_to_check:
        try:
            import subprocess
            result = subprocess.run(
                ['grep', '-r', pattern, str(root_dir), 
                 '--exclude-dir=node_modules', '--exclude-dir=.git',
                 '--exclude-dir=venv', '--exclude-dir=dist',
                 '--exclude=*.bak', '-l'],
                capture_output=True, text=True
            )
            
            if result.returncode == 0:
                files = result.stdout.strip().split('\n')
                remaining_files.extend(f for f in files if f)
        except Exception:
            pass
    
    if remaining_files:
        print_warning(f"Found {len(set(remaining_files))} files with remaining references")
        for f in sorted(set(remaining_files))[:10]:
            print(f"  - {f}")
        if len(set(remaining_files)) > 10:
            print(f"  ... and {len(set(remaining_files)) - 10} more")
    else:
        print_success("No remaining OpenCode references found!")

def main():
    """Main function to run the branding update."""
    print(f"{Colors.BLUE}")
    print("╔═══════════════════════════════════════════╗")
    print("║   DGMO Branding Update (Python)           ║")
    print("║   Replacing OpenCode references           ║")
    print("╚═══════════════════════════════════════════╝")
    print(f"{Colors.END}")
    
    # Parse command line arguments
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        print_warning("Running in DRY RUN mode - no files will be modified")
    
    # Get root directory
    root_dir = Path.cwd()
    
    # Check if we're in the right directory
    if not (root_dir / '.git').exists():
        print_error("Not in a git repository. Please run from the project root.")
        sys.exit(1)
    
    # Find files to update
    print_step("Scanning for files to update...")
    files_by_type = find_files_to_update(root_dir)
    
    total_files = sum(len(files) for files in files_by_type.values())
    print(f"Found {total_files} files to check")
    
    # Update files by type
    updated_count = 0
    for file_type, files in files_by_type.items():
        if files:
            print_step(f"Updating {file_type} files ({len(files)} files)...")
            for filepath in files:
                if update_file_content(filepath, dry_run):
                    updated_count += 1
    
    # Rename files
    print_step("Renaming files...")
    renamed = rename_files(root_dir, dry_run)
    
    # Summary
    print(f"\n{Colors.GREEN}{'='*50}")
    print(f"✓ Branding Update Complete!")
    print(f"{'='*50}{Colors.END}")
    print(f"\nSummary:")
    print(f"  - Files updated: {updated_count}")
    print(f"  - Files renamed: {len(renamed)}")
    
    if not dry_run:
        # Check for remaining references
        check_remaining_references(root_dir)
        
        print(f"\n{Colors.BLUE}Next steps:{Colors.END}")
        print("  1. Review changes: git diff")
        print("  2. Run tests to verify functionality")
        print("  3. Commit changes: git commit -am 'feat: Update branding from OpenCode to DGMO'")
    else:
        print(f"\n{Colors.YELLOW}This was a dry run. To apply changes, run without --dry-run{Colors.END}")

if __name__ == "__main__":
    main()