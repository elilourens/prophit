"""Token estimation utilities."""
def estimate_tokens(text: str) -> int:
    """
    Rough token estimation: ~4 characters per token for English text.
    This is a simple heuristic; actual tokenization varies by model.
    """
    return len(text) // 4
