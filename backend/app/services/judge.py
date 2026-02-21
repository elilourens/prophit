"""Judge service for selecting best summaries."""
import json
from typing import List
from app.adapters.factory import get_llm_adapter
from app.models.summary import SummaryResponse, JudgeOutput
from app.services.prompts import PromptBuilder


class JudgeService:
    """Service for judging and selecting best summaries."""
    
    def __init__(self):
        self.prompt_builder = PromptBuilder()
    
    async def judge_summaries(
        self,
        summaries: List[SummaryResponse],
        summary_type: str,
        judge_model_id: str,
    ) -> JudgeOutput:
        """
        Judge summaries and select the best one.
        
        Args:
            summaries: List of candidate summaries
            summary_type: "daily" or "monthly"
            judge_model_id: Model identifier for judging
            
        Returns:
            JudgeOutput with selected summary
        """
        if not summaries:
            raise ValueError("No summaries to judge")
        
        if len(summaries) == 1:
            # Single summary, no need to judge
            return JudgeOutput(
                winning_model_id=summaries[0].model_id,
                ranked_models=[summaries[0].model_id],
                reasons=["Only one summary provided"],
                final_summary=summaries[0],
            )
        
        # Build judge prompt
        summaries_json = json.dumps([s.model_dump() for s in summaries], indent=2)
        rubric = self.prompt_builder.build_judge_prompt(summaries_json, summary_type)
        
        # Get judge adapter
        judge_adapter = get_llm_adapter(judge_model_id)
        
        # Get judge output
        judge_result = await judge_adapter.judge_summaries(
            summaries,
            summary_type,
            rubric,
        )
        
        # Convert to JudgeOutput
        return JudgeOutput(
            winning_model_id=judge_result["winning_model_id"],
            ranked_models=judge_result["ranked_models"],
            reasons=judge_result["reasons"],
            final_summary=judge_result["final_summary"],
        )
