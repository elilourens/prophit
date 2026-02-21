"""Tests for judge selection."""
import pytest
from app.models.summary import SummaryResponse
from app.services.judge import JudgeService
from app.adapters.mock import MockLLMAdapter


@pytest.fixture
def sample_summaries():
    """Generate sample summaries for testing."""
    return [
        SummaryResponse(
            model_id="mock:gpt",
            summary_type="daily",
            key_patterns=["Pattern 1", "Pattern 2"],
            oddities=["Oddity 1"],
            predictions=["Prediction 1"],
            risk_flags=["Risk 1"],
            confidence=0.85,
            explanations=["Explanation 1"],
        ),
        SummaryResponse(
            model_id="mock:claude",
            summary_type="daily",
            key_patterns=["Pattern 3"],
            oddities=["Oddity 2"],
            predictions=["Prediction 2"],
            risk_flags=["Risk 2"],
            confidence=0.78,
            explanations=["Explanation 2"],
        ),
        SummaryResponse(
            model_id="mock:gemini",
            summary_type="daily",
            key_patterns=["Pattern 4"],
            oddities=["Oddity 3"],
            predictions=["Prediction 3"],
            risk_flags=["Risk 3"],
            confidence=0.72,
            explanations=["Explanation 3"],
        ),
    ]


@pytest.mark.asyncio
async def test_judge_selection(sample_summaries):
    """Test judge selects best summary."""
    judge_service = JudgeService()
    
    result = await judge_service.judge_summaries(
        sample_summaries,
        "daily",
        "mock:judge",
    )
    
    assert result.winning_model_id in [s.model_id for s in sample_summaries]
    assert len(result.ranked_models) == len(sample_summaries)
    assert len(result.reasons) > 0
    assert result.final_summary.model_id == result.winning_model_id


@pytest.mark.asyncio
async def test_judge_single_summary():
    """Test judge with single summary."""
    judge_service = JudgeService()
    
    single_summary = SummaryResponse(
        model_id="mock:gpt",
        summary_type="daily",
        key_patterns=["Pattern"],
        oddities=[],
        predictions=[],
        risk_flags=[],
        confidence=0.8,
        explanations=[],
    )
    
    result = await judge_service.judge_summaries(
        [single_summary],
        "daily",
        "mock:judge",
    )
    
    assert result.winning_model_id == "mock:gpt"
    assert len(result.ranked_models) == 1


@pytest.mark.asyncio
async def test_judge_empty_summaries():
    """Test judge with empty summaries raises error."""
    judge_service = JudgeService()
    
    with pytest.raises(ValueError):
        await judge_service.judge_summaries([], "daily", "mock:judge")
