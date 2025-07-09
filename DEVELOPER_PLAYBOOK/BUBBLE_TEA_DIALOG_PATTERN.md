# Bubble Tea Dialog Pattern: Essential Guide

## The Golden Rule

**When creating a Bubble Tea dialog that loads data, you MUST call its Init() method and append the returned command to your command batch.**

```go
// ✅ CORRECT - Dialog will load data
dialog := NewMyDialog(params)
a.modal = dialog
cmds = append(cmds, dialog.Init())  // Critical!

// ❌ WRONG - Dialog will show "Loading..." forever
dialog := NewMyDialog(params)
a.modal = dialog
// Missing Init() call - commands never execute!
```

## Why This Happens

Bubble Tea uses a command-based architecture:

1. Components return `tea.Cmd` (functions that return messages)
2. The framework executes these commands asynchronously
3. Results come back as messages to your `Update` method
4. If you don't execute the initial command, nothing happens!

## Complete Pattern Implementation

### 1. Dialog Structure

```go
type myDialog struct {
    app         *app.App
    data        []DataItem
    loading     bool
    error       error
}

// Init returns the command to execute when dialog opens
func (d *myDialog) Init() tea.Cmd {
    return d.loadData()
}

// loadData returns a command that fetches data asynchronously
func (d *myDialog) loadData() tea.Cmd {
    return func() tea.Msg {
        // This runs asynchronously
        data, err := d.fetchDataFromServer()
        return dataLoadedMsg{
            data: data,
            err:  err,
        }
    }
}

// Update handles the result
func (d *myDialog) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case dataLoadedMsg:
        d.loading = false
        if msg.err != nil {
            d.error = msg.err
        } else {
            d.data = msg.data
        }
    }
    return d, nil
}

// View renders based on state
func (d *myDialog) View() string {
    if d.loading {
        return "Loading..."
    }
    if d.error != nil {
        return fmt.Sprintf("Error: %v", d.error)
    }
    // Render data
}
```

### 2. Message Types

```go
// Define messages for async results
type dataLoadedMsg struct {
    data []DataItem
    err  error
}

type dataItem struct {
    ID   string
    Name string
}
```

### 3. Creating the Dialog

```go
// In your main model's Update method
case "open-dialog":
    dialog := NewMyDialog(a.app)
    a.modal = dialog

    // CRITICAL: Execute the initial command!
    return a, dialog.Init()

    // Or if you have other commands:
    // cmds = append(cmds, dialog.Init())
    // return a, tea.Batch(cmds...)
```

## Common Variations

### Multiple Initial Commands

```go
func (d *myDialog) Init() tea.Cmd {
    return tea.Batch(
        d.loadUserData(),
        d.loadSettings(),
        d.startPolling(),
    )
}
```

### Conditional Loading

```go
func (d *myDialog) Init() tea.Cmd {
    if d.cachedData != nil {
        return nil  // No loading needed
    }
    return d.loadData()
}
```

### Delayed Loading

```go
func (d *myDialog) Init() tea.Cmd {
    // Load after 500ms delay
    return tea.Tick(500*time.Millisecond, func(t time.Time) tea.Msg {
        return startLoadingMsg{}
    })
}
```

## Debugging Checklist

If your dialog shows "Loading..." forever:

- [ ] Is `Init()` method defined?
- [ ] Is `Init()` being called when creating the dialog?
- [ ] Is the returned command being executed? (append to cmds)
- [ ] Does your load function return a proper `tea.Cmd`?
- [ ] Is your `Update` method handling the response message?

## Quick Debug Test

Add this to verify Init is called:

```go
func (d *myDialog) Init() tea.Cmd {
    // Debug log
    log.Println("Dialog Init() called!")
    return d.loadData()
}
```

If you don't see the log, Init() isn't being called.

## Real Example from DGMO

```go
// The fix that made checkpoints work
revertDialog := dialog.NewRevertDialog(a.app)
a.modal = revertDialog
cmds = append(cmds, revertDialog.Init())  // This line was missing!
```

Without that last line, the dialog opened but never loaded checkpoints, even though the server was working perfectly.

## Remember

**Bubble Tea dialogs are passive by default. They won't do anything unless you explicitly execute their initial commands by calling Init()!**
