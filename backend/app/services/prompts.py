"""Prompt templates for LLM interactions."""
from typing import Optional, List
from app.models.external import WeatherForecast, HolidayCalendar


class PromptBuilder:
    """Builds prompts for different summary types."""
    
    DAILY_PROMPT_TEMPLATE = """You are a financial analysis assistant. Analyze the provided transaction data and generate a DAILY summary.

INSTRUCTIONS:
- Only use information explicitly provided in the data below
- If you are uncertain about something, state "insufficient evidence"
- Do not make assumptions beyond what the data shows
- Focus on patterns, anomalies, and actionable insights
- Be specific and cite evidence from the data

TRANSACTION DATA:
{transaction_data}

EXTERNAL FACTORS (if available):
{external_factors}

Generate a JSON response with the following structure:
{{
  "key_patterns": ["pattern1", "pattern2", ...],
  "oddities": ["unusual transaction or pattern", ...],
  "predictions": ["prediction for next day", ...],
  
  "confidence": 0.0-1.0,
  
}}

Remember: Only use provided data. If uncertain, say "insufficient evidence"."""

    MONTHLY_PROMPT_TEMPLATE = """You are a financial analysis assistant. Analyze the provided transaction data and generate a MONTHLY summary.

INSTRUCTIONS:
- Only use information explicitly provided in the data below
- If you are uncertain about something, state "insufficient evidence"
- Do not make assumptions beyond what the data shows
- Focus on trends, patterns, and monthly-level insights
- Be specific and cite evidence from the data

TRANSACTION DATA:
{transaction_data}

EXTERNAL FACTORS (if available):
{external_factors}

Generate a JSON response with the following structure:
{{
  "key_patterns": ["pattern1", "pattern2", ...],
  "oddities": ["unusual transaction or pattern", ...],
  "predictions": ["prediction for next month", ...],
  "risk_flags": ["risk indicator", ...],
  "confidence": 0.0-1.0,
  "explanations": ["rationale tied to data evidence", ...]
}}

Remember: Only use provided data. If uncertain, say "insufficient evidence"."""

    THREE_MONTH_INSIGHTS_PROMPT_TEMPLATE = """You are a personal finance analyst assistant. Analyze the user's banking transaction history from the last 3 months to identify recurring behavioral patterns.

INSTRUCTIONS:
- Parse each transaction noting: date, day of week, merchant/category, amount, time of day (if available)
- Only use information explicitly provided in the data below
- If you are uncertain about something, state "insufficient evidence"
- Calculate likelihood as: occurrences ÷ total opportunities × 100

IDENTIFY:
- Day-of-week habits: purchases that happen consistently on specific weekdays
- Weekend vs weekday behavior differences
- Time-based patterns: morning, lunch, evening spending
- Frequency of each pattern relative to opportunity (e.g., 8 out of 12 Mondays)

TRANSACTION DATA:
{transaction_data}

EXTERNAL FACTORS (if available):
{external_factors}

Generate a JSON response with the following structure:
{{
  "weekly_patterns": [
    {{
      "day": "Monday",
      "predicted_behavior": "Coffee at [Merchant]",
      "likelihood_pct": 83,
      "avg_spend": 5.50
    }}
  ],
  "insights": ["insight1", "insight2", "insight3"],
  "confidence": 0.0-1.0
}}

Remember: Only use provided data. If uncertain, say "insufficient evidence"."""

    THREE_MONTH_JUDGE_PROMPT_TEMPLATE = """You are a judge evaluating multiple 3-month behavioral pattern analyses. Select the best analysis based on the following rubric:

RUBRIC:
1. PATTERN ACCURACY: Are identified patterns genuinely recurring and supported by the data?
2. EVIDENCE: Are likelihood percentages and averages correctly calculated?
3. NON-HALLUCINATION: Does the analysis avoid inventing patterns not in the data?
4. ACTIONABLE: Are the insights useful for predicting future spending?
5. SPECIFICITY: Are patterns tied to specific days, merchants, and amounts?

PENALIZE:
- Hallucinated patterns not in the data
- Incorrect likelihood calculations
- Vague patterns without specific evidence
- Overly confident predictions without basis

CANDIDATE ANALYSES:
{summaries_json}

Return JSON with:
{{
  "winning_model_id": "model_id",
  "ranked_models": ["model1", "model2", ...],
  "reasons": ["reason1", "reason2", ...],
  "final_summary": {{
    "model_id": "...",
    "summary_type": "three_month_insights",
    "weekly_patterns": [...],
    "insights": [...],
    "confidence": 0.0-1.0
  }}
}}"""

    JUDGE_PROMPT_TEMPLATE = """You are a judge evaluating multiple financial summaries. Select the best summary based on the following rubric:

RUBRIC:
1. CLARITY: Is the summary clear and easy to understand?
2. EVIDENCE: Are claims backed by specific data evidence?
3. NON-HALLUCINATION: Does the summary avoid making up facts not in the data?
4. ACTIONABLE: Are the insights actionable for the user?
5. SPECIFICITY: Are patterns and predictions specific rather than vague?
6. SAFETY: Does the summary avoid creepy or inappropriate inferences?

PENALIZE:
- Hallucinated facts not in the data
- Vague claims without evidence
- Overly confident predictions without basis
- Inappropriate personal inferences

CANDIDATE SUMMARIES:
{summaries_json}

Return JSON with:
{{
  "winning_model_id": "model_id",
  "ranked_models": ["model1", "model2", ...],
  "reasons": ["reason1", "reason2", ...],
  "final_summary": {{
    "model_id": "...",
    "summary_type": "{summary_type}",
    "key_patterns": [...],
    "oddities": [...],
    "predictions": [...],
    "risk_flags": [...],
    "confidence": 0.0-1.0,
    "explanations": [...]
  }}
}}"""

    def build_daily_prompt(
        self,
        transaction_data: str,
        weather: Optional[List[WeatherForecast]] = None,
        holidays: Optional[List[HolidayCalendar]] = None,
    ) -> str:
        """Build daily summary prompt."""
        external_factors = self._format_external_factors(weather, holidays)
        return self.DAILY_PROMPT_TEMPLATE.format(
            transaction_data=transaction_data,
            external_factors=external_factors or "None provided",
        )
    
    def build_monthly_prompt(
        self,
        transaction_data: str,
        weather: Optional[List[WeatherForecast]] = None,
        holidays: Optional[List[HolidayCalendar]] = None,
    ) -> str:
        """Build monthly summary prompt."""
        external_factors = self._format_external_factors(weather, holidays)
        return self.MONTHLY_PROMPT_TEMPLATE.format(
            transaction_data=transaction_data,
            external_factors=external_factors or "None provided",
        )
    
    def build_three_month_insights_prompt(
        self,
        transaction_data: str,
        weather: Optional[List[WeatherForecast]] = None,
        holidays: Optional[List[HolidayCalendar]] = None,
    ) -> str:
        """Build three-month insights prompt."""
        external_factors = self._format_external_factors(weather, holidays)
        return self.THREE_MONTH_INSIGHTS_PROMPT_TEMPLATE.format(
            transaction_data=transaction_data,
            external_factors=external_factors or "None provided",
        )

    def build_three_month_judge_prompt(
        self,
        summaries_json: str,
    ) -> str:
        """Build three-month judge prompt."""
        return self.THREE_MONTH_JUDGE_PROMPT_TEMPLATE.format(
            summaries_json=summaries_json,
        )

    def build_judge_prompt(
        self,
        summaries_json: str,
        summary_type: str,
    ) -> str:
        """Build judge prompt."""
        return self.JUDGE_PROMPT_TEMPLATE.format(
            summaries_json=summaries_json,
            summary_type=summary_type,
        )
    
    def _format_external_factors(
        self,
        weather: Optional[List[WeatherForecast]],
        holidays: Optional[List[HolidayCalendar]],
    ) -> Optional[str]:
        """Format external factors for prompt."""
        factors = []
        
        if weather:
            factors.append("WEATHER:")
            for w in weather[:7]:  # Last 7 days
                factors.append(f"  {w.date}: {w.temp_c}°C, {w.precip_prob*100:.0f}% chance of precipitation")
        
        if holidays:
            factors.append("HOLIDAYS:")
            for h in holidays:
                factors.append(f"  {h.date}: {h.name}")
        
        return "\n".join(factors) if factors else None
