"""
Python bridge server for cross-language tool protocol
"""
import asyncio
import argparse
from .protocol import ToolProtocol

async def main():
    parser = argparse.ArgumentParser(description='Python Tool Protocol Bridge')
    parser.add_argument('--mode', choices=['server', 'client'], default='server',
                        help='Run as server (for TypeScript) or client')
    parser.add_argument('--tools-dir', help='Directory containing Python tools to load')
    
    args = parser.parse_args()
    
    if args.tools_dir:
        from .registry import ToolRegistry
        count = ToolRegistry.load_tools_directory(args.tools_dir)
        print(f"Loaded {count} tools from {args.tools_dir}", file=sys.stderr)
    
    if args.mode == 'server':
        await ToolProtocol.run_server()
    else:
        # Client mode - for testing
        print("Client mode not implemented yet")

if __name__ == '__main__':
    asyncio.run(main())