"""Anthropic Claude LLM adapter."""
import json
from typing import Dict, Any
from anthropic import AsyncAnthropic
from app.adapters.base import LLMAdapter
from app.models.summary import SummaryResponse
from app.config import settings


class AnthropicAdapter(LLMAdapter):
    """Anthropic Claude API adapter."""
    
    def __init__(self, model_id: str = "claude-3-opus-20240229", **kwargs):
        super().__init__(model_id, **kwargs)
        api_key = kwargs.get("api_key") or settings.anthropic_api_key
        if not api_key:
            raise ValueError("Anthropic API key required")
        self.client = AsyncAnthropic(api_key=api_key)
    
    async def generate_summary(
        self,
        prompt: str,
        summary_type: str,
        temperature: float = 0.7,
    ) -> SummaryResponse:
        """Generate summary using Anthropic API."""
        try:
            response = await self.client.messages.create(
                model=self.model_id,
                max_tokens=2000,
                temperature=temperature,
                messages=[
                    {"role": "user", "content": f"{prompt}\n\nRespond with valid JSON only."}
                ],
            )
            
            content = response.content[0].text
            # Extract JSON from response (may have markdown code blocks)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
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
            raise RuntimeError(f"Anthropic API error: {str(e)}")
    
    async def judge_summaries(
        self,
        summaries: list[SummaryResponse],
        summary_type: str,
        rubric: str,
    ) -> Dict[str, Any]:
        """Judge summaries using Anthropic API."""
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
            response = await self.client.messages.create(
                model=self.model_id,
                max_tokens=2000,
                temperature=0.3,
                messages=[
                    {"role": "user", "content": f"{prompt}\n\nRespond with valid JSON only."}
                ],
            )
            
            content = response.content[0].text
            # Extract JSON from response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
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
            raise RuntimeError(f"Anthropic judge error: {str(e)}")
