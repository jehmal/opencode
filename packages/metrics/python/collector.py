"""
Python Metrics Collector
Lightweight in-memory metrics collection with periodic flushing
"""

import asyncio
import time
import json
import psutil
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict
from dataclasses import dataclass, asdict

from .types import (
    ExecutionMetrics,
    AggregatedMetrics,
    MetricsCollector as IMetricsCollector,
    ExecutionTracker as IExecutionTracker,
    ExecutionStatus,
    ErrorDetail,
    Language,
    AggregationPeriod,
    RpcMetrics,
    ResourceMetrics
)

class ExecutionTracker(IExecutionTracker):
    """Tracks metrics for a single execution"""
    
    def __init__(
        self,
        execution_id: str,
        collector: 'MetricsCollector',
        tool_id: str,
        session_id: str,
        message_id: str,
        language: Language
    ):
        super().__init__(execution_id)
        self.collector = collector
        self.start_time_ns = time.perf_counter_ns()
        self.process = psutil.Process()
        self.start_memory = self.process.memory_info().rss
        
        self.metrics = ExecutionMetrics(
            tool_id=tool_id,
            execution_id=execution_id,
            session_id=session_id,
            message_id=message_id,
            language=language,
            start_time=datetime.utcnow().isoformat(),
            status='success'  # Default
        )
    
    def record_rpc_metrics(self, metrics: RpcMetrics) -> None:
        """Record RPC metrics"""
        if self.metrics.rpc_metrics:
            # Merge with existing
            for key, value in asdict(metrics).items():
                if value is not None:
                    setattr(self.metrics.rpc_metrics, key, value)
        else:
            self.metrics.rpc_metrics = metrics
    
    def record_resource_metrics(self, metrics: ResourceMetrics) -> None:
        """Record resource metrics"""
        if self.metrics.resource_metrics:
            # Merge with existing
            for key, value in asdict(metrics).items():
                if value is not None:
                    setattr(self.metrics.resource_metrics, key, value)
        else:
            self.metrics.resource_metrics = metrics
    
    def record_custom_metric(self, key: str, value: Any) -> None:
        """Record a custom metric"""
        if self.metrics.custom_metrics is None:
            self.metrics.custom_metrics = {}
        self.metrics.custom_metrics[key] = value
    
    def complete(self, status: ExecutionStatus, error: Optional[ErrorDetail] = None) -> None:
        """Complete the execution tracking"""
        end_time_ns = time.perf_counter_ns()
        self.metrics.end_time = datetime.utcnow().isoformat()
        self.metrics.duration = (end_time_ns - self.start_time_ns) / 1_000_000  # Convert to ms
        self.metrics.status = status
        
        if error:
            self.metrics.error = error
        
        # Record final resource metrics if not already set
        if not self.metrics.resource_metrics:
            self.metrics.resource_metrics = ResourceMetrics()
        
        try:
            # Get CPU usage
            self.metrics.resource_metrics.cpu_usage = self.process.cpu_percent()
            
            # Get memory usage
            current_memory = self.process.memory_info().rss
            self.metrics.resource_metrics.memory_used = current_memory
            self.metrics.resource_metrics.memory_delta = current_memory - self.start_memory
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass  # Process might have ended
        
        self.collector.record_execution(self.metrics)

