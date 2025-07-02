"""
Unified Tool Registry for cross-language tool management
"""

import asyncio
from typing import Dict, List, Optional, Any, Callable
from pathlib import Path
import importlib.util
import sys

from ..types.python.tool import (
    Tool,
    ToolCategory,
    ToolFilter,
    ToolHandler,
    Language
)
from .python_adapter import PythonTypeScriptAdapter, TypeScriptToolInfo, TypeScriptToolRegistration


class ToolRegistration:
    """Tool registration information"""
    def __init__(self, tool: Tool, handler: ToolHandler, source: str = 'local', module: Optional[str] = None):
        self.tool = tool
        self.handler = handler
        self.source = source
        self.module = module


class UnifiedToolRegistry:
    """Unified registry for tools across languages"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized') or not self._initialized:
            self.tools: Dict[str, Dict[Language, ToolRegistration]] = {}
            self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize the registry"""
        if self._initialized:
            return
        
        # Initialize adapters
        await PythonTypeScriptAdapter.initialize()
        
        # Load built-in tools
        await self._load_built_in_tools()
        
        self._initialized = True
    
    async def register(self, tool: Tool, handler: ToolHandler, module: Optional[str] = None) -> None:
        """Register a tool"""
        language_map = self.tools.get(tool.id, {})
        
        language_map[tool.language] = ToolRegistration(
            tool=tool,
            handler=handler,
            source='remote' if module else 'local',
            module=module
        )
        
        self.tools[tool.id] = language_map
        
        # If it's a TypeScript tool, make it available to Python
        if tool.language == Language.TYPESCRIPT and module:
            await PythonTypeScriptAdapter.register_typescript_tool(
                TypeScriptToolRegistration(
                    module=module,
                    tool_id=tool.id,
                    info=TypeScriptToolInfo(
                        id=tool.id,
                        description=tool.description,
                        parameters=tool.input_schema
                    )
                )
            )
    
    async def unregister(self, tool_id: str, language: Optional[Language] = None) -> None:
        """Unregister a tool"""
        if language:
            language_map = self.tools.get(tool_id)
            if language_map and language in language_map:
                del language_map[language]
                if not language_map:
                    del self.tools[tool_id]
        else:
            if tool_id in self.tools:
                del self.tools[tool_id]
    
    async def get(self, tool_id: str, language: Optional[Language] = None) -> Optional[Tool]:
        """Get a tool by ID and optionally language"""
        language_map = self.tools.get(tool_id)
        if not language_map:
            return None
        
        if language:
            registration = language_map.get(language)
            return registration.tool if registration else None
        
        # Return the first available tool
        first_registration = next(iter(language_map.values()), None)
        return first_registration.tool if first_registration else None
    
    def get_handler(self, tool_id: str, language: Language) -> Optional[ToolHandler]:
        """Get tool handler"""
        language_map = self.tools.get(tool_id)
        if not language_map:
            return None
        
        registration = language_map.get(language)
        return registration.handler if registration else None
    
    async def list(self, filter: Optional[ToolFilter] = None) -> List[Tool]:
        """List tools with optional filter"""
        tools = []
        
        for language_map in self.tools.values():
            for registration in language_map.values():
                tool = registration.tool
                
                # Apply filters
                if filter:
                    if filter.category and tool.category != filter.category:
                        continue
                    if filter.language and tool.language != filter.language:
                        continue
                    if filter.tags and filter.tags:
                        tool_tags = tool.metadata.get('tags', []) if tool.metadata else []
                        if not any(tag in tool_tags for tag in filter.tags):
                            continue
                
                tools.append(tool)
        
        return tools
    
    async def search(self, query: str) -> List[Tool]:
        """Search tools by query"""
        lower_query = query.lower()
        tools = []
        
        for language_map in self.tools.values():
            for registration in language_map.values():
                tool = registration.tool
                
                # Search in name, description, and category
                if (lower_query in tool.name.lower() or
                    lower_query in tool.description.lower() or
                    lower_query in tool.category.value.lower()):
                    tools.append(tool)
        
        return tools
    
    async def _load_built_in_tools(self) -> None:
        """Load built-in tools"""
        # Load Python tools from DGM
        await self._load_dgm_tools()
        
        # Load TypeScript tools from OpenCode
        await self._load_opencode_tools()
    
    async def _load_dgm_tools(self) -> None:
        """Load DGM tools"""
        try:
            tool_modules = [
                Path(__file__).parent.parent.parent / 'dgm' / 'tools' / 'bash.py',
                Path(__file__).parent.parent.parent / 'dgm' / 'tools' / 'edit.py'
            ]
            
            for module_path in tool_modules:
                if module_path.exists():
                    try:
                        await self._load_python_tool(str(module_path))
                    except Exception as e:
                        print(f"Failed to load DGM tool from {module_path}: {e}")
        except Exception as e:
            print(f"Failed to load DGM tools: {e}")
    
    async def _load_python_tool(self, module_path: str) -> None:
        """Load a Python tool module"""
        spec = importlib.util.spec_from_file_location("tool_module", module_path)
        if not spec or not spec.loader:
            return
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Check for tool_info function
        if hasattr(module, 'tool_info'):
            info = module.tool_info()
            
            # Create tool instance
            tool = Tool(
                id=info['name'],
                name=info['name'],
                description=info['description'],
                version='1.0.0',
                category=self._infer_category(info['name']),
                language=Language.PYTHON,
                input_schema=info['input_schema'],
                metadata={'source': 'dgm'}
            )
            
            # Create handler
            if hasattr(module, 'tool_function_async'):
                handler = module.tool_function_async
            elif hasattr(module, 'tool_function'):
                # Wrap sync function
                sync_func = module.tool_function
                async def handler(params, context):
                    return await asyncio.get_event_loop().run_in_executor(
                        None, sync_func, **params
                    )
            else:
                return
            
            await self.register(tool, handler, module_path)
    
    async def _load_opencode_tools(self) -> None:
        """Load TypeScript tools from OpenCode"""
        try:
            tool_modules = [
                '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/bash.ts',
                '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/edit.ts',
                '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/read.ts',
                '/mnt/c/Users/jehma/Desktop/AI/DGMSTT/opencode/packages/opencode/src/tool/write.ts'
            ]
            
            for module_path in tool_modules:
                try:
                    await PythonTypeScriptAdapter.load_typescript_module(module_path)
                except Exception as e:
                    print(f"Failed to load OpenCode tool from {module_path}: {e}")
        except Exception as e:
            print(f"Failed to load OpenCode tools: {e}")
    
    def _infer_category(self, tool_id: str) -> ToolCategory:
        """Infer tool category from ID"""
        category_map = {
            'bash': ToolCategory.UTILITY,
            'edit': ToolCategory.FILE_SYSTEM,
            'read': ToolCategory.FILE_SYSTEM,
            'write': ToolCategory.FILE_SYSTEM,
            'ls': ToolCategory.FILE_SYSTEM,
            'grep': ToolCategory.TEXT_PROCESSING,
            'glob': ToolCategory.FILE_SYSTEM,
            'patch': ToolCategory.FILE_SYSTEM,
            'multiedit': ToolCategory.FILE_SYSTEM
        }
        
        return category_map.get(tool_id, ToolCategory.UTILITY)
    
    def get_available_languages(self, tool_id: str) -> List[Language]:
        """Get available languages for a tool"""
        language_map = self.tools.get(tool_id)
        if not language_map:
            return []
        
        return list(language_map.keys())
    
    def supports_language(self, tool_id: str, language: Language) -> bool:
        """Check if a tool supports a specific language"""
        language_map = self.tools.get(tool_id)
        if not language_map:
            return False
        
        return language in language_map


# Create singleton instance
tool_registry = UnifiedToolRegistry()


# Convenience functions
async def register_tool(tool: Tool, handler: ToolHandler, module: Optional[str] = None) -> None:
    """Register a tool in the unified registry"""
    await tool_registry.register(tool, handler, module)


async def get_tool(tool_id: str, language: Optional[Language] = None) -> Optional[Tool]:
    """Get a tool from the registry"""
    return await tool_registry.get(tool_id, language)


async def list_tools(filter: Optional[ToolFilter] = None) -> List[Tool]:
    """List all available tools"""
    return await tool_registry.list(filter)


async def search_tools(query: str) -> List[Tool]:
    """Search for tools"""
    return await tool_registry.search(query)