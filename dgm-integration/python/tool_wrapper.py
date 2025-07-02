"""
Simplified tool wrapper for DGM tools
Provides a clean interface without complex dependencies
"""

import asyncio
import json
from typing import Dict, Any, Callable, Optional, Union
import logging

logger = logging.getLogger('tool_wrapper')


class SimplifiedTool:
    """Simplified tool interface"""
    
    def __init__(self, name: str, description: str, 
                 handler: Callable, schema: Dict[str, Any]):
        self.name = name
        self.description = description
        self.handler = handler
        self.schema = schema
    
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool with given parameters"""
        try:
            # Validate parameters against schema
            self._validate_params(params)
            
            # Execute handler
            if asyncio.iscoroutinefunction(self.handler):
                result = await self.handler(**params)
            else:
                # Run sync function in executor
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, self.handler, **params)
            
            return {
                'success': True,
                'output': result,
                'metadata': {
                    'tool': self.name
                }
            }
            
        except Exception as e:
            logger.error(f"Tool {self.name} execution failed: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'metadata': {
                    'tool': self.name
                }
            }
    
    def _validate_params(self, params: Dict[str, Any]):
        """Basic parameter validation"""
        properties = self.schema.get('properties', {})
        required = self.schema.get('required', [])
        
        # Check required parameters
        for req in required:
            if req not in params:
                raise ValueError(f"Missing required parameter: {req}")
        
        # Check parameter types
        for key, value in params.items():
            if key in properties:
                prop_schema = properties[key]
                expected_type = prop_schema.get('type')
                
                if expected_type and not self._check_type(value, expected_type):
                    raise TypeError(
                        f"Parameter {key} should be {expected_type}, "
                        f"got {type(value).__name__}"
                    )
    
    def _check_type(self, value: Any, expected: str) -> bool:
        """Check if value matches expected type"""
        type_map = {
            'string': str,
            'number': (int, float),
            'integer': int,
            'boolean': bool,
            'array': list,
            'object': dict
        }
        
        expected_types = type_map.get(expected)
        if expected_types:
            return isinstance(value, expected_types)
        
        return True


class ToolRegistry:
    """Simplified tool registry"""
    
    def __init__(self):
        self.tools: Dict[str, SimplifiedTool] = {}
    
    def register(self, tool: SimplifiedTool):
        """Register a tool"""
        self.tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name}")
    
    def get(self, name: str) -> Optional[SimplifiedTool]:
        """Get a tool by name"""
        return self.tools.get(name)
    
    def list_tools(self) -> Dict[str, Dict[str, Any]]:
        """List all registered tools"""
        return {
            name: {
                'description': tool.description,
                'schema': tool.schema
            }
            for name, tool in self.tools.items()
        }


def create_tool_from_dgm(tool_info: Dict[str, Any], 
                        tool_function: Callable) -> SimplifiedTool:
    """Create a simplified tool from DGM tool info"""
    return SimplifiedTool(
        name=tool_info['name'],
        description=tool_info['description'],
        handler=tool_function,
        schema=tool_info.get('input_schema', {})
    )


# Example: Wrap bash tool
def wrap_bash_tool():
    """Example of wrapping the DGM bash tool"""
    try:
        from tools.bash import tool_info, tool_function
        return create_tool_from_dgm(tool_info(), tool_function)
    except ImportError:
        logger.warning("Could not import bash tool")
        return None


# Example: Wrap edit tool  
def wrap_edit_tool():
    """Example of wrapping the DGM edit tool"""
    try:
        from tools.edit import tool_info, tool_function
        return create_tool_from_dgm(tool_info(), tool_function)
    except ImportError:
        logger.warning("Could not import edit tool")
        return None