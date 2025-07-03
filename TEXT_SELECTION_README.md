# DGMO Terminal Text Selection (WSL/Linux)

## Quick Solution for WSL Users

**To select text in WSL terminal: Hold Shift + Click and drag!**

This is standard behavior in WSL and Linux terminals. The terminal needs Shift to distinguish
between application mouse events and text selection.

## How to Select and Copy Text

### WSL/Linux Terminals

1. **Hold Shift** while clicking and dragging to select text
2. **Shift + Right-click** to copy (or **Ctrl+Shift+C**)
3. **Ctrl+Shift+V** to paste

### Windows Terminal (Native)

1. Click and drag to select (no Shift needed)
2. **Ctrl+C** or right-click to copy
3. **Ctrl+V** to paste

### macOS Terminal

1. Click and drag to select
2. **Cmd+C** to copy
3. **Cmd+V** to paste

## Why Shift is Required in WSL/Linux

WSL and Linux terminals use mouse events for various purposes (like terminal applications with mouse
support). To distinguish between application mouse events and text selection:

- **Without Shift**: Mouse events go to the application
- **With Shift**: Terminal enters text selection mode

This is standard behavior across most Linux terminal emulators including:

- Windows Terminal (WSL mode)
- GNOME Terminal
- Konsole
- xterm
- And many others

## No Code Changes Needed!

DGMO works perfectly with your terminal's built-in text selection. The application displays a
helpful reminder about using mouse selection, and that's all that's needed.
