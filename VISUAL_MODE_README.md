# DGMO Visual Mode Integration

This branch implements visual mode for DGMO, enabling seamless browser-to-terminal communication
using the Stagewise toolbar protocol.

## Overview

Visual mode allows you to:

- Select UI elements in your browser using the Stagewise toolbar
- Have those selections appear as prompts in your DGMO terminal session
- Get AI assistance for UI development without switching contexts
- Work entirely in the terminal while testing in the browser

## Architecture

### Components Created

1. **WebSocket Server** (`/opencode/packages/opencode/src/visual/server.ts`)
   - Implements SRPC protocol compatible with Stagewise
   - Runs on port 5746 (auto-increments if busy)
   - Handles `getSessionInfo` and `triggerAgentPrompt` methods
   - Publishes visual prompts to the Bus event system

2. **Terminal Integration** (`/opencode/packages/opencode/src/cli/cmd/run.ts`)
   - Added `--visual` flag to enable visual mode
   - Starts WebSocket server alongside terminal chat
   - Subscribes to visual prompt events
   - Displays visual selections in terminal with context

3. **Stagewise Adapter** (`/opencode/packages/opencode/src/visual/stagewise-adapter.ts`)
   - Makes DGMO discoverable by Stagewise toolbar
   - Manages active visual mode sessions
   - Provides session info in Stagewise format

4. **Setup Command** (`/opencode/packages/opencode/src/cli/cmd/visual-setup.ts`)
   - Framework detection (React, Vue, Angular, Svelte, vanilla)
   - Installation instructions for each framework
   - Optional HTML injection for quick setup
   - Configuration examples for Vite and Next.js

## Usage

### Quick Start

1. **Start DGMO with visual mode:**

   ```bash
   dgmo run --visual "help me style this component"
   ```

2. **Setup your project (optional):**

   ```bash
   dgmo visual-setup
   # or inject toolbar automatically
   dgmo visual-setup --inject
   ```

3. **Open your app in the browser**
   - The Stagewise toolbar will auto-detect DGMO
   - Select any UI element and add a comment
   - Your selection appears in the terminal

### Manual Setup

For React/Vue/Svelte projects:

```bash
npm install @stagewise/toolbar
```

Then import in your app:

```javascript
import '@stagewise/toolbar';
import '@stagewise/toolbar/style.css';

// Add to your layout/app component
<stagewise-toolbar framework="react"></stagewise-toolbar>;
```

For vanilla HTML:

```html
<!-- Add before </body> -->
<script type="module">
  if (!document.querySelector('stagewise-toolbar')) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@stagewise/toolbar@latest/dist/index.js';
    document.head.appendChild(script);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/@stagewise/toolbar@latest/dist/style.css';
    document.head.appendChild(link);

    const toolbar = document.createElement('stagewise-toolbar');
    toolbar.setAttribute('framework', 'auto');
    document.body.appendChild(toolbar);
  }
</script>
```

## How It Works

1. **Discovery**: Stagewise toolbar scans ports 5746-5756 for DGMO instances
2. **Connection**: Toolbar connects via WebSocket using SRPC protocol
3. **Selection**: User selects elements and adds comments in browser
4. **Transmission**: Selection data sent to DGMO visual server
5. **Processing**: DGMO receives prompt and processes with AI
6. **Response**: AI generates code changes based on visual context

## Protocol Details

### SRPC Methods

**getSessionInfo**

- Returns session ID, app name, display name, and port
- Used by toolbar to identify DGMO instances

**triggerAgentPrompt**

- Receives prompt, files, mode, and images
- Publishes to Bus event system
- Returns success/error status

### Event Flow

```
Browser Selection → Stagewise Toolbar → WebSocket → DGMO Server
                                                          ↓
Terminal Display ← Bus Event System ← Visual Prompt Event
```

## Testing

1. Create a test HTML file:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Visual Mode Test</title>
  </head>
  <body>
    <button class="btn-secondary">Test Button</button>

    <!-- Stagewise toolbar -->
    <script type="module">
      // Toolbar injection code here
    </script>
  </body>
</html>
```

2. Start DGMO:

```bash
dgmo run --visual "help me style this button"
```

3. Open HTML file in browser
4. Select the button with Stagewise toolbar
5. Add comment: "make this primary color"
6. See prompt appear in terminal with DOM context

## Troubleshooting

### Toolbar not connecting

- Ensure DGMO is running with `--visual` flag
- Check console for connection errors
- Verify port 5746 is not blocked

### No visual prompts appearing

- Check DGMO terminal for "Visual mode active" message
- Ensure toolbar shows DGMO in connection list
- Verify WebSocket connection in browser DevTools

### Framework detection issues

- Run `dgmo visual-setup --framework=react` (or your framework)
- Check package.json has correct dependencies
- Manually specify framework in toolbar attribute

## Future Enhancements

- [ ] Bidirectional communication (terminal → browser highlighting)
- [ ] Multiple browser connections to single session
- [ ] Visual diff preview in browser
- [ ] Component tree navigation
- [ ] CSS extraction and modification
- [ ] Screenshot capture integration

## Development

To work on visual mode:

1. Clone this branch:

```bash
git worktree add -b visual-mode-integration ../DGMSTT-visual-mode
```

2. Install dependencies:

```bash
cd opencode/packages/opencode
bun install
```

3. Make changes and test:

```bash
bun run dev
```

## Integration Points

- **Bus Events**: `visual.prompt` event for visual selections
- **Session**: Visual prompts processed as regular chat messages
- **UI**: Visual indicators in terminal output
- **Config**: No configuration needed, works out of the box

## Credits

Built on top of:

- [Stagewise](https://github.com/stagewise/stagewise) - Visual coding toolbar
- [DGMO](https://dgmo.ai) - AI coding assistant
- SRPC protocol for IDE communication
