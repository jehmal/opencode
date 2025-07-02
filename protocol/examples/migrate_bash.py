"""
Example: Migrating the bash tool to use the protocol layer
"""
import asyncio
import sys
sys.path.append('/mnt/c/Users/jehma/Desktop/AI/DGMSTT')

from protocol.python import ToolProtocol, ToolRegistry
from dgm.tools import bash

async def main():
    # Register the existing bash tool
    ToolRegistry.register_python_tool(bash)
    
    # Now it can be called through the protocol
    result = await ToolProtocol.execute_tool(
        'bash',
        parameters={'command': 'echo "Hello from protocol layer!"'},
        language='python'
    )
    
    print(f"Output: {result.output}")
    print(f"Metadata: {result.metadata}")

if __name__ == '__main__':
    asyncio.run(main())