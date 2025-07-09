# Evolution UI System

**Agent ID: user-approval-workflow-004**

## Overview

The Evolution UI system provides a beautiful and functional Terminal User Interface (TUI) for evolution visualization, approval, and monitoring within DGMO. It enables users to review, approve, or reject code evolutions with full transparency and control.

## Architecture

### Components

1. **EvolutionUI** (`index.ts`)
   - Main integration class that connects the UI to the Evolution Bridge
   - Manages approval dialogs and event handling
   - Provides API for external integration

2. **ApprovalDialog** (`ApprovalDialog.ts`)
   - Interactive dialog for reviewing evolution changes
   - Shows safety scores, impact assessment, and performance metrics
   - Supports keyboard navigation and diff viewing

3. **EvolutionStore** (`store.ts`)
   - State management for evolution data
   - Handles auto-approval logic
   - Manages filtering and real-time updates

4. **Theme** (`theme.ts`)
   - Consistent styling with ANSI colors
   - Box drawing characters and icons
   - Progress indicators and formatting helpers

5. **Utils** (`utils.ts`)
   - Diff formatting and colorization
   - Duration and byte formatting
   - Text manipulation utilities

## Features

### 1. Evolution Approval Workflow

```typescript
// Initialize the UI
const evolutionUI = createEvolutionUI({
  bridge: evolutionBridge,
  autoApprovalEnabled: true,
  minSafetyScore: 80,
})

// Show approval dialog
const result = await evolutionUI.showApprovalDialog(evolutionId)
// Returns: 'approved' | 'rejected' | 'cancelled'
```

### 2. Safety Score Visualization

- Overall safety score with progress bar
- Category breakdown:
  - API Compatibility
  - Test Coverage
  - Performance Impact
  - Security Risk
  - Code Quality
- Recommendations: Safe, Caution, or Risky

### 3. Impact Assessment

- Impact levels: Low, Medium, High, Critical
- Shows affected files and functions
- Test coverage percentage
- Breaking changes detection
- Clear visual indicators

### 4. Performance Metrics

- Execution time improvements
- Memory usage changes
- CPU usage optimization
- Visual indicators for improvements/regressions

### 5. Code Change Preview

- Syntax-highlighted diff view
- File-by-file navigation
- Line change statistics
- Toggle between list and diff views

### 6. Auto-Approval System

Configure automatic approval for safe evolutions:

```typescript
evolutionUI.setAutoApprovalSettings({
  enabled: true,
  minSafetyScore: 85,
  maxImpactLevel: "medium",
  requireTests: true,
  excludePatterns: ["*.config.js", "package.json"],
  notificationPreferences: {
    onEvolutionStart: true,
    onAwaitingApproval: true,
    onAutoApproval: true,
    onFailure: true,
    onCompletion: true,
  },
})
```

## Keyboard Shortcuts

### Approval Dialog

- **A** - Approve evolution
- **R** - Reject evolution
- **D** - Toggle diff view
- **↑/K** - Navigate up
- **↓/J** - Navigate down
- **ESC** - Cancel

### Dashboard (Future)

- **⏎** - View details
- **H** - History
- **S** - Settings
- **R** - Refresh
- **?** - Help
- **Q** - Quit

## Integration

### With Evolution Bridge

```typescript
import { EvolutionBridge } from "../bridge"
import { createEvolutionUI } from "./ui"

const bridge = new EvolutionBridge(config, dgmBridge)
const ui = createEvolutionUI({ bridge })

// Listen for approval events
ui.on("approval-needed", async (evolution) => {
  const result = await ui.showApprovalDialog(evolution.id)
  console.log(`Evolution ${evolution.id} was ${result}`)
})
```

### With TUI Framework

The UI components are designed to integrate with the existing Go-based TUI:

1. TypeScript components generate terminal-formatted output
2. Go TUI renders the output and handles input
3. Events are passed between systems via WebSocket

## Visual Design

### Color Scheme

- **Primary**: Cyan (#00D9FF) - Main UI elements
- **Success**: Green (#00FF88) - Positive changes
- **Warning**: Orange (#FFB800) - Caution items
- **Danger**: Red (#FF3366) - Critical issues
- **Info**: Blue (#00A6FF) - Information

### Layout

```
╭─ Evolution Approval - evo_1234567890_abc ──────── AWAITING-APPROVAL ─╮
│                                                                      │
│ Safety Score: [████████████████░░░░] 85% ✓ SAFE                    │
│                                                                      │
│ Impact: •• MEDIUM - 3 files, 85% test coverage                      │
│                                                                      │
│ Performance: ↑ 20% execution, ↓ 10% memory                          │
│                                                                      │
│ Changes (3 files):                                                   │
│ ──────────────────────────────────────────────────────────────────  │
│  > + src/evolution/bridge.ts +45 -12                                │
│    ~ src/evolution/types.ts +10 -5                                  │
│    ~ src/test/evolution.test.ts +20 -0                              │
│                                                                      │
╰─ [A]pprove │ [R]eject │ [D]iff │ [↑↓] Navigate │ [ESC] Cancel ─────╯
```

## Testing

Run tests with:

```bash
bun test src/evolution/ui/*.test.ts
```

## Future Enhancements

1. **Evolution Dashboard**
   - List view of all evolutions
   - Filtering and search
   - Batch operations

2. **Evolution History**
   - Timeline view
   - Rollback capabilities
   - Performance trends

3. **Settings Panel**
   - Configure auto-approval rules
   - Notification preferences
   - Theme customization

4. **Real-time Updates**
   - WebSocket integration for live progress
   - Push notifications
   - Multi-user collaboration

## Accessibility

- High contrast colors
- Clear visual hierarchy
- Keyboard-only navigation
- Screen reader compatible output

## Performance

- Efficient diff rendering
- Lazy loading for large change sets
- Minimal memory footprint
- Fast keyboard response

## Security

- No direct file system access
- Sanitized diff output
- Secure WebSocket communication
- Audit trail for all approvals
