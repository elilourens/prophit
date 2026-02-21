# API Usage Examples

## Quick Start

1. **Start the server:**
```bash
cd backend
uvicorn app.main:app --reload
```

2. **Upload transactions (CSV with Z-suffix timestamps):**
```bash
curl -X POST "http://localhost:8000/transactions/upload?user_id=user123" \
  -F "file=@examples/transactions_sample.csv"
```

**CSV Format Requirements:**
- Required columns: `timestamp`, `amount`, `currency`, `description`
- Optional columns: `category`, `balance_after`
- Timestamp formats supported:
  - ISO with Z: `2024-01-02T09:10:00Z` (recommended)
  - ISO with timezone: `2024-01-02T09:10:00+00:00`
  - ISO without timezone: `2024-01-02T09:10:00`
  - Space-separated: `2024-01-02 09:10:00`

**Example CSV:**
```csv
timestamp,amount,currency,description,category,balance_after
2024-01-01T08:30:00Z,-5.50,USD,STARBUCKS #1234,Food & Dining,1250.50
2024-01-02T09:00:00Z,-120.00,USD,WHOLE FOODS MARKET,Groceries,1084.51
```

3. **Upload transactions (JSON):**
```bash
curl -X POST "http://localhost:8000/transactions/upload?user_id=user123" \
  -F "file=@examples/transactions_sample.json"
```

4. **Upload Open Banking JSON:**
```bash
curl -X POST "http://localhost:8000/transactions/upload/openbanking?user_id=user123" \
  -H "Content-Type: application/json" \
  --data-binary "@data/john.json"
```

**Note:** Open Banking format supports multiple accounts in a single upload. Transactions are automatically normalized and deduplicated.

5. **Run summarization (with as_of for historical data):**
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
    "target_char_budget": 20000,
    "as_of": "2024-01-31T00:00:00Z"
  }'
```

**Note:** The `as_of` parameter allows analyzing historical data. Without it, the window is relative to current time. With `as_of="2024-01-31T00:00:00Z"` and `window_days=30`, the system analyzes transactions from 2024-01-01 to 2024-01-31.

6. **Get latest summaries:**
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
import json

BASE_URL = "http://localhost:8000"
USER_ID = "user123"

# Upload transactions (CSV/JSON)
with open("examples/transactions_sample.json", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/transactions/upload",
        params={"user_id": USER_ID},
        files={"file": ("transactions.json", f, "application/json")}
    )
    print(response.json())

# Upload Open Banking JSON
with open("data/john.json", "r") as f:
    ob_data = json.load(f)
    response = requests.post(
        f"{BASE_URL}/transactions/upload/openbanking",
        params={"user_id": USER_ID},
        json=ob_data
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
