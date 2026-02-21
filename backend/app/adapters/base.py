"""Base LLM adapter interface."""
from abc import ABC, abstractmethod
from typing import Dict, Any
from app.models.summary import SummaryResponse


class LLMAdapter(ABC):
    """Abstract base class for LLM adapters."""
    
    def __init__(self, model_id: str, **kwargs):
        """
        Initialize the adapter.
        
        Args:
            model_id: Identifier for the model (e.g., "gpt-4", "claude-3")
            **kwargs: Additional provider-specific configuration
        """
        self.model_id = model_id
        self.config = kwargs
    
    @abstractmethod
    async def generate_summary(
        self,
        prompt: str,
        summary_type: str,
        temperature: float = 0.7,
    ) -> SummaryResponse:
        """
        Generate a summary from a prompt.
        
        Args:
            prompt: The prompt text
            summary_type: "daily" or "monthly"
            temperature: Sampling temperature
            
        Returns:
            SummaryResponse with structured output
        """
        pass
    
    @abstractmethod
    async def judge_summaries(
        self,
        summaries: list[SummaryResponse],
        summary_type: str,
        rubric: str,
    ) -> Dict[str, Any]:
        """
        Judge multiple summaries and select the best one.
        
        Args:
            summaries: List of candidate summaries
            summary_type: "daily" or "monthly"
            rubric: Judging rubric/instructions
            
        Returns:
            Dictionary with judge output (winning_model_id, ranked_models, reasons, final_summary)
        """
        pass
