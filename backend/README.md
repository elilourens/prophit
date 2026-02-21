# Prophit Finance API

A FastAPI backend for personal finance transaction summarization and prediction using multiple LLM providers with a judge model for selection.

## Features

- **Transaction Ingestion**: Upload CSV or JSON transaction files
- **Smart Sampling**: Multiple strategies (top X, stratified, recency weighting) to fit token budgets
- **Multi-LLM Summarization**: Generate summaries from multiple LLM providers in parallel
- **Judge Selection**: Automatically select the best summary using a judge model
- **Feature Extraction**: Balance health metrics, aggregations, and pattern analysis
- **Privacy-First**: Merchant names obfuscated in logs
- **Modular Architecture**: Clean separation of concerns, testable components

## Architecture

```
app/
├── models/          # Pydantic models for requests/responses
├── adapters/        # LLM adapter interfaces and implementations
├── services/        # Business logic (sampling, features, prompts, summarization, judge)
├── storage/         # SQLite database layer
├── utils/           # Utilities (privacy, token estimation)
└── main.py          # FastAPI application
```

## Local Setup

**Recommended: Use a virtual environment**

```bash
# Create virtual environment
python3.11 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Dependency Conflicts with Ollama**

The `ollama` package requires:
- `httpx >=0.27,<0.29`
- `pydantic >=2.9,<3`

However, the base `requirements.txt` uses:
- `httpx==0.25.2`
- `pydantic==2.5.0`

These versions are incompatible. **Do NOT install `ollama` in the same virtual environment as the base requirements** unless you use the ollama-specific requirements file.

If you need ollama support:
```bash
# Use the ollama-compatible requirements instead
pip install -r requirements-ollama.txt
```

**Note:** The base `requirements.txt` is tested and works with FastAPI. Only use `requirements-ollama.txt` if you specifically need ollama integration.

## Setup

1. **Install dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Set environment variables (optional, for real LLM providers):**
```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
```

3. **Run the server:**
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## API Endpoints

### 1. Upload Transactions

**POST** `/transactions/upload`

Upload transactions from CSV or JSON file.

**Query Parameters:**
- `user_id` (required): User identifier

**Request:**
- File upload (CSV or JSON)

**CSV Format:**
- Required columns: `timestamp`, `amount`, `currency`, `description`
- Optional columns: `category`, `balance_after`
- Accepted timestamp formats:
  - ISO with Z: `2024-01-02T09:10:00Z` (recommended)
  - ISO with timezone: `2024-01-02T09:10:00+00:00`
  - ISO without timezone: `2024-01-02T09:10:00`
  - Space-separated: `2024-01-02 09:10:00`

**JSON Format:**
- Array of transaction objects with same fields as CSV
- Timestamp formats same as CSV

**Example (curl - CSV):**
```bash
curl -X POST "http://localhost:8000/transactions/upload?user_id=user123" \
  -F "file=@examples/transactions_sample.csv"
```

**Example (curl - JSON):**
```bash
curl -X POST "http://localhost:8000/transactions/upload?user_id=user123" \
  -F "file=@examples/transactions_sample.json"
```

**Response:**
```json
{
  "user_id": "user123",
  "transaction_count": 15,
  "date_range_start": "2024-01-01T08:30:00Z",
  "date_range_end": "2024-01-11T12:00:00Z",
  "message": "Successfully uploaded 15 transactions"
}
```

### 2. Run Summarization

**POST** `/summaries/run`

Run the full summarization pipeline.

**Request Body:**
```json
{
  "user_id": "user123",
  "window_days": 180,
  "top_x": 50,
  "stratified_n": 80,
  "llm_models": ["mock:gpt", "mock:claude", "mock:gemini"],
  "judge_model": "mock:judge",
  "target_char_budget": 20000,
  "as_of": "2024-01-31T00:00:00Z"
}
```

**Parameters:**
- `user_id` (required): User identifier
- `window_days` (optional, default: 180): Number of days to analyze
- `top_x` (optional, default: 50): Top X transactions by absolute amount
- `stratified_n` (optional, default: 80): Stratified sample size
- `llm_models` (optional): List of LLM model identifiers
- `judge_model` (optional, default: "mock:judge"): Judge model identifier
- `target_char_budget` (optional, default: 20000): Target character budget for sampling
- `as_of` (optional): Reference date for window calculation in ISO format. If not provided, uses current UTC time. The window is calculated as `[as_of - window_days, as_of]`. Useful for testing with historical data.

**Example (curl - with as_of for historical data):**
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

**Note:** The `as_of` parameter allows you to analyze historical data by specifying a reference date. Without it, the window is calculated relative to the current time, which may exclude old transaction data.

**Response:**
```json
{
  "user_id": "user123",
  "daily": {
    "winning_model_id": "mock:gpt",
    "ranked_models": ["mock:gpt", "mock:claude", "mock:gemini"],
    "reasons": ["Highest confidence score", "Most specific evidence"],
    "final_summary": {
      "model_id": "mock:gpt",
      "summary_type": "daily",
      "key_patterns": [...],
      "oddities": [...],
      "predictions": [...],
      "risk_flags": [...],
      "confidence": 0.85,
      "explanations": [...]
    }
  },
  "monthly": { ... },
  "debug": {
    "sampling_stats": { ... },
    "prompt_sizes": { ... }
  }
}
```

### 3. Get Latest Summaries

**GET** `/summaries/latest?user_id=user123`

Get the most recently generated summaries for a user.

**Example (curl):**
```bash
curl "http://localhost:8000/summaries/latest?user_id=user123"
```

## LLM Adapters

The system supports multiple LLM providers through adapters:

- **MockLLM**: For testing without API calls (default)
- **OpenAI**: GPT models (use `gpt-4`, `gpt-3.5-turbo`, etc.)
- **Anthropic**: Claude models (use `claude-3-opus-20240229`, etc.)
- **Gemini**: Google models (use `gemini-pro`, etc.)

To use real providers, set the appropriate API keys in environment variables and use the model IDs in `llm_models` and `judge_model`.

## Testing

Run tests with pytest:

```bash
pytest
```

Test coverage includes:
- Transaction sampling strategies
- Judge selection logic
- API endpoints

## Example Data

Sample transaction files are provided in `examples/`:
- `transactions_sample.json`
- `transactions_sample.csv`

## Data Privacy

- Merchant names are automatically obfuscated in logs
- No raw personal data is logged
- All transaction data is stored locally in SQLite

## Configuration

Configuration is managed through `app/config.py` and environment variables. See `.env.example` for available settings.

## License

MIT
