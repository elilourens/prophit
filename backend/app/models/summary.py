"""Summary and response models."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class SummaryResponse(BaseModel):
    """Base summary response from an LLM."""
    
    model_config = ConfigDict(protected_namespaces=())
    
    model_id: str = Field(..., description="Identifier of the LLM model")
    summary_type: str = Field(..., description="'daily' or 'monthly'")
    key_patterns: List[str] = Field(default_factory=list, description="Key spending patterns identified")
    oddities: List[str] = Field(default_factory=list, description="Unusual transactions or patterns")
    predictions: List[str] = Field(default_factory=list, description="Predictions for next period")
    risk_flags: List[str] = Field(default_factory=list, description="Risk indicators (overspending, low balance, etc.)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")
    explanations: List[str] = Field(default_factory=list, description="Rationale tied to data evidence")


class DailySummary(SummaryResponse):
    """Daily summary response."""
    
    summary_type: str = Field(default="daily", description="Summary type")


class MonthlySummary(SummaryResponse):
    """Monthly summary response."""
    
    summary_type: str = Field(default="monthly", description="Summary type")


class JudgeOutput(BaseModel):
    """Judge model output selecting best summary."""
    
    model_config = ConfigDict(protected_namespaces=())
    
    winning_model_id: str = Field(..., description="ID of the winning model")
    ranked_models: List[str] = Field(default_factory=list, description="All models ranked by quality")
    reasons: List[str] = Field(default_factory=list, description="Reasons for selection")
    final_summary: SummaryResponse = Field(..., description="The selected summary")


class SummaryRunRequest(BaseModel):
    """Request to run summarization pipeline."""
    
    user_id: str = Field(..., description="User identifier")
    window_days: int = Field(default=180, ge=1, description="Number of days to analyze")
    top_x: int = Field(default=50, ge=1, description="Top X transactions by absolute amount")
    stratified_n: int = Field(default=80, ge=1, description="Stratified sample size")
    llm_models: List[str] = Field(default_factory=lambda: ["mock:gpt", "mock:claude", "mock:gemini"], 
                                   description="List of LLM model identifiers")
    judge_model: str = Field(default="mock:judge", description="Judge model identifier")
    target_char_budget: int = Field(default=20000, ge=1000, description="Target character budget for sampling")
    as_of: Optional[datetime] = Field(None, description="Reference date for window calculation. If not provided, uses current UTC time. Window is [as_of - window_days, as_of]")


class SamplingStats(BaseModel):
    """Statistics about transaction sampling."""
    
    total_transactions: int
    sampled_count: int
    date_range_start: datetime
    date_range_end: datetime
    top_x_count: int
    stratified_count: int
    recency_count: int


class DebugInfo(BaseModel):
    """Debug information for the summarization run."""
    
    sampling_stats: SamplingStats
    prompt_sizes: Dict[str, int] = Field(default_factory=dict, description="Character counts for prompts")


class SummaryRunResponse(BaseModel):
    """Response from summarization pipeline."""
    
    user_id: str
    daily: JudgeOutput
    monthly: JudgeOutput
    debug: DebugInfo


class UploadResponse(BaseModel):
    """Response from transaction upload."""
    
    user_id: str
    transaction_count: int
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None
    message: str
