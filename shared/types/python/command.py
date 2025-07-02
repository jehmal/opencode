"""Command-related Type Definitions"""

from typing import Dict, List, Optional, Any, Callable, Awaitable, Union, Literal
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum
import asyncio

from .base import Priority, Status, Metadata

# Command types
class CommandType(str, Enum):
    EXECUTION = "execution"
    QUERY = "query"
    CONFIGURATION = "configuration"
    NAVIGATION = "navigation"
    GENERATION = "generation"
    ANALYSIS = "analysis"
    TRANSFORMATION = "transformation"
    WORKFLOW = "workflow"

# Command entity
class CommandEntity(BaseModel):
    """Command entity extracted from input"""
    type: str
    value: str
    confidence: float
    position: Dict[str, int]

# Command intent
class CommandIntent(BaseModel):
    """Command intent analysis"""
    primary: str
    secondary: Optional[str] = None
    confidence: float
    alternative_intents: Optional[List[Dict[str, Union[str, float]]]] = Field(None, alias="alternativeIntents")
    entities: Optional[List[CommandEntity]] = None

# Command retry policy
class CommandRetryPolicy(BaseModel):
    """Command retry policy"""
    max_attempts: int = Field(alias="maxAttempts")
    backoff_ms: int = Field(alias="backoffMs")
    exponential_backoff: Optional[bool] = Field(None, alias="exponentialBackoff")
    retryable_errors: Optional[List[str]] = Field(None, alias="retryableErrors")

# Command schedule type
class CommandScheduleType(str, Enum):
    ONCE = "once"
    RECURRING = "recurring"
    CRON = "cron"

# Command schedule
class CommandSchedule(BaseModel):
    """Command scheduling configuration"""
    type: CommandScheduleType
    at: Optional[str] = None
    interval: Optional[int] = None
    cron: Optional[str] = None
    timezone: Optional[str] = None

# Command condition type
class CommandConditionType(str, Enum):
    DEPENDENCY = "dependency"
    STATE = "state"
    TIME = "time"
    EVENT = "event"

# Command condition
class CommandCondition(BaseModel):
    """Command execution condition"""
    type: CommandConditionType
    expression: str
    timeout: Optional[int] = None

# Command execution mode
class CommandExecutionMode(str, Enum):
    IMMEDIATE = "immediate"
    SCHEDULED = "scheduled"
    CONDITIONAL = "conditional"

# Command options
class CommandOptions(BaseModel):
    """Command execution options"""
    async_execution: Optional[bool] = Field(None, alias="async")
    timeout: Optional[int] = None
    priority: Optional[Priority] = None
    retry_policy: Optional[CommandRetryPolicy] = Field(None, alias="retryPolicy")
    execution_mode: Optional[CommandExecutionMode] = Field(None, alias="executionMode")
    schedule: Optional[CommandSchedule] = None
    conditions: Optional[List[CommandCondition]] = None

# Command source
class CommandSource(str, Enum):
    CLI = "cli"
    API = "api"
    UI = "ui"
    AGENT = "agent"
    WORKFLOW = "workflow"
    INTERNAL = "internal"

# Command metadata
class CommandMetadata(Metadata):
    """Command-specific metadata"""
    source: CommandSource
    user_id: Optional[str] = Field(None, alias="userId")
    session_id: Optional[str] = Field(None, alias="sessionId")
    parent_command_id: Optional[str] = Field(None, alias="parentCommandId")
    workflow_id: Optional[str] = Field(None, alias="workflowId")

# Command definition
class Command(BaseModel):
    """Command definition"""
    id: str
    type: CommandType
    intent: CommandIntent
    raw_input: str = Field(alias="rawInput")
    parameters: Dict[str, Any]
    options: CommandOptions
    metadata: CommandMetadata
    timestamp: str

# Command error
class CommandError(BaseModel):
    """Command execution error"""
    code: str
    message: str
    details: Optional[Any] = None
    stack: Optional[str] = None
    recoverable: bool
    suggestions: Optional[List[str]] = None

# Command artifact
class CommandArtifact(BaseModel):
    """Command execution artifact"""
    name: str
    type: str
    content: Optional[Any] = None
    path: Optional[str] = None
    size: Optional[int] = None