class MetricsCollector(IMetricsCollector):
    """Collects and aggregates execution metrics"""
    
    def __init__(
        self,
        max_buffer_size: int = 1000,
        flush_interval: float = 60.0,  # seconds
        auto_flush: bool = True
    ):
        self.executions: List[ExecutionMetrics] = []
        self.aggregated_cache: Dict[str, AggregatedMetrics] = {}
        self.max_buffer_size = max_buffer_size
        self.flush_interval = flush_interval
        self.flush_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        
        if auto_flush:
            self.start_auto_flush()
    
    def start_execution(
        self,
        tool_id: str,
        execution_id: str,
        session_id: str,
        message_id: str,
        language: Language
    ) -> ExecutionTracker:
        """Start tracking a new execution"""
        return ExecutionTracker(
            execution_id=execution_id,
            collector=self,
            tool_id=tool_id,
            session_id=session_id,
            message_id=message_id,
            language=language
        )
    
    def record_execution(self, metrics: ExecutionMetrics) -> None:
        """Record completed execution metrics"""
        asyncio.create_task(self._record_execution_async(metrics))
    
    async def _record_execution_async(self, metrics: ExecutionMetrics) -> None:
        """Async version of record_execution"""
        async with self._lock:
            self.executions.append(metrics)
            
            # Check if we need to flush
            if len(self.executions) >= self.max_buffer_size:
                await self.flush()
    
    def get_metrics(self, tool_id: Optional[str] = None) -> List[ExecutionMetrics]:
        """Get execution metrics, optionally filtered by tool"""
        if not tool_id:
            return self.executions.copy()
        
        return [m for m in self.executions if m.tool_id == tool_id]
    
    def get_aggregated_metrics(
        self,
        tool_id: str,
        language: Language,
        period: AggregationPeriod
    ) -> Optional[AggregatedMetrics]:
        """Get aggregated metrics for a tool"""
        cache_key = f"{tool_id}-{language}-{period}"
        
        # Check cache
        cached = self.aggregated_cache.get(cache_key)
        if cached and self._is_cache_valid(cached, period):
            return cached
        
        # Calculate aggregated metrics
        relevant_metrics = [
            m for m in self.executions
            if m.tool_id == tool_id and m.language == language
        ]
        
        if not relevant_metrics:
            return None
        
        aggregated = self._calculate_aggregated_metrics(
            relevant_metrics, tool_id, language, period
        )
        
        # Cache the result
        self.aggregated_cache[cache_key] = aggregated
        return aggregated
    
    def _calculate_aggregated_metrics(
        self,
        metrics: List[ExecutionMetrics],
        tool_id: str,
        language: Language,
        period: AggregationPeriod
    ) -> AggregatedMetrics:
        """Calculate aggregated metrics"""
        now = datetime.utcnow()
        period_start = self._get_period_start(now, period)
        
        # Filter metrics within period
        period_metrics = []
        for m in metrics:
            start_time = datetime.fromisoformat(m.start_time.replace('Z', '+00:00'))
            if start_time >= period_start and start_time <= now:
                period_metrics.append(m)
        
        # Count by status
        status_counts = defaultdict(int)
        durations = []
        error_breakdown = defaultdict(int)
        
        for metric in period_metrics:
            status_counts[metric.status] += 1
            
            if metric.duration is not None:
                durations.append(metric.duration)
            
            if metric.error:
                error_breakdown[metric.error.code] += 1
        
        # Calculate duration statistics
        durations.sort()
        duration_stats = self._calculate_percentiles(durations)
        
        total = len(period_metrics)
        
        return AggregatedMetrics(
            tool_id=tool_id,
            language=language,
            period=period,
            start_time=period_start.isoformat(),
            end_time=now.isoformat(),
            total_executions=total,
            success_count=status_counts['success'],
            error_count=status_counts['error'],
            timeout_count=status_counts['timeout'],
            cancelled_count=status_counts['cancelled'],
            success_rate=status_counts['success'] / total if total > 0 else 0,
            average_duration=duration_stats['average'],
            min_duration=duration_stats['min'],
            max_duration=duration_stats['max'],
            p50_duration=duration_stats['p50'],
            p90_duration=duration_stats['p90'],
            p95_duration=duration_stats['p95'],
            p99_duration=duration_stats['p99'],
            error_breakdown=dict(error_breakdown)
        )
    
    def _calculate_percentiles(self, values: List[float]) -> Dict[str, float]:
        """Calculate percentile statistics"""
        if not values:
            return {
                'average': 0,
                'min': 0,
                'max': 0,
                'p50': 0,
                'p90': 0,
                'p95': 0,
                'p99': 0
            }
        
        return {
            'average': sum(values) / len(values),
            'min': values[0],
            'max': values[-1],
            'p50': self._percentile(values, 0.5),
            'p90': self._percentile(values, 0.9),
            'p95': self._percentile(values, 0.95),
            'p99': self._percentile(values, 0.99)
        }
    
    def _percentile(self, sorted_values: List[float], p: float) -> float:
        """Calculate percentile value"""
        if not sorted_values:
            return 0
        
        index = int(len(sorted_values) * p)
        return sorted_values[min(index, len(sorted_values) - 1)]
    
    def _get_period_start(self, now: datetime, period: AggregationPeriod) -> datetime:
        """Get the start time for a period"""
        if period == 'minute':
            return now.replace(second=0, microsecond=0)
        elif period == 'hour':
            return now.replace(minute=0, second=0, microsecond=0)
        elif period == 'day':
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == 'week':
            days_since_monday = now.weekday()
            start = now - timedelta(days=days_since_monday)
            return start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        return now
    
    def _is_cache_valid(self, cached: AggregatedMetrics, period: AggregationPeriod) -> bool:
        """Check if cached metrics are still valid"""
        now = datetime.utcnow()
        cache_age = now - datetime.fromisoformat(cached.end_time.replace('Z', '+00:00'))
        
        # Maximum age for cache validity
        max_age = {
            'minute': timedelta(seconds=10),
            'hour': timedelta(minutes=1),
            'day': timedelta(minutes=5),
            'week': timedelta(minutes=10)
        }
        
        return cache_age < max_age[period]
    
    async def flush(self) -> None:
        """Flush pending metrics"""
        async with self._lock:
            if not self.executions:
                return
            
            metrics_to_flush = self.executions.copy()
            self.executions = []
        
        try:
            await self._persist_metrics(metrics_to_flush)
        except Exception as e:
            # Re-add metrics on failure
            async with self._lock:
                self.executions = metrics_to_flush + self.executions
            raise e
    
    async def _persist_metrics(self, metrics: List[ExecutionMetrics]) -> None:
        """Persist metrics - override for custom persistence"""
        # Default implementation just logs
        print(f"Flushing {len(metrics)} metrics")
    
    def start_auto_flush(self) -> None:
        """Start automatic flushing"""
        async def flush_loop():
            while True:
                await asyncio.sleep(self.flush_interval)
                try:
                    await self.flush()
                except Exception as e:
                    print(f"Auto-flush error: {e}")
        
        self.flush_task = asyncio.create_task(flush_loop())
    
    def stop(self) -> None:
        """Stop the collector"""
        if self.flush_task:
            self.flush_task.cancel()
            self.flush_task = None

# Global metrics collector instance
_global_collector: Optional[MetricsCollector] = None

def get_global_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector"""
    global _global_collector
    if not _global_collector:
        _global_collector = MetricsCollector()
    return _global_collector

def set_global_metrics_collector(collector: MetricsCollector) -> None:
    """Set the global metrics collector"""
    global _global_collector
    if _global_collector:
        _global_collector.stop()
    _global_collector = collector