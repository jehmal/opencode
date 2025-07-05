"""
Example: Cross-language tool execution
Shows how Python can call TypeScript tools and vice versa
"""
import asyncio
import sys
sys.path.append('/mnt/c/Users/jehma/Desktop/AI/DGMSTT')

from protocol.python import ToolProtocol, ToolRegistry
from dgm.tools import bash, edit

async def main():
    # Initialize protocol with TypeScript bridge
    await ToolProtocol.initialize(
        load_typescript_tools=True,
        tool_modules=['../../opencode/packages/opencode/src/tool/bash.ts']
    )
    
    # Register Python tools
    ToolRegistry.register_python_tool(bash)
    ToolRegistry.register_python_tool(edit)
    
    print("Available tools:")
    for tool in ToolProtocol.list_tools():
        print(f"  - {tool['id']} ({tool['language']}): {tool['description'][:50]}...")
    
    # Python calling TypeScript tool
    print("\n1. Python calling TypeScript bash tool:")
    result = await ToolProtocol.execute_tool(
        'bash',
        parameters={'command': 'echo "Hello from TypeScript bash!"', 'description': 'Test echo'},
        language='typescript'
    )
    print(f"   Output: {result.output}")
    
    # Python calling Python tool
    print("\n2. Python calling Python bash tool:")
    result = await ToolProtocol.execute_tool(
        'bash',
        parameters={'command': 'echo "Hello from Python bash!"'},
        language='python'
    )
    print(f"   Output: {result.output}")
    
    # Auto-detection (prefers Python)
    print("\n3. Auto-detection (should use Python):")
    result = await ToolProtocol.execute_tool(
        'bash',
        parameters={'command': 'echo "Auto-detected!"'}
    )
    print(f"   Output: {result.output}")
    
    # Shutdown
    await ToolProtocol.shutdown()

if __name__ == '__main__':
    asyncio.run(main())