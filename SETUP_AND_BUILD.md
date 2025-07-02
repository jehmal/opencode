# 🚀 Quick Setup Guide - Get OpenCode + DGM Running

## Prerequisites
Make sure you have:
- ✅ Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- ✅ Python 3.8+ with pip
- ✅ Docker (for DGM sandboxing)
- ✅ Git

## Step-by-Step Setup

### 1️⃣ Install Dependencies

```bash
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/

# Install Python dependencies for DGM
cd dgm
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Install TypeScript/Bun dependencies for OpenCode
cd opencode
bun install
cd ..
```

### 2️⃣ Build OpenCode

```bash
cd opencode

# Build all packages
bun run build

# Or if no build script exists, compile TypeScript:
cd packages/opencode
bunx tsc --noEmit  # Just to check for errors
cd ../..
```

### 3️⃣ Make OpenCode Executable

```bash
# Create a symlink or alias for easy access
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode

# Option A: Create executable script
echo '#!/usr/bin/env bun
import "./packages/opencode/src/index.ts"' > opencode
chmod +x opencode

# Option B: Add to PATH (add to ~/.bashrc or ~/.zshrc)
echo 'alias opencode="cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode && bun run packages/opencode/src/index.ts"' >> ~/.bashrc
source ~/.bashrc
```

### 4️⃣ Test Basic OpenCode

```bash
# Test that OpenCode works
opencode --help

# Should show:
# Commands:
#   opencode tui              launch the terminal UI
#   opencode run              run opencode with a message
#   opencode evolve          analyze performance and evolve opencode capabilities
#   ...
```

### 5️⃣ Test DGM Integration

```bash
# Run the integration test
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/
bun run test-integration.ts
```

## 🔧 Troubleshooting

### If "command not found":
```bash
# Use full path
/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/opencode evolve --help

# Or run directly with bun
cd /mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode
bun run packages/opencode/src/index.ts evolve --help
```

### If TypeScript errors:
```bash
# Check tsconfig.json exists
cd opencode
cat tsconfig.json

# If missing, create basic one:
echo '{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}' > tsconfig.json
```

### If Python import errors:
```bash
# Make sure you're in the virtual environment
cd dgm
source venv/bin/activate
pip install pydantic anthropic
```

## ✅ Verify Everything Works

```bash
# 1. Check OpenCode runs
opencode --version

# 2. Check evolution command exists
opencode evolve --help

# 3. Try a simple OpenCode task
opencode run "write a hello world in Python"

# 4. Check evolution (will say insufficient data at first)
opencode evolve --analyze
```

## 🎯 Quick Start Script

Save this as `setup.sh` and run it:

```bash
#!/bin/bash
set -e

echo "🚀 Setting up OpenCode + DGM..."

# Setup Python environment
echo "📦 Installing Python dependencies..."
cd dgm
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Setup TypeScript/Bun environment  
echo "📦 Installing TypeScript dependencies..."
cd opencode
bun install

# Create executable
echo "🔧 Creating opencode executable..."
cat > opencode << 'EOF'
#!/usr/bin/env bun
import "./packages/opencode/src/index.ts"
EOF
chmod +x opencode

echo "✅ Setup complete!"
echo ""
echo "Run OpenCode with:"
echo "  cd $(pwd)"
echo "  ./opencode --help"
echo ""
echo "Or add to PATH:"
echo "  export PATH=\"$(pwd):\$PATH\""
```

## 💡 After Setup

Once it's running:
1. Use OpenCode normally for a few sessions
2. Run `opencode evolve` to see performance analysis
3. Watch as your AI assistant improves over time!

The evolution features will kick in after you've used OpenCode for several tasks and generated enough performance data.