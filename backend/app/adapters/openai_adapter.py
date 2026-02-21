"""OpenAI LLM adapter."""
import json
from typing import Dict, Any
from openai import AsyncOpenAI
from app.adapters.base import LLMAdapter
from app.models.summary import SummaryResponse
from app.config import settings


class OpenAIAdapter(LLMAdapter):
    """OpenAI API adapter."""
    
    def __init__(self, model_id: str = "gpt-4", **kwargs):
        super().__init__(model_id, **kwargs)
        api_key = kwargs.get("api_key") or settings.openai_api_key
        if not api_key:
            raise ValueError("OpenAI API key required")
        self.client = AsyncOpenAI(api_key=api_key)
    
    async def generate_summary(
        self,
        prompt: str,
        summary_type: str,
        temperature: float = 0.7,
    ) -> SummaryResponse:
        """Generate summary using OpenAI API."""
        try:
            response = await self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a financial analysis assistant. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            
            content = response.choices[0].message.content
            data = json.loads(content)
            
            return SummaryResponse(
                model_id=self.model_id,
                summary_type=summary_type,
                key_patterns=data.get("key_patterns", []),
                oddities=data.get("oddities", []),
                predictions=data.get("predictions", []),
                risk_flags=data.get("risk_flags", []),
                confidence=data.get("confidence", 0.5),
                explanations=data.get("explanations", []),
            )
        except Exception as e:
            raise RuntimeError(f"OpenAI API error: {str(e)}")
    
    async def judge_summaries(
        self,
        summaries: list[SummaryResponse],
        summary_type: str,
        rubric: str,
    ) -> Dict[str, Any]:
        """Judge summaries using OpenAI API."""
        summaries_json = [s.model_dump() for s in summaries]
        prompt = f"""{rubric}

Candidate summaries:
{json.dumps(summaries_json, indent=2)}

Return JSON with:
{{
  "winning_model_id": "...",
  "ranked_models": ["..."],
  "reasons": ["..."],
  "final_summary": {{ ... }}
}}"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a judge evaluating financial summaries. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            
            content = response.choices[0].message.content
            data = json.loads(content)
            
            # Reconstruct final_summary
            final_summary_data = data.get("final_summary", {})
            final_summary = SummaryResponse(**final_summary_data)
            
            return {
                "winning_model_id": data.get("winning_model_id", summaries[0].model_id),
                "ranked_models": data.get("ranked_models", []),
                "reasons": data.get("reasons", []),
                "final_summary": final_summary,
            }
        except Exception as e:
            raise RuntimeError(f"OpenAI judge error: {str(e)}")