# Sub-command result
class SubCommandResult(BaseModel):
    """Sub-command execution result"""
    command_id: str = Field(alias="commandId")
    status: Status
    summary: Optional[str] = None

# Command result
class CommandResult(BaseModel):
    """Command execution result"""
    command_id: str = Field(alias="commandId")
    status: Status
    data: Optional[Any] = None
    error: Optional[CommandError] = None
    execution_time: int = Field(alias="executionTime")
    timestamp: str
    artifacts: Optional[List[CommandArtifact]] = None
    sub_commands: Optional[List[SubCommandResult]] = Field(None, alias="subCommands")

# Command logger interface
class CommandLogger:
    """Command logger interface"""
    def debug(self, message: str, data: Optional[Any] = None) -> None:
        pass
    
    def info(self, message: str, data: Optional[Any] = None) -> None:
        pass
    
    def warn(self, message: str, data: Optional[Any] = None) -> None:
        pass
    
    def error(self, message: str, error: Optional[Any] = None) -> None:
        pass
    
    def audit(self, action: str, details: Optional[Any] = None) -> None:
        pass

# Command event bus interface
class CommandEventBus:
    """Command event bus interface"""
    def emit(self, event: str, data: Any) -> None:
        pass
    
    def on(self, event: str, handler: Callable[[Any], None]) -> None:
        pass
    
    def off(self, event: str, handler: Callable[[Any], None]) -> None:
        pass
    
    def once(self, event: str, handler: Callable[[Any], None]) -> None:
        pass

# Command user
class CommandUser(BaseModel):
    """Command user information"""
    id: str
    name: Optional[str] = None
    roles: Optional[List[str]] = None
    permissions: Optional[List[str]] = None

# Command session
class CommandSession(BaseModel):
    """Command session information"""
    id: str
    user_id: str = Field(alias="userId")
    start_time: str = Field(alias="startTime")
    context: Dict[str, Any]

# Command context
class CommandContext(BaseModel):
    """Command execution context"""
    services: Dict[str, Any]
    logger: CommandLogger
    event_bus: CommandEventBus = Field(alias="eventBus")
    abort_signal: Optional[asyncio.Event] = Field(None, alias="abortSignal")
    user: Optional[CommandUser] = None
    session: Optional[CommandSession] = None

    class Config:
        arbitrary_types_allowed = True

# Command example
class CommandExample(BaseModel):
    """Command usage example"""
    description: str
    input: str
    parameters: Optional[Dict[str, Any]] = None
    expected_output: Optional[Any] = Field(None, alias="expectedOutput")

# Command schema
class CommandSchema(BaseModel):
    """Command schema definition"""
    parameters: Any  # Should be a Zod schema in TypeScript
    options: Optional[Any] = None
    examples: Optional[List[CommandExample]] = None

# Command handler
class CommandHandler(BaseModel):
    """Command handler definition"""
    name: str
    description: str
    type: CommandType
    schema: Optional[CommandSchema] = None

    class Config:
        arbitrary_types_allowed = True

# Command route
class CommandRoute(BaseModel):
    """Command routing definition"""
    pattern: Union[str, Any]  # str or RegExp
    handler: str
    middleware: Optional[List[str]] = None
    description: Optional[str] = None
    examples: Optional[List[str]] = None

# Command router interface
class CommandRouter:
    """Command router interface"""
    def register(self, pattern: Union[str, Any], handler: CommandHandler) -> None:
        pass
    
    def unregister(self, pattern: Union[str, Any]) -> None:
        pass
    
    async def route(self, command: Command) -> Optional[CommandHandler]:
        pass
    
    def list_routes(self) -> List[CommandRoute]:
        pass

# Type guards
def is_command_error(value: Any) -> bool:
    """Check if value is a command error"""
    return (
        isinstance(value, dict) and
        "code" in value and
        "message" in value and
        "recoverable" in value and
        isinstance(value.get("recoverable"), bool)
    )

def is_command_result(value: Any) -> bool:
    """Check if value is a command result"""
    return (
        isinstance(value, dict) and
        "commandId" in value and
        "status" in value and
        "executionTime" in value and
        isinstance(value.get("executionTime"), (int, float))
    )