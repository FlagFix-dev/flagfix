"""Pydantic models for the AI pipeline's structured outputs. Defining
these explicitly means a malformed LLM response fails loudly and safely
(a validation error we catch) instead of silently corrupting a Problem row."""
from pydantic import BaseModel, Field


class ExtractionResult(BaseModel):
    title: str = Field(max_length=200)
    category: str
    severity: int = Field(ge=0, le=100)
    urgency: int = Field(ge=0, le=100)
    safety_flag: bool
    suggested_department: str
    reasoning: str = Field(max_length=300)
    low_confidence: bool = False
