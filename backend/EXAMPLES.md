# API Usage Examples

## Quick Start

1. **Start the server:**
```bash
cd backend
uvicorn app.main:app --reload
```

2. **Upload transactions:**
```bash
curl -X POST "http://localhost:8000/transactions/upload?user_id=user123" \
  -F "file=@examples/transactions_sample.json"
```

3. **Run summarization:**
```bash
curl -X POST "http://localhost:8000/summaries/run" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "window_days": 180,
    "top_x": 50,
    "stratified_n": 80,
    "llm_models": ["mock:gpt", "mock:claude", "mock:gemini"],
    "judge_model": "mock:judge",
    "target_char_budget": 20000
  }'
```

4. **Get latest summaries:**
```bash
curl "http://localhost:8000/summaries/latest?user_id=user123"
```

## Using Real LLM Providers

To use real LLM providers instead of mocks, set environment variables and use appropriate model IDs:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

Then use real model IDs in the request:

```json
{
  "user_id": "user123",
  "llm_models": ["gpt-4", "claude-3-opus-20240229", "gemini-pro"],
  "judge_model": "gpt-4"
}
```

## Python Client Example

```python
import requests

BASE_URL = "http://localhost:8000"
USER_ID = "user123"

# Upload transactions
with open("examples/transactions_sample.json", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/transactions/upload",
        params={"user_id": USER_ID},
        files={"file": ("transactions.json", f, "application/json")}
    )
    print(response.json())

# Run summarization
response = requests.post(
    f"{BASE_URL}/summaries/run",
    json={
        "user_id": USER_ID,
        "window_days": 180,
        "top_x": 50,
        "stratified_n": 80,
        "llm_models": ["mock:gpt", "mock:claude", "mock:gemini"],
        "judge_model": "mock:judge",
        "target_char_budget": 20000
    }
)
print(response.json())

# Get latest summaries
response = requests.get(
    f"{BASE_URL}/summaries/latest",
    params={"user_id": USER_ID}
)
print(response.json())
```
