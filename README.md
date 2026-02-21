# Prophit

A multi-LLM financial transaction analyzer that uses Claude, Gemini, and OpenAI to identify spending patterns and predict future behavior.

## Project Structure

```
prophit/
├── test-backend/          # FastAPI + Gradio application
│   ├── main.py           # REST API server
│   ├── ui.py             # Web UI interface
│   ├── requirements.txt   # Python dependencies
│   └── .env              # API keys (not committed)
├── backend/
│   └── data/             # Sample transaction data
└── README.md             # This file
```

## Features

- **Multi-LLM Analysis**: Run transactions through Claude (Anthropic), Gemini (Google), and OpenAI simultaneously
- **Pattern Recognition**: Automatically identify recurring spending behaviors by day of week
- **Week-Ahead Calendar**: Claude combines predictions from all three models into a consolidated calendar
- **File Format Support**: JSON, PDF, CSV, and plain text files
- **Web UI**: Gradio-based interface for easy interaction
- **REST API**: FastAPI endpoints for programmatic access

## Test Backend Setup

### Prerequisites

- Python 3.8+
- API keys for:
  - [Anthropic](https://console.anthropic.com) (Claude)
  - [Google AI Studio](https://aistudio.google.com) (Gemini)
  - [OpenAI](https://platform.openai.com) (OpenAI)

### Installation

1. **Create Virtual Environment**
   ```bash
   cd test-backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure API Keys**

   Create a `.env` file in `test-backend/`:
   ```bash
   ANTHROPIC_API_KEY=your_anthropic_key_here
   GEMINI_API_KEY=your_gemini_key_here
   OPENAI_API_KEY=your_openai_key_here
   ```

   **⚠️ Important**: Never commit `.env` to version control (already in `.gitignore`)

### Running the Application

#### Option 1: REST API Server (FastAPI)

```bash
cd test-backend
uvicorn main:app --reload --port 8001
```

- API: http://localhost:8001
- Interactive docs: http://localhost:8001/docs

#### Option 2: Web UI (Gradio)

```bash
cd test-backend
python ui.py
```

- Web UI: http://localhost:8003

## API Endpoints

### Health Check
```
GET /
```
Returns status of all configured providers.

### Analyze Uploaded File
```
POST /analyse
```
Upload a file (JSON, PDF, CSV, or TXT) for analysis.

### Analyze Local File
```
POST /analyse-local?filename=john.json
```
Analyze a JSON file from `backend/data/`

## Data Format

### Input
Transactions should include:
```json
{
  "statements": [
    {
      "transactions": [
        {
          "transaction_id": "txn_123",
          "timestamp": "2026-02-18T12:00:00Z",
          "description": "COFFEE SHOP",
          "amount": 5.50,
          "currency": "GBP",
          "transaction_type": "DEBIT",
          "transaction_category": "FOOD"
        }
      ]
    }
  ]
}
```

The backend automatically enriches this with `day_of_week` field.

### Output (Calendar)
```json
{
  "week_start": "2026-02-22",
  "daily_predictions": [
    {
      "date": "2026-02-23",
      "day": "Monday",
      "predictions": [
        {
          "behavior": "Coffee at Starbucks",
          "likelihood": 83,
          "avg_spend": 5.50,
          "agreed_by": ["claude", "openai"]
        }
      ]
    }
  ]
}
```

## Configuration

Key settings in `main.py`:
- `MAX_TRANSACTIONS`: 200 (transactions per statement)
- `MAX_LINES`: 4000 (lines for non-JSON files)
- Models: Claude Haiku 4.5, Gemini 2.5 Flash Lite, GPT-4o Mini

## How It Works

1. **Input Processing**: Files parsed → transactions enriched with day-of-week
2. **Parallel Analysis**: All three LLMs analyze simultaneously
3. **Pattern Detection**: Each model identifies recurring spending patterns
4. **Calendar Generation**: Claude combines predictions into unified week-ahead calendar
5. **Deduplication**: Removes duplicate merchants, keeps most accurate predictions

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API key not set | Create `.env` with valid keys in `test-backend/` |
| File not found | Place files in `backend/data/` for local analysis |
| JSON parse error | Ensure transactions include `timestamp`, `description`, `amount` |
| Import errors | Run from `test-backend/` directory |

## hackeurope Submission

Risk & Reward
