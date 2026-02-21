"""Crusoe Cloud LLM adapter (OpenAI-compatible endpoint)."""
import json
from typing import Dict, Any
from openai import AsyncOpenAI
from app.adapters.base import LLMAdapter
from app.models.summary import SummaryResponse
from app.config import settings


class CrusoeAdapter(LLMAdapter):
    """Crusoe Cloud API adapter using OpenAI-compatible endpoint."""

    def __init__(self, model_id: str = "crusoe:default", **kwargs):
        super().__init__(model_id, **kwargs)
        api_key = kwargs.get("api_key") or settings.crusoe_api_key
        base_url = kwargs.get("base_url") or settings.crusoe_base_url
        if not api_key:
            raise ValueError("Crusoe API key required. Set CRUSOE_API_KEY in .env")
        if not base_url:
            raise ValueError("Crusoe base URL required. Set CRUSOE_BASE_URL in .env")
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        # Strip "crusoe:" prefix if present to get the actual model name
        if model_id.startswith("crusoe:"):
            self.remote_model = model_id[len("crusoe:"):]
        else:
            self.remote_model = model_id
        # Allow override from settings
        if self.remote_model == "default" and settings.crusoe_model:
            self.remote_model = settings.crusoe_model

    async def generate_summary(
        self,
        prompt: str,
        summary_type: str,
        temperature: float = 0.7,
    ) -> SummaryResponse:
        """Generate summary using Crusoe-hosted model."""
        try:
            response = await self.client.chat.completions.create(
                model=self.remote_model,
                messages=[
                    {"role": "system", "content": "You are a financial analysis assistant. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
            )

            content = response.choices[0].message.content
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
            raise RuntimeError(f"Crusoe API error: {str(e)}")

    async def judge_summaries(
        self,
        summaries: list[SummaryResponse],
        summary_type: str,
        rubric: str,
    ) -> Dict[str, Any]:
        """Judge summaries using Crusoe-hosted model."""
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
                model=self.remote_model,
                messages=[
                    {"role": "system", "content": "You are a judge evaluating financial summaries. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )

            content = response.choices[0].message.content
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
            raise RuntimeError(f"Crusoe judge error: {str(e)}")
