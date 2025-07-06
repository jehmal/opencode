# Using Tasks UI with the `dgmo` Command

## Quick Answer: YES!

The Tasks UI works with your normal `dgmo` command in WSL. I've made the necessary modifications so that when you run `dgmo`, it will:

1. Start the backend server
2. Start the task event WebSocket server on port 5747
3. Launch the Go TUI with Tasks panel support

## How to Use

### Normal Usage (Just Works!)

```bash
# In your WSL terminal, just run:
dgmo

# The TUI will start with Tasks UI support enabled
```

### Using the Tasks Panel

Once in the TUI:

1. **Show/Hide Tasks Panel**: Press `Ctrl+T`
2. **Switch Focus**: Press `Tab` to switch between chat and tasks panel
3. **Navigate Tasks**: Use arrow keys when the panel is focused

### Creating Tasks

To see tasks in action, request parallel agents:

```
Create 3 agents to analyze this codebase
```

Or:

```
Use your sub agents to write 3 different implementations of a sorting algorithm
```

## What Changed

I made two small modifications to enable this:

1. **Added WebSocket server startup** in `tui.ts`:

   - The task event server now starts automatically when you run `dgmo`
   - It stops cleanly when you exit the TUI

2. **Fixed WebSocket URL** in the Go TUI:
   - Changed from trying to connect to `/tasks` endpoint
   - Now connects directly to `ws://localhost:5747`

## Troubleshooting

If you don't see tasks appearing:

1. **Check WebSocket Connection**: The TUI will show a connection error in logs if it can't connect
2. **Ensure Port 5747 is Free**: The task event server needs this port
3. **Check Task Tool**: Make sure you're in "all-tools" mode (the default)

## Build Status

The TUI has been rebuilt with these changes and is ready to use. The next time the TypeScript code is built, it will include the task event server startup.

## Visual Features

When tasks are running, you'll see:

- 🔍 Search tasks
- 📝 Edit/write tasks
- 🚀 Build tasks
- 🧪 Test tasks
- Animated spinners for running tasks
- Progress bars with percentages
- Elapsed time counters
- Color-coded status indicators

The panel maintains a professional appearance similar to k9s or lazygit.
