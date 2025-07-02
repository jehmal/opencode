"""
OpenCode-DGM Communication Protocol Python Definitions
"""
from typing import Dict, List, Literal, Optional, Union, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TaskMetadata(BaseModel):
    """Metadata for task requests"""
    timestamp: datetime
    source: str
    priority: Literal["low", "medium", "high"]
    timeout: Optional[int] = Field(None, description="Timeout in seconds")


class TaskResponseMetadata(BaseModel):
    """Metadata for task responses"""
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    duration: float = Field(description="Duration in seconds")


class TaskError(BaseModel):
    """Error information for failed tasks"""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class CodeGenerationContext(BaseModel):
    """Context for code generation"""
    files: Optional[List[str]] = None
    dependencies: Optional[List[str]] = None


class CodeGenerationConstraints(BaseModel):
    """Constraints for code generation"""
    max_tokens: Optional[int] = Field(None, alias="maxTokens")
    temperature: Optional[float] = None
    style: Optional[str] = None


class CodeGenerationPayload(BaseModel):
    """Payload for code generation tasks"""
    prompt: str
    language: str
    context: Optional[CodeGenerationContext] = None
    constraints: Optional[CodeGenerationConstraints] = None


class TestCoverage(BaseModel):
    """Test coverage configuration"""
    target: Optional[float] = Field(None, ge=0, le=100)
    types: Optional[List[Literal["unit", "integration", "e2e"]]] = None


class TestGenerationPayload(BaseModel):
    """Payload for test generation tasks"""
    code: str
    framework: Literal["jest", "pytest", "go_test", "junit"]
    coverage: Optional[TestCoverage] = None


class OptimizationExample(BaseModel):
    """Example for prompt optimization"""
    input: str
    output: str
    score: Optional[float] = None


class OptimizationConstraints(BaseModel):
    """Constraints for prompt optimization"""
    max_length: Optional[int] = Field(None, alias="maxLength")
    techniques: Optional[List[str]] = None


class PromptOptimizationPayload(BaseModel):
    """Payload for prompt optimization tasks"""
    original_prompt: str = Field(alias="originalPrompt")
    objective: str
    examples: Optional[List[OptimizationExample]] = None
    constraints: Optional[OptimizationConstraints] = None


class EvaluationEnvironment(BaseModel):
    """Environment configuration for evaluation"""
    runtime: Optional[str] = None
    version: Optional[str] = None
    dependencies: Optional[Dict[str, str]] = None


class EvaluationPayload(BaseModel):
    """Payload for evaluation tasks"""
    code: str
    tests: List[str]
    metrics: Optional[List[Literal["correctness", "performance", "readability", "maintainability"]]] = None
    environment: Optional[EvaluationEnvironment] = None


# Union type for all payloads
TaskPayload = Union[
    CodeGenerationPayload,
    TestGenerationPayload,
    PromptOptimizationPayload,
    EvaluationPayload
]


class TaskRequest(BaseModel):
    """Request for task execution"""
    id: str
    type: Literal["code_generation", "test_generation", "prompt_optimization", "evaluation"]
    payload: TaskPayload
    metadata: Optional[TaskMetadata] = None

    class Config:
        allow_population_by_field_name = True


class TaskResponse(BaseModel):
    """Response from task execution"""
    id: str
    status: Literal["success", "error", "timeout", "cancelled"]
    result: Any
    error: Optional[TaskError] = None
    metadata: Optional[TaskResponseMetadata] = None

    class Config:
        allow_population_by_field_name = True


# Helper functions for type checking
def is_code_generation_payload(payload: TaskPayload) -> bool:
    """Check if payload is for code generation"""
    return isinstance(payload, CodeGenerationPayload)


def is_test_generation_payload(payload: TaskPayload) -> bool:
    """Check if payload is for test generation"""
    return isinstance(payload, TestGenerationPayload)


def is_prompt_optimization_payload(payload: TaskPayload) -> bool:
    """Check if payload is for prompt optimization"""
    return isinstance(payload, PromptOptimizationPayload)


def is_evaluation_payload(payload: TaskPayload) -> bool:
    """Check if payload is for evaluation"""
    return isinstance(payload, EvaluationPayload)