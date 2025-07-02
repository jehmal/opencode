"""
DGMSTT Metrics Types for Python
Lightweight metrics collection for cross-language tool execution
"""

from typing import Dict, Any, Optional, Literal, List
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

Language = Literal['typescript', 'python']
ExecutionStatus = Literal['success', 'error', 'timeout', 'cancelled']
AggregationPeriod = Literal['minute', 'hour', 'day', 'week']

@dataclass
class ErrorDetail:
    """Error information for failed executions"""
    code: str
    message: str
    stack: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

@dataclass
class RpcMetrics:
    """JSON-RPC transport metrics"""
    request_size: int = 0
    response_size: int = 0
    serialization_time: float = 0
    transport_time: float = 0

@dataclass
class ResourceMetrics:
    """Resource usage metrics"""
    cpu_usage: Optional[float] = None
    memory_used: Optional[int] = None
    memory_delta: Optional[int] = None

@dataclass
class ExecutionMetrics:
    """Metrics for a single tool execution"""
    tool_id: str
    execution_id: str
    session_id: str
    message_id: str
    language: Language
    start_time: str  # ISO 8601
    status: ExecutionStatus
    end_time: Optional[str] = None
    duration: Optional[float] = None  # milliseconds
    error: Optional[ErrorDetail] = None
    rpc_metrics: Optional[RpcMetrics] = None
    resource_metrics: Optional[ResourceMetrics] = None
    custom_metrics: Optional[Dict[str, Any]] = None

@dataclass
class AggregatedMetrics:
    """Aggregated metrics over a time period"""
    tool_id: str
    language: Language
    period: AggregationPeriod
    start_time: str
    end_time: str
    total_executions: int
    success_count: int
    error_count: int
    timeout_count: int
    cancelled_count: int
    success_rate: float
    average_duration: float
    min_duration: float
    max_duration: float
    p50_duration: float
    p90_duration: float
    p95_duration: float
    p99_duration: float
    error_breakdown: Dict[str, int] = field(default_factory=dict)

class ExecutionTracker:
    """Interface for tracking a single execution"""
    
    def __init__(self, execution_id: str):
        self.execution_id = execution_id
    
    def record_rpc_metrics(self, metrics: RpcMetrics) -> None:
        """Record RPC metrics"""
        raise NotImplementedError
    
    def record_resource_metrics(self, metrics: ResourceMetrics) -> None:
        """Record resource metrics"""
        raise NotImplementedError
    
    def record_custom_metric(self, key: str, value: Any) -> None:
        """Record a custom metric"""
        raise NotImplementedError
    
    def complete(self, status: ExecutionStatus, error: Optional[ErrorDetail] = None) -> None:
        """Complete the execution tracking"""
        raise NotImplementedError

class MetricsCollector:
    """Interface for metrics collection"""
    
    def start_execution(
        self,
        tool_id: str,
        execution_id: str,
        session_id: str,
        message_id: str,
        language: Language
    ) -> ExecutionTracker:
        """Start tracking a new execution"""
        raise NotImplementedError
    
    def get_metrics(self, tool_id: Optional[str] = None) -> List[ExecutionMetrics]:
        """Get execution metrics, optionally filtered by tool"""
        raise NotImplementedError
    
    def get_aggregated_metrics(
        self,
        tool_id: str,
        language: Language,
        period: AggregationPeriod
    ) -> Optional[AggregatedMetrics]:
        """Get aggregated metrics for a tool"""
        raise NotImplementedError
    
    async def flush(self) -> None:
        """Flush pending metrics"""
        raise NotImplementedError