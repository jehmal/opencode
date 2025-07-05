"""Base Types and Common Structures"""

from typing import Dict, List, Optional, Any, Union, Literal, TypeVar, Generic
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum

# Version information
PROTOCOL_VERSION = "1.0.0"

# Language identifiers
Language = Literal["typescript", "python", "javascript", "go", "rust", "java"]

# Priority levels
class Priority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

# Status types
class Status(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"

# Common metadata structure
class Metadata(BaseModel):
    """Common metadata structure for all messages"""
    model_config = ConfigDict(extra="allow")
    
    id: str
    version: str
    timestamp: str
    correlation_id: Optional[str] = Field(None, alias="correlationId")
    source: str
    environment: Optional[str] = None
    tags: Optional[List[str]] = None

# JSON Schema definition
class JSONSchema(BaseModel):
    """JSON Schema representation"""
    type: Optional[Union[str, List[str]]] = None
    properties: Optional[Dict[str, "JSONSchema"]] = None
    items: Optional[Union["JSONSchema", List["JSONSchema"]]] = None
    required: Optional[List[str]] = None
    enum: Optional[List[Any]] = None
    const: Optional[Any] = None
    description: Optional[str] = None
    default: Optional[Any] = None
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    min_length: Optional[int] = Field(None, alias="minLength")
    max_length: Optional[int] = Field(None, alias="maxLength")
    pattern: Optional[str] = None
    format: Optional[str] = None
    additional_properties: Optional[Union[bool, "JSONSchema"]] = Field(None, alias="additionalProperties")
    one_of: Optional[List["JSONSchema"]] = Field(None, alias="oneOf")
    any_of: Optional[List["JSONSchema"]] = Field(None, alias="anyOf")
    all_of: Optional[List["JSONSchema"]] = Field(None, alias="allOf")
    not_: Optional["JSONSchema"] = Field(None, alias="not")
    ref: Optional[str] = Field(None, alias="$ref")
    schema: Optional[str] = Field(None, alias="$schema")
    definitions: Optional[Dict[str, "JSONSchema"]] = None
    title: Optional[str] = None
    examples: Optional[List[Any]] = None

# Update forward references
JSONSchema.model_rebuild()

# Error information
class ErrorInfo(BaseModel):
    """Error information structure"""
    code: str
    message: str
    details: Optional[Any] = None
    stack: Optional[str] = None
    recoverable: bool
    retry_after: Optional[int] = Field(None, alias="retryAfter")

# Result wrapper
T = TypeVar("T")

class Result(BaseModel, Generic[T]):
    """Generic result wrapper"""
    success: bool
    data: Optional[T] = None
    error: Optional[ErrorInfo] = None
    metadata: Optional[Metadata] = None

# Pagination support
class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(gt=0)
    page_size: int = Field(gt=0, alias="pageSize")
    sort: Optional[str] = None
    order: Optional[Literal["asc", "desc"]] = None

class PaginatedResult(BaseModel, Generic[T]):
    """Paginated result wrapper"""
    items: List[T]
    total: int
    page: int
    page_size: int = Field(alias="pageSize")
    has_next: bool = Field(alias="hasNext")
    has_prev: bool = Field(alias="hasPrev")

# Type guards
def is_error(value: Any) -> bool:
    """Check if value is an error"""
    return (
        isinstance(value, dict) and
        "code" in value and
        "message" in value and
        isinstance(value.get("code"), str) and
        isinstance(value.get("message"), str)
    )

def is_success(result: Result[T]) -> bool:
    """Check if result is successful"""
    return result.success is True and result.data is not None