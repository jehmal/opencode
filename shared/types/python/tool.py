"""Tool-related Type Definitions"""

from typing import Dict, List, Optional, Any, Callable, Awaitable, Union
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum
import asyncio

from .base import JSONSchema, Language, Metadata, Result

# Tool categories
class ToolCategory(str, Enum):
    FILE_SYSTEM = "file-system"
    NETWORK = "network"
    DATABASE = "database"
    COMPUTATION = "computation"
    TEXT_PROCESSING = "text-processing"
    CODE_GENERATION = "code-generation"
    TESTING = "testing"
    DEPLOYMENT = "deployment"
    MONITORING = "monitoring"
    SECURITY = "security"
    AI_ML = "ai-ml"
    DATA_PROCESSING = "data-processing"
    COMMUNICATION = "communication"
    UTILITY = "utility"

# Rate limit strategy
class RateLimitStrategy(str, Enum):
    FIXED_WINDOW = "fixed-window"
    SLIDING_WINDOW = "sliding-window"
    TOKEN_BUCKET = "token-bucket"

# Rate limiting
class RateLimit(BaseModel):
    """Rate limiting configuration"""
    requests: int
    window: int
    strategy: RateLimitStrategy

# Authentication type
class AuthType(str, Enum):
    NONE = "none"
    API_KEY = "api-key"
    OAUTH2 = "oauth2"
    BASIC = "basic"
    JWT = "jwt"

# Authentication configuration
class AuthConfiguration(BaseModel):
    """Authentication configuration"""
    type: AuthType
    credentials: Optional[Any] = None
    scope: Optional[List[str]] = None

# Tool dependency type
class ToolDependencyType(str, Enum):
    TOOL = "tool"
    LIBRARY = "library"
    SERVICE = "service"
    RESOURCE = "resource"

# Tool dependency
class ToolDependency(BaseModel):
    """Tool dependency specification"""
    name: str
    version: Optional[str] = None
    type: ToolDependencyType
    optional: Optional[bool] = None

# Tool example
class ToolExample(BaseModel):
    """Tool usage example"""
    name: str
    description: Optional[str] = None
    input: Any
    output: Any
    explanation: Optional[str] = None

# Tool configuration
class ToolConfiguration(BaseModel):
    """Tool configuration settings"""
    timeout: Optional[int] = None
    retryable: Optional[bool] = None
    cacheable: Optional[bool] = None
    rate_limit: Optional[RateLimit] = Field(None, alias="rateLimit")
    authentication: Optional[AuthConfiguration] = None
    environment: Optional[Dict[str, str]] = None
    dependencies: Optional[List[ToolDependency]] = None

# Tool definition
class Tool(BaseModel):
    """Tool definition"""
    id: str
    name: str
    description: str
    version: str
    category: ToolCategory
    language: Language
    input_schema: JSONSchema = Field(alias="inputSchema")
    output_schema: Optional[JSONSchema] = Field(None, alias="outputSchema")
    configuration: Optional[ToolConfiguration] = None
    examples: Optional[List[ToolExample]] = None
    metadata: Optional[Metadata] = None

# Tool logger interface
class ToolLogger:
    """Tool logger interface"""
    def debug(self, message: str, data: Optional[Any] = None) -> None:
        pass
    
    def info(self, message: str, data: Optional[Any] = None) -> None:
        pass
    
    def warn(self, message: str, data: Optional[Any] = None) -> None:
        pass
    
    def error(self, message: str, error: Optional[Any] = None) -> None:
        pass
    
    def metric(self, name: str, value: float, tags: Optional[Dict[str, str]] = None) -> None:
        pass

# Tool execution context
class ToolContext(BaseModel):
    """Tool execution context"""
    session_id: str = Field(alias="sessionId")
    message_id: str = Field(alias="messageId")
    user_id: Optional[str] = Field(None, alias="userId")
    agent_id: Optional[str] = Field(None, alias="agentId")
    environment: Dict[str, str]
    abort_signal: asyncio.Event = Field(default_factory=asyncio.Event, alias="abortSignal")
    timeout: int
    metadata: Dict[str, Any]
    logger: ToolLogger

    class Config:
        arbitrary_types_allowed = True

