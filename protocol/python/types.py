from typing import Dict, Any, Optional, Callable, Awaitable, Literal, Union, List
from dataclasses import dataclass
from enum import IntEnum
import asyncio

PROTOCOL_VERSION = '1.0.0'

Language = Literal['typescript', 'python']

# JSON Schema types
JSONSchema = Dict[str, Any]

@dataclass
class ToolContext:
    """Context for tool execution"""
    session_id: str
    message_id: str
    abort: asyncio.Event
    timeout: float
    metadata: Dict[str, Any]

@dataclass
class ToolResult:
    """Result from tool execution"""
    output: str
    metadata: Dict[str, Any]
    diagnostics: Optional[List[Any]] = None

# Tool handler type
ToolHandler = Callable[[Any, ToolContext], Awaitable[ToolResult]]

@dataclass
class ToolRegistration:
    """Tool registration information"""
    id: str
    description: str
    language: Language
    schema: JSONSchema
    handler: ToolHandler

# JSON-RPC types
@dataclass
class JsonRpcRequest:
    """JSON-RPC 2.0 request"""
    jsonrpc: str = '2.0'
    id: Union[str, int] = ''
    method: str = ''
    params: Optional[Any] = None
    protocol: Optional[str] = None

@dataclass
class JsonRpcError:
    """JSON-RPC 2.0 error"""
    code: int
    message: str
    data: Optional[Any] = None

@dataclass
class JsonRpcResponse:
    """JSON-RPC 2.0 response"""
    jsonrpc: str = '2.0'
    id: Union[str, int] = ''
    result: Optional[Any] = None
    error: Optional[JsonRpcError] = None
    protocol: Optional[str] = None

# Error codes
class ErrorCode(IntEnum):
    ParseError = -32700
    InvalidRequest = -32600
    ToolNotFound = -32601
    InvalidParams = -32602
    InternalError = -32603
    ExecutionError = -32000
    TimeoutError = -32001
    PermissionDenied = -32002

# Tool info type for compatibility
@dataclass
class ToolInfo:
    """Tool information for DGM compatibility"""
    name: str
    description: str
    input_schema: Dict[str, Any]