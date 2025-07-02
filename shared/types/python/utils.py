"""Utility Type Definitions and Helpers"""

from typing import (
    Dict, List, Optional, Any, TypeVar, Generic, Union, Tuple,
    Callable, Awaitable, Type, cast, Protocol, runtime_checkable
)
from datetime import datetime
from pydantic import BaseModel
import asyncio
import time
import uuid
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum

# Type variables
T = TypeVar("T")
E = TypeVar("E")
K = TypeVar("K")
V = TypeVar("V")

# Nullable and Optional aliases
Nullable = Optional
MaybeAsync = Union[T, Awaitable[T]]

# Event map type
EventMap = Dict[str, Any]

# Disposable pattern
@runtime_checkable
class Disposable(Protocol):
    """Disposable resource interface"""
    def dispose(self) -> None:
        """Dispose of the resource"""
        ...

@runtime_checkable
class AsyncDisposable(Protocol):
    """Async disposable resource interface"""
    async def dispose(self) -> None:
        """Dispose of the resource asynchronously"""
        ...

# Result type (similar to Rust)
@dataclass
class Ok(Generic[T]):
    """Successful result"""
    value: T
    ok: bool = True

@dataclass
class Err(Generic[E]):
    """Error result"""
    error: E
    ok: bool = False

Result = Union[Ok[T], Err[E]]

def is_ok(result: Result[T, E]) -> bool:
    """Check if result is Ok"""
    return result.ok

def is_err(result: Result[T, E]) -> bool:
    """Check if result is Err"""
    return not result.ok

# Option type (similar to Rust)
@dataclass
class Some(Generic[T]):
    """Some value"""
    value: T
    some: bool = True

@dataclass
class Nothing:
    """No value"""
    some: bool = False

Option = Union[Some[T], Nothing]

def is_some(option: Option[T]) -> bool:
    """Check if option has value"""
    return option.some

def is_none(option: Option[T]) -> bool:
    """Check if option is empty"""
    return not option.some

# Lazy value
class Lazy(Generic[T]):
    """Lazy-evaluated value"""
    
    def __init__(self, factory: Callable[[], T]):
        self._factory = factory
        self._value: Optional[T] = None
        self._computed = False
    
    @property
    def value(self) -> T:
        """Get the lazy value, computing if necessary"""
        if not self._computed:
            self._value = self._factory()
            self._computed = True
        return cast(T, self._value)

# Deferred promise
class Deferred(Generic[T]):
    """Deferred value that can be resolved later"""
    
    def __init__(self):
        self._future: asyncio.Future[T] = asyncio.Future()
    
    @property
    def promise(self) -> asyncio.Future[T]:
        """Get the underlying future"""
        return self._future
    
    def resolve(self, value: T) -> None:
        """Resolve with a value"""
        if not self._future.done():
            self._future.set_result(value)
    
    def reject(self, error: Exception) -> None:
        """Reject with an error"""
        if not self._future.done():
            self._future.set_exception(error)
    
    async def wait(self) -> T:
        """Wait for the value"""
        return await self._future

# Semaphore for concurrency control
class Semaphore:
    """Async semaphore for limiting concurrent operations"""
    
    def __init__(self, max_concurrent: int):
        self._semaphore = asyncio.Semaphore(max_concurrent)
    
    async def acquire(self) -> None:
        """Acquire a slot"""
        await self._semaphore.acquire()
    
    def release(self) -> None:
        """Release a slot"""
        self._semaphore.release()
    
    @asynccontextmanager
    async def use(self):
        """Context manager for using the semaphore"""
        await self.acquire()
        try:
            yield
        finally:
            self.release()

# Rate limiter
class RateLimiter:
    """Token bucket rate limiter"""
    
    def __init__(self, capacity: int, refill_rate: float, refill_interval: float):
        self._capacity = capacity
        self._refill_rate = refill_rate
        self._refill_interval = refill_interval
        self._tokens = float(capacity)
        self._last_refill = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self, tokens: int = 1) -> None:
        """Acquire tokens, waiting if necessary"""
        async with self._lock:
            await self._refill()
            
            while self._tokens < tokens:
                wait_time = ((tokens - self._tokens) / self._refill_rate) * self._refill_interval
                await asyncio.sleep(wait_time)
                await self._refill()
            
            self._tokens -= tokens
    
    async def _refill(self) -> None:
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self._last_refill
        refills = elapsed / self._refill_interval
        
        if refills > 0:
            self._tokens = min(self._capacity, self._tokens + refills * self._refill_rate)
            self._last_refill = now

# Circuit breaker states
class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half-open"

