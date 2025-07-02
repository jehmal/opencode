"""
JSON-RPC Instrumentation Middleware for Python
Lightweight, non-blocking metrics collection for JSON-RPC calls
"""

import time
import json
import sys
import functools
from typing import Dict, Any, Optional, Callable, Awaitable
from dataclasses import dataclass

from protocol.python.types import (
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcError
)
from .types import (
    ExecutionMetrics,
    RpcMetrics,
    ExecutionStatus,
    Language,
    ErrorDetail
)
from .collector import MetricsCollector, ExecutionTracker

@dataclass
class MiddlewareContext:
    """Context for middleware"""
    metrics_collector: MetricsCollector
    language: Language

class JsonRpcInstrumentationMiddleware:
    """Instruments JSON-RPC requests and responses for metrics collection"""
    
    def __init__(self, context: MiddlewareContext):
        self.context = context
        self.pending_requests: Dict[str, Dict[str, Any]] = {}
    
    def instrument_request(self, request: JsonRpcRequest) -> JsonRpcRequest:
        """Instrument outgoing request"""
        start_time = time.perf_counter_ns()
        request_str = json.dumps({
            'jsonrpc': request.jsonrpc,
            'id': request.id,
            'method': request.method,
            'params': request.params,
            'protocol': request.protocol
        })
        request_size = len(request_str.encode('utf-8'))
        
        # Store pending request info
        self.pending_requests[str(request.id)] = {
            'start_time': start_time,
            'request_size': request_size,
            'execution_tracker': None
        }
        
        # For tool.execute requests, start execution tracking
        if request.method == 'tool.execute' and request.params:
            params = request.params
            execution_tracker = self.context.metrics_collector.start_execution(
                tool_id=params['tool'],
                execution_id=str(request.id),
                session_id=params['context']['sessionId'],
                message_id=params['context']['messageId'],
                language=self.context.language
            )
            
            self.pending_requests[str(request.id)]['execution_tracker'] = execution_tracker
        
        return request
    
    def instrument_response(self, response: JsonRpcResponse) -> JsonRpcResponse:
        """Instrument incoming response"""
        end_time = time.perf_counter_ns()
        response_str = json.dumps({
            'jsonrpc': response.jsonrpc,
            'id': response.id,
            'result': response.result,
            'error': response.error.__dict__ if response.error else None,
            'protocol': response.protocol
        })
        response_size = len(response_str.encode('utf-8'))
        
        pending = self.pending_requests.pop(str(response.id), None)
        if not pending:
            return response
        
        transport_time = (end_time - pending['start_time']) / 1_000_000  # Convert to ms
        
        # Record RPC metrics if we have an execution tracker
        execution_tracker = pending.get('execution_tracker')
        if execution_tracker:
            rpc_metrics = RpcMetrics(
                request_size=pending['request_size'],
                response_size=response_size,
                transport_time=transport_time
            )
            
            execution_tracker.record_rpc_metrics(rpc_metrics)
            
            # Complete execution based on response
            if response.error:
                execution_tracker.complete('error', ErrorDetail(
                    code=str(response.error.code),
                    message=response.error.message,
                    context=response.error.data
                ))
            else:
                execution_tracker.complete('success')
        
        return response
    
    def create_request_interceptor(self) -> Callable[[JsonRpcRequest], JsonRpcRequest]:
        """Create request interceptor for outgoing calls"""
        def interceptor(request: JsonRpcRequest) -> JsonRpcRequest:
            try:
                return self.instrument_request(request)
            except Exception as e:
                # Don't let instrumentation errors affect normal operation
                print(f"Metrics instrumentation error: {e}", file=sys.stderr)
                return request
        
        return interceptor
    
    def create_response_interceptor(self) -> Callable[[JsonRpcResponse], JsonRpcResponse]:
        """Create response interceptor for incoming responses"""
        def interceptor(response: JsonRpcResponse) -> JsonRpcResponse:
            try:
                return self.instrument_response(response)
            except Exception as e:
                # Don't let instrumentation errors affect normal operation
                print(f"Metrics instrumentation error: {e}", file=sys.stderr)
                return response
        
        return interceptor
    
    def handle_timeout(self, request_id: str) -> None:
        """Handle request timeout"""
        pending = self.pending_requests.pop(request_id, None)
        if pending and pending.get('execution_tracker'):
            pending['execution_tracker'].complete('timeout')
    
    def handle_cancellation(self, request_id: str) -> None:
        """Handle request cancellation"""
        pending = self.pending_requests.pop(request_id, None)
        if pending and pending.get('execution_tracker'):
            pending['execution_tracker'].complete('cancelled')
    
    def get_active_request_count(self) -> int:
        """Get active request count"""
        return len(self.pending_requests)

def with_metrics(
    tool_id: str,
    metrics_collector: MetricsCollector,
    language: Language = 'python'
) -> Callable:
    """Decorator to wrap async functions with metrics collection"""
    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            import uuid
            execution_id = f"{tool_id}-{int(time.time())}-{uuid.uuid4().hex[:8]}"
            
            tracker = metrics_collector.start_execution(
                tool_id=tool_id,
                execution_id=execution_id,
                session_id='direct-call',
                message_id='direct-call',
                language=language
            )
            
            import psutil
            process = psutil.Process()
            start_mem = process.memory_info().rss
            
            try:
                result = await func(*args, **kwargs)
                
                end_mem = process.memory_info().rss
                tracker.record_resource_metrics(ResourceMetrics(
                    memory_delta=end_mem - start_mem
                ))
                
                tracker.complete('success')
                return result
            except Exception as e:
                tracker.complete('error', ErrorDetail(
                    code=getattr(e, 'code', 'UNKNOWN_ERROR'),
                    message=str(e),
                    stack=getattr(e, '__traceback__', None)
                ))
                raise
        
        return wrapper
    return decorator

def sync_with_metrics(
    tool_id: str,
    metrics_collector: MetricsCollector,
    language: Language = 'python'
) -> Callable:
    """Decorator to wrap sync functions with metrics collection"""
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import uuid
            execution_id = f"{tool_id}-{int(time.time())}-{uuid.uuid4().hex[:8]}"
            
            tracker = metrics_collector.start_execution(
                tool_id=tool_id,
                execution_id=execution_id,
                session_id='direct-call',
                message_id='direct-call',
                language=language
            )
            
            import psutil
            process = psutil.Process()
            start_mem = process.memory_info().rss
            
            try:
                result = func(*args, **kwargs)
                
                end_mem = process.memory_info().rss
                tracker.record_resource_metrics(ResourceMetrics(
                    memory_delta=end_mem - start_mem
                ))
                
                tracker.complete('success')
                return result
            except Exception as e:
                tracker.complete('error', ErrorDetail(
                    code=getattr(e, 'code', 'UNKNOWN_ERROR'),
                    message=str(e),
                    stack=getattr(e, '__traceback__', None)
                ))
                raise
        
        return wrapper
    return decorator