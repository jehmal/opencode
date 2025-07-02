#!/bin/bash
# OpenCode + DGM One-Click Setup Script
# This script sets up the self-improving AI coding assistant

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Header
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║   OpenCode + DGM Setup Script             ║"
echo "║   Self-Improving AI Coding Assistant      ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check prerequisites
print_step "Checking prerequisites..."

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Python3 found: $PYTHON_VERSION"
else
    print_error "Python3 not found. Please install Python 3.8 or higher."
    exit 1
fi

# Check Bun
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    print_success "Bun found: $BUN_VERSION"
else
    print_warning "Bun not found. Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    if command -v bun &> /dev/null; then
        print_success "Bun installed successfully"
    else
        print_error "Failed to install Bun. Please install manually: https://bun.sh"
        exit 1
    fi
fi

# Check Docker (optional but recommended)
if command -v docker &> /dev/null; then
    print_success "Docker found (optional, for sandboxing)"
else
    print_warning "Docker not found. DGM sandboxing will be limited."
fi

# Setup Python environment for DGM
print_step "Setting up DGM (Python environment)..."

cd "$SCRIPT_DIR/dgm"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Created Python virtual environment"
else
    print_success "Python virtual environment already exists"
fi

# Activate virtual environment and install dependencies
source venv/bin/activate

# Install required packages
print_step "Installing Python dependencies..."
pip install --quiet --upgrade pip

# Check if requirements.txt exists
if [ -f "requirements.txt" ]; then
    pip install --quiet -r requirements.txt
    print_success "Installed Python requirements"
else
    # Install essential packages manually
    print_warning "requirements.txt not found, installing essential packages..."
    pip install --quiet pydantic anthropic openai pytest beautifulsoup4 GitPython python-dotenv
    print_success "Installed essential Python packages"
fi

# Additional packages for DGM integration
pip install --quiet jsonrpclib-pelix
print_success "Installed JSON-RPC library"

deactivate
cd ..

# Setup TypeScript/Bun environment for OpenCode
print_step "Setting up OpenCode (TypeScript/Bun environment)..."

cd "$SCRIPT_DIR/opencode"

# Install dependencies
print_step "Installing TypeScript dependencies..."
bun install
print_success "Installed TypeScript/Bun dependencies"

# Create the executable wrapper
print_step "Creating OpenCode executable..."

cat > opencode << 'EOF'
#!/usr/bin/env bash
# OpenCode launcher script

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Set up environment
export OPENCODE_ROOT="$DIR"
export DGM_ROOT="$DIR/../dgm"

# Activate Python environment for DGM if needed
if [ -d "$DGM_ROOT/venv" ]; then
    source "$DGM_ROOT/venv/bin/activate" 2>/dev/null || true
fi

# Run OpenCode with all arguments
exec bun "$DIR/packages/opencode/src/index.ts" "$@"
EOF

chmod +x opencode
print_success "Created opencode executable"

# Test the installation
print_step "Testing OpenCode installation..."

if ./opencode --help &> /dev/null; then
    print_success "OpenCode is working!"
else
    print_error "OpenCode test failed. Checking for issues..."
    
    # Try running directly
    if bun packages/opencode/src/index.ts --help &> /dev/null; then
        print_warning "Direct execution works, but wrapper failed"
    else
        print_error "OpenCode execution failed. Check error messages above."
    fi
fi

# Create global command (optional)
print_step "Setting up global command..."

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"

# Create global launcher
cat > "$INSTALL_DIR/opencode" << EOF
#!/usr/bin/env bash
exec "$SCRIPT_DIR/opencode/opencode" "\$@"
EOF

chmod +x "$INSTALL_DIR/opencode"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" == *":$INSTALL_DIR:"* ]]; then
    print_success "Global command installed to $INSTALL_DIR/opencode"
else
    print_warning "Add $INSTALL_DIR to your PATH to use 'opencode' from anywhere"
    echo -e "   Add this to your ~/.bashrc or ~/.zshrc:"
    echo -e "   ${YELLOW}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
fi

# Create test script
print_step "Creating test script..."

cd "$SCRIPT_DIR"
cat > test-setup.sh << 'EOF'
#!/bin/bash
# Test script to verify OpenCode + DGM setup

echo "Testing OpenCode + DGM Integration..."
echo

# Test 1: OpenCode help
echo "1. Testing OpenCode help command..."
if ./opencode/opencode --help > /dev/null 2>&1; then
    echo "   ✓ OpenCode help works"
else
    echo "   ✗ OpenCode help failed"
    exit 1
fi

# Test 2: Evolution command
echo "2. Testing evolution command..."
if ./opencode/opencode evolve --help > /dev/null 2>&1; then
    echo "   ✓ Evolution command available"
else
    echo "   ✗ Evolution command not found"
    exit 1
fi

# Test 3: Python bridge
echo "3. Testing Python bridge..."
cd dgm
source venv/bin/activate
if python -c "import sys; sys.path.append('.'); from coding_agent import AgenticSystem" 2>/dev/null; then
    echo "   ✓ DGM imports work"
else
    echo "   ✗ DGM import failed"
    exit 1
fi
deactivate
cd ..

echo
echo "✅ All tests passed! OpenCode + DGM is ready to use."
echo
echo "Try these commands:"
echo "  opencode run \"create a hello world in Python\""
echo "  opencode evolve --help"
echo "  opencode tui"
EOF

chmod +x test-setup.sh

# Final summary
echo
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo
echo "OpenCode + DGM has been successfully set up!"
echo
echo -e "${BLUE}Quick Start:${NC}"
echo "  cd $SCRIPT_DIR/opencode"
echo "  ./opencode --help"
echo
echo -e "${BLUE}Or use globally (if PATH is set):${NC}"
echo "  opencode run \"write a Python function\""
echo "  opencode evolve  # After some usage"
echo
echo -e "${BLUE}Test the setup:${NC}"
echo "  cd $SCRIPT_DIR"
echo "  ./test-setup.sh"
echo
echo -e "${YELLOW}Note:${NC} The evolution features will activate after you've used"
echo "OpenCode for several coding tasks to gather performance data."
echo

# Create quick start guide
cat > QUICK_START.txt << EOF
OpenCode + DGM Quick Reference
==============================

Basic Commands:
  opencode run "your coding task"    # Run a coding task
  opencode tui                       # Interactive terminal UI
  opencode evolve                    # Analyze and evolve
  opencode evolve --auto-apply       # Apply improvements

Evolution Commands:
  opencode evolve --analyze          # Analysis only, no changes
  opencode evolve --verbose          # Detailed output
  opencode evolve --min-samples=10   # Set minimum data threshold

Location:
  Executable: $SCRIPT_DIR/opencode/opencode
  Global: $HOME/.local/bin/opencode (if PATH is set)

Troubleshooting:
  - If "command not found": Use full path or check PATH
  - If Python errors: cd dgm && source venv/bin/activate
  - If TypeScript errors: cd opencode && bun install
EOF

print_success "Created QUICK_START.txt for reference"

# Offer to run test
echo
read -p "Would you like to run the test suite now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./test-setup.sh
fi