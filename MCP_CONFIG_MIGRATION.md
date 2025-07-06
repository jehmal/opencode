# MCP Configuration Migration Summary

## Issue

The config directory was changed from `~/.config/opencode/` to `~/.config/dgmo/` in the codebase, which broke the user's existing MCP server configurations.

## Root Cause

In `packages/opencode/src/global/index.ts`, line 5 sets the app name to `"dgmo"`, which changes the config directory path used by the XDG base directory specification.

## Solution Implemented

Successfully migrated all MCP server configurations from the old location to the new location.

### What Was Done:

1. **Identified the issue**: Found that the old config had 5 MCP servers configured, but the new location only had 1
2. **Created backup**: Saved the existing dgmo config as `~/.config/dgmo/config.json.backup`
3. **Merged configurations**: Combined all MCP servers into the new config file, preserving:
   - All 5 MCP servers (qdrant, prompt-tech, system-design-primer, mcp-finder, build-x)
   - Their enabled states
   - Environment variables (for qdrant)
   - Command paths and arguments

### MCP Servers Migrated:

- **qdrant**: Vector database MCP with environment variables for Qdrant connection
- **prompt-tech**: Prompting techniques MCP server
- **system-design-primer**: System design learning MCP server
- **mcp-finder**: MCP server finder/discovery tool
- **build-x**: Build your own X tutorial MCP server

## Verification

The migrated configuration is valid JSON and contains all the MCP servers from the original configuration.

## Next Steps

You'll need to restart the opencode process for the changes to take effect. The MCP servers should then be available with all their original functionality.

## Files Modified

- `/home/jehma/.config/dgmo/config.json` - Updated with all MCP server configurations
- `/home/jehma/.config/dgmo/config.json.backup` - Backup of the previous dgmo config
