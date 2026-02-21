"""Google Gemini LLM adapter."""
import json
from typing import Dict, Any
import google.generativeai as genai
from app.adapters.base import LLMAdapter
from app.models.summary import SummaryResponse
from app.config import settings


class GeminiAdapter(LLMAdapter):
    """Google Gemini API adapter."""
    
    def __init__(self, model_id: str = "gemini-pro", **kwargs):
        super().__init__(model_id, **kwargs)
        api_key = kwargs.get("api_key") or settings.google_api_key
        if not api_key:
            raise ValueError("Google API key required")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_id)
    
    async def generate_summary(
        self,
        prompt: str,
        summary_type: str,
        temperature: float = 0.7,
    ) -> SummaryResponse:
        """Generate summary using Gemini API."""
        try:
            # Note: Gemini async support may vary by version
            # This is a synchronous wrapper for now
            generation_config = genai.types.GenerationConfig(
                temperature=temperature,
            )
            
            full_prompt = f"{prompt}\n\nRespond with valid JSON only."
            response = self.model.generate_content(
                full_prompt,
                generation_config=generation_config,
            )
            
            content = response.text
            # Extract JSON from response
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
            raise RuntimeError(f"Gemini API error: {str(e)}")
    
    async def judge_summaries(
        self,
        summaries: list[SummaryResponse],
        summary_type: str,
        rubric: str,
    ) -> Dict[str, Any]:
        """Judge summaries using Gemini API."""
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
            generation_config = genai.types.GenerationConfig(
                temperature=0.3,
            )
            
            full_prompt = f"{prompt}\n\nRespond with valid JSON only."
            response = self.model.generate_content(
                full_prompt,
                generation_config=generation_config,
            )
            
            content = response.text
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
            raise RuntimeError(f"Gemini judge error: {str(e)}")
