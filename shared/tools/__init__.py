"""
Shared tools module - Cross-language tool integration
"""

# Import adapters
from .python_adapter import (
    PythonTypeScriptAdapter,
    register_typescript_tool,
    call_typescript_tool,
    load_typescript_module,
    create_python_tool_wrapper,
    TypeScriptToolInfo,
    TypeScriptToolRegistration
)

# Import registry
from .registry import (
    UnifiedToolRegistry,
    tool_registry,
    register_tool,
    get_tool,
    list_tools,
    search_tools
)

# Import type converter
from .type_converter import TypeConverter

# Import error handler
from .error_handler import (
    ErrorHandlingMiddleware,
    error_handler,
    ErrorContext,
    ErrorHandler,
    RetryStrategy
)

# Re-export types
from ..types.python.tool import *

__all__ = [
    # Adapters
    'PythonTypeScriptAdapter',
    'register_typescript_tool',
    'call_typescript_tool',
    'load_typescript_module',
    'create_python_tool_wrapper',
    'TypeScriptToolInfo',
    'TypeScriptToolRegistration',
    
    # Registry
    'UnifiedToolRegistry',
    'tool_registry',
    'register_tool',
    'get_tool',
    'list_tools',
    'search_tools',
    
    # Type converter
    'TypeConverter',
    
    # Error handler
    'ErrorHandlingMiddleware',
    'error_handler',
    'ErrorContext',
    'ErrorHandler',
    'RetryStrategy'
]