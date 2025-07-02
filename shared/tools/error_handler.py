"""
Error handling middleware for cross-language tool execution
"""

import traceback
from typing import Any, Dict, Optional, List, Callable
from datetime import datetime
from abc import ABC, abstractmethod

from ..types.python.tool import (
    ToolError,
    ToolExecutionResult,
    ToolExecutionStatus,
    ToolContext,
    ToolPerformance
)


class ErrorContext:
    """Context information for error handling"""
    def __init__(self, tool_id: str, language: str, parameters: Any, 
                 context: ToolContext, start_time: datetime):
        self.tool_id = tool_id
        self.language = language
        self.parameters = parameters
        self.context = context
        self.start_time = start_time


class ErrorHandler(ABC):
    """Base error handler interface"""
    
    @abstractmethod
    def can_handle(self, error: Exception) -> bool:
        """Check if this handler can handle the error"""
        pass
    
    @abstractmethod
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        """Handle the error and return a ToolError"""
        pass


class BaseErrorHandler(ErrorHandler):
    """Base error handler with common functionality"""
    
    def create_tool_error(self, code: str, message: str, details: Any, 
                         retryable: bool = False) -> ToolError:
        """Create a ToolError instance"""
        return ToolError(
            code=code,
            message=message,
            details=details,
            retryable=retryable,
            cause=str(details.get('original_error', '')) if isinstance(details, dict) else None
        )


class TimeoutErrorHandler(BaseErrorHandler):
    """Handler for timeout errors"""
    
    def can_handle(self, error: Exception) -> bool:
        error_str = str(error).lower()
        return (
            'timeout' in error_str or
            isinstance(error, TimeoutError) or
            (hasattr(error, 'code') and error.code == 'ETIMEDOUT')
        )
    
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        duration = (datetime.now() - context.start_time).total_seconds() * 1000
        return self.create_tool_error(
            'TOOL_TIMEOUT',
            f'Tool execution timed out after {context.context.timeout}s',
            {
                'tool_id': context.tool_id,
                'timeout': context.context.timeout,
                'duration': duration
            },
            True  # Timeouts are often retryable
        )


class ValidationErrorHandler(BaseErrorHandler):
    """Handler for validation errors"""
    
    def can_handle(self, error: Exception) -> bool:
        return (
            type(error).__name__ == 'ValidationError' or
            'validation' in str(error).lower() or
            'invalid parameters' in str(error).lower()
        )
    
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        return self.create_tool_error(
            'VALIDATION_ERROR',
            'Parameter validation failed',
            {
                'tool_id': context.tool_id,
                'parameters': context.parameters,
                'validation_errors': str(error)
            },
            False  # Validation errors are not retryable
        )


class TypeScriptExecutionErrorHandler(BaseErrorHandler):
    """Handler for TypeScript execution errors"""
    
    def can_handle(self, error: Exception) -> bool:
        error_str = str(error)
        return (
            'typescript' in error_str.lower() or
            (hasattr(error, 'source') and error.source == 'typescript') or
            (hasattr(error, 'code') and error.code == 'TYPESCRIPT_EXECUTION_ERROR')
        )
    
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        return self.create_tool_error(
            'TYPESCRIPT_EXECUTION_ERROR',
            str(error) or 'TypeScript tool execution failed',
            {
                'tool_id': context.tool_id,
                'language': 'typescript',
                'original_error': str(error)
            },
            self._is_retryable(error)
        )
    
    def _is_retryable(self, error: Exception) -> bool:
        error_str = str(error).lower()
        # Retry network errors
        if any(code in error_str for code in ['econnrefused', 'enotfound', 'etimedout']):
            return True
        return False


class PythonExecutionErrorHandler(BaseErrorHandler):
    """Handler for Python execution errors"""
    
    def can_handle(self, error: Exception) -> bool:
        # This handler acts as a catch-all for Python errors
        return True
    
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        tb = traceback.format_exception(type(error), error, error.__traceback__)
        
        return self.create_tool_error(
            'PYTHON_EXECUTION_ERROR',
            str(error) or 'Python tool execution failed',
            {
                'tool_id': context.tool_id,
                'language': 'python',
                'traceback': tb,
                'original_error': str(error)
            },
            self._is_retryable(error)
        )
    
    def _is_retryable(self, error: Exception) -> bool:
        # Don't retry syntax or import errors
        if isinstance(error, (SyntaxError, ImportError, ModuleNotFoundError)):
            return False
        
        # Retry network or temporary errors
        error_str = str(error).lower()
        if any(err in error_str for err in ['connection', 'timeout', 'temporary']):
            return True
        
        return False


