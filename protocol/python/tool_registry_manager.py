"""
Tool Registry Manager for Cross-Language Tool Execution
Manages tool registration, discovery, and metadata for both Python and TypeScript tools
"""

import asyncio
import json
from typing import Dict, List, Optional, Any, Set, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
import logging

from .types import (
    ToolMetadata,
    ToolCapability,
    ToolExecutionRequest,
    ToolExecutionResult,
    Language,
    PROTOCOL_VERSION
)
from .registry import ToolRegistry
from .bridge import ExecutionBridge

logger = logging.getLogger(__name__)

@dataclass
class RegisteredTool:
    """Represents a registered tool with full metadata"""
    id: str
    name: str
    description: str
    language: Language
    category: str
    version: str
    input_schema: Dict[str, Any]
    output_schema: Optional[Dict[str, Any]]
    capabilities: List[ToolCapability]
    dependencies: List[str]
    examples: List[Dict[str, Any]]
    handler: Optional[Callable] = None
    remote: bool = False
    registered_at: datetime = None
    last_used: Optional[datetime] = None
    execution_count: int = 0
    average_execution_time: float = 0.0
    
    def __post_init__(self):
        if self.registered_at is None:
            self.registered_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        data['registered_at'] = self.registered_at.isoformat()
        if self.last_used:
            data['last_used'] = self.last_used.isoformat()
        data.pop('handler', None)  # Don't serialize handler
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RegisteredTool':
        """Create from dictionary"""
        data = data.copy()
        data['registered_at'] = datetime.fromisoformat(data['registered_at'])
        if data.get('last_used'):
            data['last_used'] = datetime.fromisoformat(data['last_used'])
        return cls(**data)

