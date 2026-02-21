"""Summarization service orchestrating multi-LLM execution."""
import asyncio
from typing import List
from app.adapters.factory import get_llm_adapter
from app.models.summary import SummaryResponse
from app.services.prompts import PromptBuilder


class SummarizationService:
    """Service for generating summaries from multiple LLMs."""
    
    def __init__(self):
        self.prompt_builder = PromptBuilder()
    
    async def generate_summaries(
        self,
        prompt: str,
        summary_type: str,
        llm_model_ids: List[str],
    ) -> List[SummaryResponse]:
        """
        Generate summaries from multiple LLMs in parallel.
        
        Args:
            prompt: The prompt text
            summary_type: "daily" or "monthly"
            llm_model_ids: List of model identifiers
            
        Returns:
            List of SummaryResponse from each model
        """
        async def generate_one(model_id: str) -> SummaryResponse:
            """Generate summary from one model."""
            adapter = get_llm_adapter(model_id)
            return await adapter.generate_summary(prompt, summary_type)
        
        # Run all LLM calls in parallel
        tasks = [generate_one(model_id) for model_id in llm_model_ids]
        summaries = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        valid_summaries = []
        for result in summaries:
            if isinstance(result, Exception):
                # Log error but continue
                print(f"Error generating summary: {result}")
            else:
                valid_summaries.append(result)
        
        return valid_summaries
