"""Factory for creating LLM adapters."""
from app.adapters.base import LLMAdapter
from app.adapters.mock import MockLLMAdapter
from app.adapters.openai_adapter import OpenAIAdapter
from app.adapters.anthropic_adapter import AnthropicAdapter
from app.adapters.gemini_adapter import GeminiAdapter
from app.adapters.crusoe_adapter import CrusoeAdapter


def get_llm_adapter(model_id: str, **kwargs) -> LLMAdapter:
    """
    Factory function to create appropriate LLM adapter based on model_id.

    Args:
        model_id: Model identifier (e.g., "mock:gpt", "gpt-4", "claude-3-opus-20240229", "gemini-pro", "crusoe:llama3")
        **kwargs: Additional configuration for the adapter

    Returns:
        LLMAdapter instance
    """
    if model_id.startswith("mock:"):
        return MockLLMAdapter(model_id, **kwargs)
    elif model_id.startswith("crusoe:") or "crusoe" in model_id.lower():
        return CrusoeAdapter(model_id, **kwargs)
    elif model_id.startswith("gpt-") or model_id.startswith("o1-") or "openai" in model_id.lower():
        return OpenAIAdapter(model_id, **kwargs)
    elif "claude" in model_id.lower() or "anthropic" in model_id.lower():
        return AnthropicAdapter(model_id, **kwargs)
    elif "gemini" in model_id.lower() or "google" in model_id.lower():
        return GeminiAdapter(model_id, **kwargs)
    else:
        # Default to mock for unknown models
        return MockLLMAdapter(f"mock:{model_id}", **kwargs)
