"""
Example: Using TypeScript tools from Python
"""

import asyncio
from pathlib import Path
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from shared.tools import (
    load_typescript_module,
    call_typescript_tool,
    tool_registry,
    error_handler,
    ErrorContext
)
from shared.types.python.tool import ToolContext, Language
from datetime import datetime


async def example():
    """Run example of cross-language tool usage"""
    try:
        # Initialize the tool registry
        await tool_registry.initialize()
        
        # Load TypeScript tools from OpenCode
        print('Loading TypeScript tools...')
        await load_typescript_module('/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/bash.ts')
        await load_typescript_module('/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/read.ts')
        
        # List all available tools
        print('\nAvailable tools:')
        tools = await tool_registry.list()
        for tool in tools:
            print(f"- {tool.name} ({tool.language.value}): {tool.description}")
        
        # Call TypeScript bash tool
        print('\nCalling TypeScript bash tool...')
        bash_result = await call_typescript_tool('bash', {
            'command': 'echo "Hello from Python calling TypeScript!"',
            'description': 'Test command'
        })
        
        print('Bash result:', bash_result)
        
        # Search for file-related tools
        print('\nSearching for file tools...')
        file_tools = await tool_registry.search('file')
        print(f'Found {len(file_tools)} file-related tools')
        
        # Demonstrate error handling
        print('\nDemonstrating error handling...')
        try:
            await call_typescript_tool('non_existent_tool', {})
        except Exception as error:
            context = ErrorContext(
                tool_id='non_existent_tool',
                language='typescript',
                parameters={},
                context=ToolContext(
                    session_id='test',
                    message_id='test-msg',
                    environment={},
                    abort_signal=asyncio.Event(),
                    timeout=30,
                    metadata={},
                    logger=None  # Will use default logger
                ),
                start_time=datetime.now()
            )
            
            handled_error = error_handler.handle_error(error, context)
            print('Handled error:', handled_error)
        
        # Get tool in specific language
        print('\nGetting bash tool in different languages...')
        python_bash = await tool_registry.get('bash', Language.PYTHON)
        ts_bash = await tool_registry.get('bash', Language.TYPESCRIPT)
        
        print('Python bash available:', bool(python_bash))
        print('TypeScript bash available:', bool(ts_bash))
        
        # Create a Python wrapper for TypeScript tool
        print('\nCreating Python wrapper for TypeScript read tool...')
        from shared.tools import create_python_tool_wrapper
        
        read_tool = create_python_tool_wrapper('read')
        
        # Use the wrapped tool
        if Path('/mnt/c/Users/jehma/Desktop/AI/DGMSTT/README.md').exists():
            content = read_tool(file_path='/mnt/c/Users/jehma/Desktop/AI/DGMSTT/README.md')
            print(f'Read {len(content)} characters from README.md')
        
    except Exception as error:
        print(f'Example failed: {error}')
        import traceback
        traceback.print_exc()


# Run the example
if __name__ == '__main__':
    asyncio.run(example())
    print('\nExample completed!')