class ToolRegistryManager:
    """
    Central registry manager for cross-language tool execution
    Manages tool registration, discovery, and metadata synchronization
    """
    
    def __init__(self, language: Language = Language.PYTHON):
        self.language = language
        self.tools: Dict[str, RegisteredTool] = {}
        self.remote_tools: Dict[str, RegisteredTool] = {}
        self.capabilities: Dict[str, Set[str]] = {}  # capability -> tool_ids
        self.categories: Dict[str, Set[str]] = {}    # category -> tool_ids
        self.bridge: Optional[ExecutionBridge] = None
        self._sync_lock = asyncio.Lock()
        self._initialized = False
        
    async def initialize(self, bridge: Optional[ExecutionBridge] = None) -> None:
        """Initialize the registry manager"""
        if self._initialized:
            return
            
        self.bridge = bridge or ExecutionBridge()
        
        # Load local tools
        await self._load_local_tools()
        
        # Sync with remote registry if bridge is available
        if self.bridge:
            await self._sync_remote_tools()
            
        self._initialized = True
        logger.info(f"ToolRegistryManager initialized with {len(self.tools)} local tools and {len(self.remote_tools)} remote tools")
        
    async def _load_local_tools(self) -> None:
        """Load tools from the local registry"""
        # Import local tool modules dynamically
        if self.language == Language.PYTHON:
            await self._load_python_tools()
        else:
            await self._load_typescript_tools()
            
    async def _load_python_tools(self) -> None:
        """Load Python tools from dgm/tools directory"""
        tools_dir = Path(__file__).parent.parent.parent / "dgm" / "tools"
        if not tools_dir.exists():
            logger.warning(f"Tools directory not found: {tools_dir}")
            return
            
        for tool_file in tools_dir.glob("*.py"):
            if tool_file.name == "__init__.py":
                continue
                
            try:
                # Dynamically import tool module
                module_name = tool_file.stem
                module = __import__(f"dgm.tools.{module_name}", fromlist=["tool_info", "tool_function"])
                
                if hasattr(module, "tool_info"):
                    tool_info = module.tool_info()
                    tool_id = tool_info.get("name", module_name)
                    
                    # Create RegisteredTool
                    tool = RegisteredTool(
                        id=tool_id,
                        name=tool_info.get("name", tool_id),
                        description=tool_info.get("description", ""),
                        language=Language.PYTHON,
                        category=tool_info.get("category", "utility"),
                        version=tool_info.get("version", "1.0.0"),
                        input_schema=tool_info.get("input_schema", {}),
                        output_schema=tool_info.get("output_schema"),
                        capabilities=tool_info.get("capabilities", []),
                        dependencies=tool_info.get("dependencies", []),
                        examples=tool_info.get("examples", []),
                        handler=getattr(module, "tool_function", None),
                        remote=False
                    )
                    
                    await self.register_tool(tool)
                    
            except Exception as e:
                logger.error(f"Failed to load tool from {tool_file}: {e}")
                
    async def _load_typescript_tools(self) -> None:
        """Load TypeScript tools via bridge"""
        # TypeScript tools are loaded via the bridge
        pass
        
    async def register_tool(self, tool: RegisteredTool) -> None:
        """Register a tool in the registry"""
        async with self._sync_lock:
            self.tools[tool.id] = tool
            
            # Update capability index
            for capability in tool.capabilities:
                if capability not in self.capabilities:
                    self.capabilities[capability] = set()
                self.capabilities[capability].add(tool.id)
                
            # Update category index
            if tool.category not in self.categories:
                self.categories[tool.category] = set()
            self.categories[tool.category].add(tool.id)
            
            logger.info(f"Registered tool: {tool.id} ({tool.language})")
            
    async def unregister_tool(self, tool_id: str) -> None:
        """Unregister a tool from the registry"""
        async with self._sync_lock:
            if tool_id in self.tools:
                tool = self.tools[tool_id]
                
                # Remove from capability index
                for capability in tool.capabilities:
                    if capability in self.capabilities:
                        self.capabilities[capability].discard(tool_id)
                        
                # Remove from category index
                if tool.category in self.categories:
                    self.categories[tool.category].discard(tool_id)
                    
                del self.tools[tool_id]
                logger.info(f"Unregistered tool: {tool_id}")
                
    async def get_tool(self, tool_id: str) -> Optional[RegisteredTool]:
        """Get a tool by ID"""
        # Check local tools first
        if tool_id in self.tools:
            return self.tools[tool_id]
            
        # Check remote tools
        if tool_id in self.remote_tools:
            return self.remote_tools[tool_id]
            
        return None
        
    async def list_tools(
        self,
        category: Optional[str] = None,
        language: Optional[Language] = None,
        capabilities: Optional[List[str]] = None
    ) -> List[RegisteredTool]:
        """List tools with optional filters"""
        tools = list(self.tools.values()) + list(self.remote_tools.values())
        
        # Filter by category
        if category:
            tools = [t for t in tools if t.category == category]
            
        # Filter by language
        if language:
            tools = [t for t in tools if t.language == language]
            
        # Filter by capabilities
        if capabilities:
            required_caps = set(capabilities)
            tools = [t for t in tools if required_caps.issubset(set(t.capabilities))]
            
        return tools
        
    async def search_tools(self, query: str) -> List[RegisteredTool]:
        """Search tools by name or description"""
        query_lower = query.lower()
        results = []
        
        for tool in list(self.tools.values()) + list(self.remote_tools.values()):
            if (query_lower in tool.name.lower() or 
                query_lower in tool.description.lower() or
                any(query_lower in cap.lower() for cap in tool.capabilities)):
                results.append(tool)
                
        return results
        
    async def get_tools_by_capability(self, capability: str) -> List[RegisteredTool]:
        """Get all tools with a specific capability"""
        tool_ids = self.capabilities.get(capability, set())
        tools = []
        
        for tool_id in tool_ids:
            tool = await self.get_tool(tool_id)
            if tool:
                tools.append(tool)
                
        return tools
        
    async def _sync_remote_tools(self) -> None:
        """Synchronize with remote tool registry"""
        if not self.bridge:
            return
            
        try:
            # Request tool list from remote registry
            request = {
                "jsonrpc": "2.0",
                "method": "registry.list_tools",
                "params": {
                    "language": self.language.value
                },
                "id": "sync-" + str(datetime.now().timestamp())
            }
            
            response = await self.bridge.send_request(request)
            
            if "result" in response:
                remote_tools = response["result"]["tools"]
                
                # Update remote tools registry
                self.remote_tools.clear()
                for tool_data in remote_tools:
                    tool = RegisteredTool.from_dict(tool_data)
                    tool.remote = True
                    self.remote_tools[tool.id] = tool
                    
                    # Update indices
                    for capability in tool.capabilities:
                        if capability not in self.capabilities:
                            self.capabilities[capability] = set()
                        self.capabilities[capability].add(tool.id)
                        
                    if tool.category not in self.categories:
                        self.categories[tool.category] = set()
                    self.categories[tool.category].add(tool.id)
                    
                logger.info(f"Synchronized {len(self.remote_tools)} remote tools")
                
        except Exception as e:
            logger.error(f"Failed to sync remote tools: {e}")
            
    async def execute_tool(
        self,
        tool_id: str,
        parameters: Any,
        context: Optional[Dict[str, Any]] = None
    ) -> ToolExecutionResult:
        """Execute a tool by ID"""
        tool = await self.get_tool(tool_id)
        if not tool:
            raise ValueError(f"Tool not found: {tool_id}")
            
        # Update usage statistics
        tool.last_used = datetime.now()
        tool.execution_count += 1
        start_time = asyncio.get_event_loop().time()
        
        try:
            if tool.remote:
                # Execute via bridge
                result = await self.bridge.execute(
                    tool_id,
                    tool.language,
                    parameters,
                    context
                )
            else:
                # Execute locally
                if not tool.handler:
                    raise ValueError(f"Tool {tool_id} has no handler")
                    
                result = await tool.handler(parameters, context)
                
            # Update execution time statistics
            execution_time = asyncio.get_event_loop().time() - start_time
            tool.average_execution_time = (
                (tool.average_execution_time * (tool.execution_count - 1) + execution_time) /
                tool.execution_count
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Tool execution failed for {tool_id}: {e}")
            raise
            
    async def get_tool_statistics(self, tool_id: str) -> Dict[str, Any]:
        """Get execution statistics for a tool"""
        tool = await self.get_tool(tool_id)
        if not tool:
            return {}
            
        return {
            "id": tool.id,
            "execution_count": tool.execution_count,
            "average_execution_time": tool.average_execution_time,
            "last_used": tool.last_used.isoformat() if tool.last_used else None,
            "registered_at": tool.registered_at.isoformat()
        }
        
    async def export_registry(self, file_path: str) -> None:
        """Export registry to a JSON file"""
        registry_data = {
            "version": PROTOCOL_VERSION,
            "language": self.language.value,
            "tools": [tool.to_dict() for tool in self.tools.values()],
            "remote_tools": [tool.to_dict() for tool in self.remote_tools.values()],
            "exported_at": datetime.now().isoformat()
        }
        
        with open(file_path, 'w') as f:
            json.dump(registry_data, f, indent=2)
            
        logger.info(f"Exported registry to {file_path}")
        
    async def import_registry(self, file_path: str) -> None:
        """Import registry from a JSON file"""
        with open(file_path, 'r') as f:
            registry_data = json.load(f)
            
        # Clear existing registry
        self.tools.clear()
        self.remote_tools.clear()
        self.capabilities.clear()
        self.categories.clear()
        
        # Import tools
        for tool_data in registry_data.get("tools", []):
            tool = RegisteredTool.from_dict(tool_data)
            await self.register_tool(tool)
            
        for tool_data in registry_data.get("remote_tools", []):
            tool = RegisteredTool.from_dict(tool_data)
            tool.remote = True
            self.remote_tools[tool.id] = tool
            
        logger.info(f"Imported registry from {file_path}")

# Singleton instance
_registry_manager: Optional[ToolRegistryManager] = None

def get_registry_manager() -> ToolRegistryManager:
    """Get the singleton registry manager instance"""
    global _registry_manager
    if _registry_manager is None:
        _registry_manager = ToolRegistryManager()
    return _registry_manager