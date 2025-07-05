"""Error-related Type Definitions"""

from typing import Dict, List, Optional, Any, Type, Callable, Awaitable, Union
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum
import traceback
import uuid

# Base error class
class BaseError(Exception):
    """Base error class with additional metadata"""
    
    def __init__(
        self,
        message: str,
        code: str,
        recoverable: bool = False,
        details: Optional[Any] = None
    ):
        super().__init__(message)
        self.code = code
        self.recoverable = recoverable
        self.details = details
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary"""
        return {
            "name": self.__class__.__name__,
            "message": str(self),
            "code": self.code,
            "recoverable": self.recoverable,
            "details": self.details,
            "timestamp": self.timestamp,
            "stack": traceback.format_exc()
        }

# Validation field error
class ValidationField(BaseModel):
    """Validation field error details"""
    field: str
    message: str
    code: Optional[str] = None
    value: Optional[Any] = None

# Specific error types
class ValidationError(BaseError):
    """Validation error with field details"""
    
    def __init__(
        self,
        message: str,
        fields: Optional[List[ValidationField]] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "VALIDATION_ERROR", True, details)
        self.fields = fields

class AuthenticationError(BaseError):
    """Authentication failure error"""
    
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, "AUTHENTICATION_ERROR", False, details)

class AuthorizationError(BaseError):
    """Authorization failure error"""
    
    def __init__(
        self,
        message: str,
        required_permissions: Optional[List[str]] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "AUTHORIZATION_ERROR", False, details)
        self.required_permissions = required_permissions

class NotFoundError(BaseError):
    """Resource not found error"""
    
    def __init__(
        self,
        message: str,
        resource: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "NOT_FOUND_ERROR", False, details)
        self.resource = resource
        self.resource_id = resource_id

class ConflictError(BaseError):
    """Resource conflict error"""
    
    def __init__(
        self,
        message: str,
        conflicting_resource: Optional[str] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "CONFLICT_ERROR", True, details)
        self.conflicting_resource = conflicting_resource

class RateLimitError(BaseError):
    """Rate limit exceeded error"""
    
    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        limit: Optional[int] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "RATE_LIMIT_ERROR", True, details)
        self.retry_after = retry_after
        self.limit = limit

class TimeoutError(BaseError):
    """Operation timeout error"""
    
    def __init__(
        self,
        message: str,
        timeout: int,
        operation: Optional[str] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "TIMEOUT_ERROR", True, details)
        self.timeout = timeout
        self.operation = operation

class NetworkError(BaseError):
    """Network-related error"""
    
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        url: Optional[str] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "NETWORK_ERROR", True, details)
        self.status_code = status_code
        self.url = url

class ExecutionError(BaseError):
    """Execution failure error"""
    
    def __init__(
        self,
        message: str,
        phase: Optional[str] = None,
        context: Optional[Any] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "EXECUTION_ERROR", False, details)
        self.phase = phase
        self.context = context

class ConfigurationError(BaseError):
    """Configuration error"""
    
    def __init__(
        self,
        message: str,
        config_key: Optional[str] = None,
        expected_type: Optional[str] = None,
        details: Optional[Any] = None
    ):
        super().__init__(message, "CONFIGURATION_ERROR", False, details)
        self.config_key = config_key
        self.expected_type = expected_type

# Error handler result
class ErrorHandlerResult(BaseModel):
    """Error handler execution result"""
    handled: bool
    retry: Optional[bool] = None
    fallback: Optional[Any] = None
    transformed: Optional[Exception] = None

    class Config:
        arbitrary_types_allowed = True

# Error handler interface
class ErrorHandler:
    """Error handler interface"""
    
    def can_handle(self, error: Exception) -> bool:
        """Check if handler can process this error"""
        raise NotImplementedError
    
    async def handle(self, error: Exception) -> ErrorHandlerResult:
        """Handle the error"""
        raise NotImplementedError

# Error context
class ErrorContext(BaseModel):
    """Error occurrence context"""
    operation: str
    input: Optional[Any] = None
    user_id: Optional[str] = Field(None, alias="userId")
    session_id: Optional[str] = Field(None, alias="sessionId")
    timestamp: str
    environment: Optional[Dict[str, str]] = None

# Recovery strategy type
class RecoveryStrategyType(str, Enum):
    RETRY = "retry"
    FALLBACK = "fallback"
    CIRCUIT_BREAKER = "circuit-breaker"
    IGNORE = "ignore"

# Retry backoff type
class RetryBackoff(str, Enum):
    LINEAR = "linear"
    EXPONENTIAL = "exponential"

# Retry configuration
class RetryConfig(BaseModel):
    """Retry strategy configuration"""
    max_attempts: int = Field(alias="maxAttempts")
    delay: int
    backoff: RetryBackoff
    jitter: Optional[bool] = None

# Fallback configuration
class FallbackConfig(BaseModel):
    """Fallback strategy configuration"""
    value: Optional[Any] = None
    handler: Optional[str] = None

# Circuit breaker configuration
class CircuitBreakerConfig(BaseModel):
    """Circuit breaker configuration"""
    threshold: int
    timeout: int
    reset_timeout: int = Field(alias="resetTimeout")

# Ignore configuration
class IgnoreConfig(BaseModel):
    """Ignore strategy configuration"""
    log: Optional[bool] = None

# Recovery configuration union
RecoveryConfig = Union[RetryConfig, FallbackConfig, CircuitBreakerConfig, IgnoreConfig]

# Error recovery strategy
class ErrorRecoveryStrategy(BaseModel):
    """Error recovery strategy definition"""
    type: RecoveryStrategyType
    config: RecoveryConfig

# Error reporter interface
class ErrorReporter:
    """Error reporting interface"""
    
    async def report(self, error: Exception, context: Optional[ErrorContext] = None) -> None:
        """Report a single error"""
        raise NotImplementedError
    
    async def report_batch(
        self,
        errors: List[Exception],
        context: Optional[ErrorContext] = None
    ) -> None:
        """Report multiple errors"""
        raise NotImplementedError

# Aggregated error
class AggregatedError(BaseModel):
    """Aggregated error information"""
    error: Dict[str, Any]  # Serialized error
    count: int
    first_occurrence: datetime = Field(alias="firstOccurrence")
    last_occurrence: datetime = Field(alias="lastOccurrence")
    contexts: List[Optional[ErrorContext]]

# Error aggregator
class ErrorAggregator:
    """Error aggregation utility"""
    
    def __init__(self):
        self._errors: Dict[str, AggregatedError] = {}
    
    def add(self, error: Exception, context: Optional[ErrorContext] = None) -> None:
        """Add error to aggregator"""
        key = self._get_error_key(error)
        
        if key in self._errors:
            agg_error = self._errors[key]
            agg_error.count += 1
            agg_error.last_occurrence = datetime.now()
            agg_error.contexts.append(context)
        else:
            error_dict = error.to_dict() if hasattr(error, "to_dict") else {
                "name": error.__class__.__name__,
                "message": str(error),
                "stack": traceback.format_exc()
            }
            
            self._errors[key] = AggregatedError(
                error=error_dict,
                count=1,
                first_occurrence=datetime.now(),
                last_occurrence=datetime.now(),
                contexts=[context] if context else []
            )
    
    def get_errors(self) -> List[AggregatedError]:
        """Get all aggregated errors"""
        return list(self._errors.values())
    
    def clear(self) -> None:
        """Clear all errors"""
        self._errors.clear()
    
    def _get_error_key(self, error: Exception) -> str:
        """Generate error key for aggregation"""
        return f"{error.__class__.__name__}-{str(error)}"

# Error utilities
def is_recoverable(error: Exception) -> bool:
    """Check if error is recoverable"""
    if isinstance(error, BaseError):
        return error.recoverable
    
    # Check for common recoverable error patterns
    recoverable_patterns = [
        "timeout",
        "rate limit",
        "temporary",
        "retry",
    ]
    
    error_str = str(error).lower()
    return any(pattern in error_str for pattern in recoverable_patterns)

def get_error_code(error: Exception) -> str:
    """Get error code from exception"""
    if isinstance(error, BaseError):
        return error.code
    
    # Map common error types to codes
    error_map = {
        "TypeError": "TYPE_ERROR",
        "ValueError": "VALUE_ERROR",
        "KeyError": "KEY_ERROR",
        "AttributeError": "ATTRIBUTE_ERROR",
        "IndexError": "INDEX_ERROR",
        "RuntimeError": "RUNTIME_ERROR",
    }
    
    return error_map.get(error.__class__.__name__, "UNKNOWN_ERROR")

def create_error_response(error: Exception, request_id: Optional[str] = None) -> Dict[str, Any]:
    """Create error response from exception"""
    return {
        "id": request_id or generate_id(),
        "error": {
            "code": get_error_code(error),
            "message": str(error),
            "details": error.details if hasattr(error, "details") else None,
            "recoverable": is_recoverable(error),
            "timestamp": datetime.now().isoformat()
        }
    }

def generate_id() -> str:
    """Generate unique ID"""
    return f"{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:9]}"