class PermissionErrorHandler(BaseErrorHandler):
    """Handler for permission errors"""
    
    def can_handle(self, error: Exception) -> bool:
        return (
            isinstance(error, PermissionError) or
            'permission denied' in str(error).lower() or
            'access denied' in str(error).lower()
        )
    
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        return self.create_tool_error(
            'PERMISSION_DENIED',
            'Permission denied for tool execution',
            {
                'tool_id': context.tool_id,
                'operation': context.parameters,
                'error': str(error)
            },
            False  # Permission errors are not retryable
        )


class ResourceErrorHandler(BaseErrorHandler):
    """Handler for resource not found errors"""
    
    def can_handle(self, error: Exception) -> bool:
        return (
            isinstance(error, FileNotFoundError) or
            'not found' in str(error).lower() or
            'does not exist' in str(error).lower()
        )
    
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        return self.create_tool_error(
            'RESOURCE_NOT_FOUND',
            'Required resource not found',
            {
                'tool_id': context.tool_id,
                'resource': getattr(error, 'filename', 'unknown'),
                'error': str(error)
            },
            False  # Resource not found errors are not retryable
        )


class DefaultErrorHandler(BaseErrorHandler):
    """Default fallback error handler"""
    
    def can_handle(self, error: Exception) -> bool:
        return True  # Always handles as fallback
    
    def handle(self, error: Exception, context: ErrorContext) -> ToolError:
        tb = traceback.format_exception(type(error), error, error.__traceback__)
        
        return self.create_tool_error(
            'UNKNOWN_ERROR',
            str(error) or 'An unknown error occurred',
            {
                'tool_id': context.tool_id,
                'language': context.language,
                'error': str(error),
                'traceback': tb
            },
            False  # Unknown errors are not retryable by default
        )


class RetryStrategy:
    """Retry strategy for failed operations"""
    
    def __init__(self, max_attempts: int = 3, backoff_multiplier: float = 2,
                 initial_delay: int = 1000, max_delay: int = 30000):
        self.max_attempts = max_attempts
        self.backoff_multiplier = backoff_multiplier
        self.initial_delay = initial_delay
        self.max_delay = max_delay
    
    def should_retry(self, attempt: int, last_error: ToolError) -> bool:
        """Check if we should retry"""
        return attempt < self.max_attempts and last_error.retryable
    
    def get_delay(self, attempt: int) -> int:
        """Get delay before next retry in milliseconds"""
        delay = self.initial_delay * (self.backoff_multiplier ** attempt)
        return min(int(delay), self.max_delay)


class ErrorHandlingMiddleware:
    """Error handling middleware for tool execution"""
    
    def __init__(self):
        self.handlers: List[ErrorHandler] = [
            TimeoutErrorHandler(),
            ValidationErrorHandler(),
            TypeScriptExecutionErrorHandler(),
            PermissionErrorHandler(),
            ResourceErrorHandler(),
            PythonExecutionErrorHandler(),  # Acts as catch-all for Python errors
            DefaultErrorHandler()  # Must be last
        ]
    
    def handle_error(self, error: Exception, context: ErrorContext) -> ToolExecutionResult:
        """Handle an error and convert to ToolExecutionResult"""
        # Find appropriate handler
        handler = next(h for h in self.handlers if h.can_handle(error))
        tool_error = handler.handle(error, context)
        
        # Log error for debugging
        self._log_error(tool_error, context)
        
        # Create execution result
        end_time = datetime.now()
        duration = int((end_time - context.start_time).total_seconds() * 1000)
        
        return ToolExecutionResult(
            tool_id=context.tool_id,
            execution_id=f"error_{int(datetime.now().timestamp())}_{context.tool_id[:9]}",
            status=ToolExecutionStatus.ERROR,
            error=tool_error,
            performance=ToolPerformance(
                start_time=context.start_time.isoformat(),
                end_time=end_time.isoformat(),
                duration=duration
            )
        )
    
    def add_handler(self, handler: ErrorHandler, priority: str = 'low') -> None:
        """Add a custom error handler"""
        if priority == 'high':
            # Add at the beginning (but before DefaultErrorHandler)
            self.handlers.insert(len(self.handlers) - 1, handler)
        else:
            # Add before DefaultErrorHandler
            self.handlers.insert(len(self.handlers) - 1, handler)
    
    def _log_error(self, error: ToolError, context: ErrorContext) -> None:
        """Log error for debugging"""
        print(f"[Tool Error] {error.code}: {error.message}")
        print(f"  Tool ID: {context.tool_id}")
        print(f"  Language: {context.language}")
        print(f"  Retryable: {error.retryable}")
        if error.details:
            print(f"  Details: {error.details}")
    
    def is_retryable(self, error: ToolError) -> bool:
        """Check if an error is retryable"""
        return error.retryable
    
    def create_retry_strategy(self, error: ToolError) -> Optional[RetryStrategy]:
        """Create a retry strategy for an error"""
        if not self.is_retryable(error):
            return None
        
        # Default retry strategy
        return RetryStrategy()


# Create singleton instance
error_handler = ErrorHandlingMiddleware()