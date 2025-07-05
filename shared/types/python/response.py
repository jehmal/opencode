"""Response-related Type Definitions"""

from typing import Dict, List, Optional, Any, AsyncIterable, TypeVar, Generic
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum
import uuid

from .base import Status, ErrorInfo, Metadata

# Response types
class ResponseType(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"
    STREAM = "stream"
    REDIRECT = "redirect"
    ACKNOWLEDGMENT = "acknowledgment"

# Response metadata
class ResponseMetadata(Metadata):
    """Response-specific metadata"""
    duration: Optional[int] = None
    retries: Optional[int] = None
    cached: Optional[bool] = None
    truncated: Optional[bool] = None

# Base response
T = TypeVar("T")

class Response(BaseModel, Generic[T]):
    """Base response structure"""
    id: str
    type: ResponseType
    status: Status
    data: Optional[T] = None
    error: Optional[ErrorInfo] = None
    metadata: ResponseMetadata
    timestamp: str

# Stream chunk
class StreamChunk(BaseModel, Generic[T]):
    """Streaming response chunk"""
    sequence_number: int = Field(alias="sequenceNumber")
    data: T
    is_final: bool = Field(alias="isFinal")
    timestamp: str

# Streaming response
class StreamingResponse(BaseModel, Generic[T]):
    """Streaming response container"""
    id: str
    chunks: AsyncIterable[StreamChunk[T]]
    metadata: ResponseMetadata

    class Config:
        arbitrary_types_allowed = True

# Batch summary
class BatchSummary(BaseModel):
    """Batch operation summary"""
    total: int
    successful: int
    failed: int
    partial: int
    average_duration: float = Field(alias="averageDuration")

# Batch response
class BatchResponse(BaseModel, Generic[T]):
    """Batch operation response"""
    id: str
    responses: List[Response[T]]
    summary: BatchSummary
    metadata: ResponseMetadata

# Pagination info
class PaginationInfo(BaseModel):
    """Pagination information"""
    page: int
    page_size: int = Field(alias="pageSize")
    total_items: int = Field(alias="totalItems")
    total_pages: int = Field(alias="totalPages")
    has_next: bool = Field(alias="hasNext")
    has_prev: bool = Field(alias="hasPrev")

# Paginated response
class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response container"""
    id: str
    items: List[T]
    pagination: PaginationInfo
    metadata: ResponseMetadata

# Sub-task progress
class SubTaskProgress(BaseModel):
    """Sub-task progress information"""
    name: str
    status: Status
    progress: float

# Progress info
class ProgressInfo(BaseModel):
    """Progress tracking information"""
    current: int
    total: int
    percentage: float
    message: Optional[str] = None
    estimated_time_remaining: Optional[int] = Field(None, alias="estimatedTimeRemaining")
    sub_tasks: Optional[List[SubTaskProgress]] = Field(None, alias="subTasks")

# Progress response
class ProgressResponse(BaseModel):
    """Progress update response"""
    id: str
    task_id: str = Field(alias="taskId")
    progress: ProgressInfo
    metadata: ResponseMetadata

# File response
class FileResponse(BaseModel):
    """File transfer response"""
    id: str
    filename: str
    mime_type: str = Field(alias="mimeType")
    size: int
    content: Optional[Union[bytes, str]] = None
    url: Optional[str] = None
    checksum: Optional[str] = None
    metadata: ResponseMetadata

# Error types
class ErrorType(str, Enum):
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    INTERNAL = "internal"
    EXTERNAL_SERVICE = "external_service"
    NETWORK = "network"

# Detailed error
class DetailedError(ErrorInfo):
    """Detailed error information"""
    type: ErrorType
    context: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[str]] = None
    documentation: Optional[str] = None

# Error response
class ErrorResponse(BaseModel):
    """Error response structure"""
    id: str
    error: DetailedError
    metadata: ResponseMetadata

# Response builder
class ResponseBuilder(Generic[T]):
    """Fluent response builder"""
    
    def __init__(self):
        self._response: Dict[str, Any] = {
            "id": self._generate_id(),
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "id": self._generate_id(),
                "version": "1.0.0",
                "timestamp": datetime.now().isoformat(),
                "source": "system"
            }
        }
    
    def type(self, response_type: ResponseType) -> "ResponseBuilder[T]":
        """Set response type"""
        self._response["type"] = response_type
        return self
    
    def status(self, status: Status) -> "ResponseBuilder[T]":
        """Set response status"""
        self._response["status"] = status
        return self
    
    def data(self, data: T) -> "ResponseBuilder[T]":
        """Set response data"""
        self._response["data"] = data
        return self
    
    def error(self, error: ErrorInfo) -> "ResponseBuilder[T]":
        """Set response error"""
        self._response["error"] = error
        return self
    
    def metadata(self, **kwargs) -> "ResponseBuilder[T]":
        """Update response metadata"""
        self._response["metadata"].update(kwargs)
        return self
    
    def build(self) -> Response[T]:
        """Build the response"""
        if "type" not in self._response:
            self._response["type"] = ResponseType.ERROR if "error" in self._response else ResponseType.SUCCESS
        
        if "status" not in self._response:
            self._response["status"] = Status.FAILED if "error" in self._response else Status.COMPLETED
        
        return Response[T](**self._response)
    
    @staticmethod
    def _generate_id() -> str:
        """Generate unique ID"""
        return f"{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:9]}"

# Utility functions
def is_error_response(response: Response) -> bool:
    """Check if response is an error"""
    return response.type == ResponseType.ERROR and response.error is not None

def is_streaming_response(value: Any) -> bool:
    """Check if value is a streaming response"""
    return (
        isinstance(value, dict) and
        "id" in value and
        "chunks" in value and
        hasattr(value.get("chunks"), "__aiter__")
    )

def is_paginated_response(value: Any) -> bool:
    """Check if value is a paginated response"""
    return (
        isinstance(value, dict) and
        "items" in value and
        isinstance(value.get("items"), list) and
        "pagination" in value and
        isinstance(value.get("pagination", {}).get("page"), int)
    )