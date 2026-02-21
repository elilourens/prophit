"""Mock LLM adapter for testing without API calls."""
import json
import random
from typing import Dict, Any
from app.adapters.base import LLMAdapter
from app.models.summary import SummaryResponse, JudgeOutput


class MockLLMAdapter(LLMAdapter):
    """Mock LLM adapter that returns deterministic but varied responses."""
    
    # Deterministic responses based on model_id
    MODEL_RESPONSES = {
        "mock:gpt": {
            "key_patterns": [
                "Recurring coffee purchases averaging $5.20",
                "Weekly grocery spending around $120",
                "Subscription services: $45/month"
            ],
            "oddities": [
                "Unusual $500 transaction on 2024-01-20",
                "Missing transaction on typical payday"
            ],
            "predictions": [
                "Expected grocery spend: $110-130 next week",
                "Balance may dip below $500 by month-end"
            ],
            "risk_flags": [
                "Spending rate exceeds income trend",
                "Low balance buffer (less than 2 weeks expenses)"
            ],
            "confidence": 0.85,
            "explanations": [
                "Based on 45-day average spending patterns",
                "Balance trend shows gradual decline"
            ]
        },
        "mock:claude": {
            "key_patterns": [
                "Daily commute expenses: $12-15",
                "Dining out frequency: 3-4 times per week",
                "Utility bills consistent at $180/month"
            ],
            "oddities": [
                "Large purchase category shift in last 7 days",
                "Payment timing anomaly detected"
            ],
            "predictions": [
                "Dining expenses likely to increase 15%",
                "Cash flow positive by mid-month"
            ],
            "risk_flags": [
                "High discretionary spending ratio",
                "Emergency fund below recommended threshold"
            ],
            "confidence": 0.78,
            "explanations": [
                "Pattern analysis over 90-day window",
                "Seasonal adjustment factors applied"
            ]
        },
        "mock:gemini": {
            "key_patterns": [
                "Transportation: $200/month average",
                "Entertainment: $80/month",
                "Healthcare: $150/month"
            ],
            "oddities": [
                "Transaction categorization inconsistency",
                "Weekend spending spike pattern"
            ],
            "predictions": [
                "Transportation costs stable",
                "Entertainment may increase 20%"
            ],
            "risk_flags": [
                "Irregular income pattern",
                "Multiple small overdraft risks"
            ],
            "confidence": 0.72,
            "explanations": [
                "Multi-factor regression analysis",
                "Historical comparison with 6-month baseline"
            ]
        },
        "mock:judge": {
            "preference": "mock:gpt",  # Judge prefers GPT in mock
            "reasons": [
                "Highest confidence score (0.85)",
                "Most specific evidence citations",
                "Clear risk flag explanations"
            ]
        }
    }
    
    async def generate_summary(
        self,
        prompt: str,
        summary_type: str,
        temperature: float = 0.7,
    ) -> SummaryResponse:
        """Generate a mock summary response."""
        model_data = self.MODEL_RESPONSES.get(
            self.model_id,
            self.MODEL_RESPONSES["mock:gpt"]
        )
        
        # Add slight variation based on summary_type
        if summary_type == "monthly":
            # Adjust for monthly context
            predictions = [p.replace("week", "month") for p in model_data["predictions"]]
        else:
            predictions = model_data["predictions"]
        
        return SummaryResponse(
            model_id=self.model_id,
            summary_type=summary_type,
            key_patterns=model_data["key_patterns"],
            oddities=model_data["oddities"],
            predictions=predictions,
            risk_flags=model_data["risk_flags"],
            confidence=model_data["confidence"],
            explanations=model_data["explanations"],
        )
    
    async def judge_summaries(
        self,
        summaries: list[SummaryResponse],
        summary_type: str,
        rubric: str,
    ) -> Dict[str, Any]:
        """Judge summaries and select the best one."""
        if not summaries:
            raise ValueError("No summaries provided for judging")
        
        # In mock mode, prefer the model with highest confidence
        # or use judge preference
        judge_data = self.MODEL_RESPONSES.get("mock:judge", {})
        preferred_model = judge_data.get("preference", "mock:gpt")
        
        # Find preferred summary or fall back to highest confidence
        winning_summary = None
        for summary in summaries:
            if summary.model_id == preferred_model:
                winning_summary = summary
                break
        
        if not winning_summary:
            # Fall back to highest confidence
            winning_summary = max(summaries, key=lambda s: s.confidence)
        
        # Rank by confidence
        ranked = sorted(summaries, key=lambda s: s.confidence, reverse=True)
        ranked_ids = [s.model_id for s in ranked]
        
        reasons = judge_data.get("reasons", [
            f"Selected {winning_summary.model_id} based on confidence score",
            "Evidence-based explanations provided",
            "Clear risk flag identification"
        ])
        
        return {
            "winning_model_id": winning_summary.model_id,
            "ranked_models": ranked_ids,
            "reasons": reasons,
            "final_summary": winning_summary,
        }