# Tool execution options
class ToolExecutionOptions(BaseModel):
    """Tool execution options"""
    async_execution: Optional[bool] = Field(None, alias="async")
    stream: Optional[bool] = None
    cache: Optional[bool] = None
    priority: Optional[int] = None
    timeout: Optional[int] = None

# Tool execution request
class ToolExecutionRequest(BaseModel):
    """Tool execution request"""
    tool_id: str = Field(alias="toolId")
    input: Any
    context: Optional[Dict[str, Any]] = None
    options: Optional[ToolExecutionOptions] = None

# Tool error
class ToolError(BaseModel):
    """Tool execution error"""
    code: str
    message: str
    details: Optional[Any] = None
    retryable: bool
    cause: Optional[str] = None

# Memory usage
class MemoryUsage(BaseModel):
    """Memory usage metrics"""
    used: int
    peak: int

# CPU usage
class CpuUsage(BaseModel):
    """CPU usage metrics"""
    user: float
    system: float

# IO usage
class IoUsage(BaseModel):
    """IO usage metrics"""
    bytes_read: int = Field(alias="bytesRead")
    bytes_written: int = Field(alias="bytesWritten")

# Tool performance metrics
class ToolPerformance(BaseModel):
    """Tool performance metrics"""
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")
    duration: int
    memory: Optional[MemoryUsage] = None
    cpu: Optional[CpuUsage] = None
    io: Optional[IoUsage] = None

# Tool artifact
class ToolArtifact(BaseModel):
    """Tool execution artifact"""
    name: str
    type: str
    size: Optional[int] = None
    content: Optional[Any] = None
    encoding: Optional[str] = None
    checksum: Optional[str] = None

# Tool log level
class ToolLogLevel(str, Enum):
    TRACE = "trace"
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"

# Tool log
class ToolLog(BaseModel):
    """Tool execution log entry"""
    timestamp: str
    level: ToolLogLevel
    message: str
    data: Optional[Any] = None

# Tool execution status
class ToolExecutionStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"

# Tool execution result
class ToolExecutionResult(BaseModel):
    """Tool execution result"""
    tool_id: str = Field(alias="toolId")
    execution_id: str = Field(alias="executionId")
    status: ToolExecutionStatus
    output: Optional[Any] = None
    error: Optional[ToolError] = None
    performance: ToolPerformance
    artifacts: Optional[List[ToolArtifact]] = None
    logs: Optional[List[ToolLog]] = None

# Tool filter
class ToolFilter(BaseModel):
    """Tool search filter"""
    category: Optional[ToolCategory] = None
    language: Optional[Language] = None
    tags: Optional[List[str]] = None
    capabilities: Optional[List[str]] = None

# Tool handler type
ToolHandler = Callable[[Any, ToolContext], Awaitable[Result[Any]]]

# Tool registry interface
class ToolRegistry:
    """Tool registry interface"""
    async def register(self, tool: Tool) -> None:
        """Register a tool"""
        pass
    
    async def unregister(self, tool_id: str) -> None:
        """Unregister a tool"""
        pass
    
    async def get(self, tool_id: str) -> Optional[Tool]:
        """Get a tool by ID"""
        pass
    
    async def list(self, filter: Optional[ToolFilter] = None) -> List[Tool]:
        """List tools with optional filter"""
        pass
    
    async def search(self, query: str) -> List[Tool]:
        """Search tools by query"""
        pass

# Type guards
def is_tool_error(value: Any) -> bool:
    """Check if value is a tool error"""
    return (
        isinstance(value, dict) and
        "code" in value and
        "message" in value and
        "retryable" in value and
        isinstance(value.get("retryable"), bool)
    )

def is_tool_execution_result(value: Any) -> bool:
    """Check if value is a tool execution result"""
    return (
        isinstance(value, dict) and
        "toolId" in value and
        "executionId" in value and
        value.get("status") in ["success", "error", "timeout", "cancelled"]
    )