# Circuit breaker
class CircuitBreaker:
    """Circuit breaker for fault tolerance"""
    
    def __init__(self, threshold: int, timeout: float, reset_timeout: float):
        self._threshold = threshold
        self._timeout = timeout
        self._reset_timeout = reset_timeout
        self._failures = 0
        self._last_failure_time: Optional[float] = None
        self._state = CircuitState.CLOSED
        self._lock = asyncio.Lock()
    
    async def execute(self, func: Callable[[], Awaitable[T]]) -> T:
        """Execute function with circuit breaker protection"""
        async with self._lock:
            if self._state == CircuitState.OPEN:
                if time.time() - (self._last_failure_time or 0) > self._reset_timeout:
                    self._state = CircuitState.HALF_OPEN
                else:
                    raise Exception("Circuit breaker is open")
        
        try:
            result = await func()
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure()
            raise e
    
    async def _on_success(self) -> None:
        """Handle successful execution"""
        async with self._lock:
            self._failures = 0
            self._state = CircuitState.CLOSED
    
    async def _on_failure(self) -> None:
        """Handle failed execution"""
        async with self._lock:
            self._failures += 1
            self._last_failure_time = time.time()
            
            if self._failures >= self._threshold:
                self._state = CircuitState.OPEN

# Typed event emitter
class TypedEventEmitter(Generic[T]):
    """Type-safe event emitter"""
    
    def __init__(self):
        self._handlers: Dict[str, List[Callable[[Any], None]]] = {}
    
    def on(self, event: str, handler: Callable[[T], None]) -> None:
        """Register event handler"""
        if event not in self._handlers:
            self._handlers[event] = []
        self._handlers[event].append(handler)
    
    def off(self, event: str, handler: Callable[[T], None]) -> None:
        """Unregister event handler"""
        if event in self._handlers:
            self._handlers[event] = [h for h in self._handlers[event] if h != handler]
    
    def emit(self, event: str, data: T) -> None:
        """Emit event to all handlers"""
        if event in self._handlers:
            for handler in self._handlers[event]:
                try:
                    handler(data)
                except Exception:
                    pass  # Ignore handler errors
    
    def once(self, event: str, handler: Callable[[T], None]) -> None:
        """Register one-time event handler"""
        def wrapper(data: T) -> None:
            handler(data)
            self.off(event, wrapper)
        
        self.on(event, wrapper)

# Retry decorator
def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,)
):
    """Decorator for retrying async functions"""
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
            
            raise last_exception
        
        return wrapper
    
    return decorator

# Type validation utilities
def is_dict(value: Any) -> bool:
    """Check if value is a dictionary"""
    return isinstance(value, dict)

def is_list(value: Any) -> bool:
    """Check if value is a list"""
    return isinstance(value, list)

def is_string(value: Any) -> bool:
    """Check if value is a string"""
    return isinstance(value, str)

def is_number(value: Any) -> bool:
    """Check if value is a number"""
    return isinstance(value, (int, float))

def is_boolean(value: Any) -> bool:
    """Check if value is a boolean"""
    return isinstance(value, bool)

def is_none(value: Any) -> bool:
    """Check if value is None"""
    return value is None

def is_function(value: Any) -> bool:
    """Check if value is a function"""
    return callable(value)

def is_async_function(value: Any) -> bool:
    """Check if value is an async function"""
    return asyncio.iscoroutinefunction(value)

def is_promise(value: Any) -> bool:
    """Check if value is a promise/future"""
    return asyncio.isfuture(value) or asyncio.iscoroutine(value)

def has_property(obj: Any, key: str) -> bool:
    """Check if object has property"""
    return hasattr(obj, key)

# ID generation
def generate_id() -> str:
    """Generate unique ID"""
    return f"{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:9]}"

def generate_uuid() -> str:
    """Generate UUID v4"""
    return str(uuid.uuid4())

# Deep merge dictionaries
def deep_merge(target: Dict[str, Any], source: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge source into target"""
    result = target.copy()
    
    for key, value in source.items():
        if key in result and is_dict(result[key]) and is_dict(value):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    
    return result

# Flatten nested dictionary
def flatten_dict(
    data: Dict[str, Any],
    parent_key: str = "",
    separator: str = "."
) -> Dict[str, Any]:
    """Flatten nested dictionary"""
    items: List[Tuple[str, Any]] = []
    
    for key, value in data.items():
        new_key = f"{parent_key}{separator}{key}" if parent_key else key
        
        if is_dict(value):
            items.extend(flatten_dict(value, new_key, separator).items())
        else:
            items.append((new_key, value))
    
    return dict(items)

# Chunk list
def chunk_list(lst: List[T], size: int) -> List[List[T]]:
    """Split list into chunks of specified size"""
    return [lst[i:i + size] for i in range(0, len(lst), size)]

# Debounce decorator
def debounce(delay: float):
    """Decorator for debouncing async functions"""
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        task: Optional[asyncio.Task] = None
        
        async def wrapper(*args, **kwargs) -> T:
            nonlocal task
            
            if task:
                task.cancel()
            
            async def delayed():
                await asyncio.sleep(delay)
                return await func(*args, **kwargs)
            
            task = asyncio.create_task(delayed())
            return await task
        
        return wrapper
    
    return decorator

# Throttle decorator
def throttle(interval: float):
    """Decorator for throttling async functions"""
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        last_call: Optional[float] = None
        
        async def wrapper(*args, **kwargs) -> T:
            nonlocal last_call
            
            now = time.time()
            if last_call and now - last_call < interval:
                wait_time = interval - (now - last_call)
                await asyncio.sleep(wait_time)
            
            last_call = time.time()
            return await func(*args, **kwargs)
        
        return wrapper
    
    return decorator