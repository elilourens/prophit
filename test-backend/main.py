"""
Test backend — Ingest a JSON file and send it to multiple LLM providers.

Providers:
  1. Claude (Anthropic)
  2. Gemini (Google)
  3. Groq

Run:
  uvicorn main:app --reload --port 8002
"""

import csv
import io
import json
import os
from datetime import date, datetime, timedelta
from pathlib import Path

import anthropic
import pdfplumber
from google import genai
from openai import OpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SYSTEM_PROMPT = """\
You are a personal finance analyst. Analyze the user's banking transaction history to identify recurring behavioral patterns.

CRITICAL ACCURACY RULES:
- Use the "day_of_week" field in each transaction to determine the day. NEVER calculate or guess the day yourself.
- Only include a pattern if the same behavior at the same merchant appears on that weekday at least TWICE in the data.
- Do NOT hallucinate, invent, or assume patterns that don't explicitly exist in the data.
- One-off transactions are not patterns — ignore them completely.
- Every behavior you list must be directly verifiable by counting occurrences in the provided data.

Output ONLY a markdown table with 2-3 predicted behaviors per weekday (Monday through Sunday). No explanations, no headings, no other text — just the table.

| Day | Predicted Behavior | Likelihood | Avg. Spend |
|-----|-------------------|------------|------------|
| Monday | Coffee at [Merchant] | 83% | $5.50 |
| Monday | Gym supplement purchase | 58% | $12.00 |
| Tuesday | Lunch at [Merchant] | 75% | $14.00 |
| Tuesday | Evening grocery run | 50% | $35.00 |
| ... | ... | ... | ... |

Likelihood = occurrences / total opportunities x 100. Use the actual merchant names from the data.
"""

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Prophit — Multi-LLM Test Backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_TRANSACTIONS = 200
MAX_LINES = 4000


def trim_transactions(data: dict) -> dict:
    """Keep only the last MAX_TRANSACTIONS per account."""
    for statement in data.get("statements", []):
        txns = statement.get("transactions", [])
        if len(txns) > MAX_TRANSACTIONS:
            statement["transactions"] = txns[-MAX_TRANSACTIONS:]
    return data


def enrich_transactions_with_weekday(data: dict) -> dict:
    """Add day_of_week field to each transaction based on timestamp."""
    for statement in data.get("statements", []):
        for txn in statement.get("transactions", []):
            if "timestamp" in txn:
                try:
                    dt = datetime.fromisoformat(txn["timestamp"].replace("Z", "+00:00"))
                    txn["day_of_week"] = dt.strftime("%A")
                except (ValueError, AttributeError):
                    pass
    return data


def _extract_pdf(raw_bytes: bytes) -> str:
    """Extract all text from a PDF file."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_csv(raw_bytes: bytes) -> str:
    """Convert CSV to a readable text table."""
    text = raw_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return text
    # Format as markdown table for LLM readability
    header = rows[0]
    lines = ["| " + " | ".join(header) + " |"]
    lines.append("| " + " | ".join("---" for _ in header) + " |")
    for row in rows[1:MAX_LINES]:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def prepare_input(raw_bytes: bytes, filename: str) -> str:
    """Parse input: supports JSON, PDF, CSV, and plain text files."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        text = _extract_pdf(raw_bytes)
        lines = text.splitlines()
        if len(lines) > MAX_LINES:
            lines = lines[:MAX_LINES]
        return "\n".join(lines)

    if ext == "json":
        text = raw_bytes.decode("utf-8", errors="replace")
        data = json.loads(text)
        data = trim_transactions(data)
        data = enrich_transactions_with_weekday(data)
        return json.dumps(data, indent=2)

    if ext == "csv":
        return _extract_csv(raw_bytes)

    # Plain text fallback (txt, etc): cap at MAX_LINES lines
    text = raw_bytes.decode("utf-8", errors="replace")
    lines = text.splitlines()
    if len(lines) > MAX_LINES:
        lines = lines[:MAX_LINES]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# LLM provider functions
# ---------------------------------------------------------------------------

async def ask_claude(data_str: str) -> str:
    """Send data to Claude and return the response."""
    if not ANTHROPIC_API_KEY:
        return "[SKIPPED] ANTHROPIC_API_KEY not set"

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": data_str}],
        )
        return message.content[0].text
    except Exception as e:
        return f"[ERROR] Claude failed: {e}"


async def ask_gemini(data_str: str) -> str:
    """Send data to Gemini and return the response."""
    if not GEMINI_API_KEY:
        return "[SKIPPED] GEMINI_API_KEY not set"

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=f"{SYSTEM_PROMPT}\n\n{data_str}",
        )
        return response.text
    except Exception as e:
        return f"[ERROR] Gemini failed: {e}"


async def ask_openai(data_str: str) -> str:
    """Send data to OpenAI and return the response."""
    if not OPENAI_API_KEY:
        return "[SKIPPED] OPENAI_API_KEY not set"

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": data_str},
            ],
            max_tokens=1024,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[ERROR] OpenAI failed: {e}"


CALENDAR_PROMPT = """\
You are a spending prediction engine. You are given:
1. The user's RAW transaction history
2. Prediction tables from multiple AI models that analysed that same history

Your job: combine the model predictions into a single week-ahead calendar (next 7 days starting from {start_date}), using the raw transaction data to verify and refine.

Rules:
- Predictions that AGREE across multiple models get boosted confidence.
- Cross-check predictions against the raw data: verify merchant names, amounts, and frequency are accurate.
- If both models missed an obvious pattern visible in the raw data, add it.
- If a prediction contradicts the raw data (wrong merchant, inflated frequency), correct or drop it.
- Pick 2-3 predictions per day, prioritising ones that appear in more than one model's output.
- DEDUPLICATION: Do NOT list the same merchant/behavior twice on the same day. If a merchant appears multiple times, consolidate into ONE entry with the highest likelihood and most accurate avg spend.
- Output ONLY raw JSON with NO markdown code fences (no ```json, no ```), NO explanations, NO additional text.

JSON format:
{{
  "week_start": "{start_date}",
  "daily_predictions": [
    {{
      "date": "YYYY-MM-DD",
      "day": "Monday",
      "predictions": [
        {{
          "behavior": "Coffee at Starbucks",
          "likelihood": 85,
          "avg_spend": 5.50,
          "agreed_by": ["claude", "gemini"]
        }}
      ]
    }}
  ]
}}
"""


async def ask_claude_calendar(data_str: str, claude_result: str, gemini_result: str, openai_result: str) -> str:
    """Send raw data + combined provider results to Claude to build a week-ahead calendar."""
    if not ANTHROPIC_API_KEY:
        return "[SKIPPED] ANTHROPIC_API_KEY not set"

    start = date.today() + timedelta(days=1)
    start_date = start.isoformat()

    prompt = CALENDAR_PROMPT.format(start_date=start_date)

    combined = (
        "=== Raw Transaction Data ===\n" + data_str + "\n\n"
        "=== Claude predictions ===\n" + claude_result + "\n\n"
        "=== Gemini predictions ===\n" + gemini_result + "\n\n"
        "=== OpenAI predictions ===\n" + openai_result
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": f"{prompt}\n\n{combined}"}],
        )
        return message.content[0].text
    except Exception as e:
        return f"[ERROR] Claude calendar failed: {e}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
async def health():
    return {
        "status": "ok",
        "providers": {
            "claude": "ready" if ANTHROPIC_API_KEY else "no key",
            "gemini": "ready" if GEMINI_API_KEY else "no key",
            "openai": "ready" if OPENAI_API_KEY else "no key",
        },
    }


@app.post("/analyse", tags=["llm"])
async def analyse(file: UploadFile = File(...)):
    """
    Upload a file and send it to all configured LLM providers.
    Supports JSON and plain text files (txt capped at 1000 lines).
    """
    raw = await file.read()
    try:
        data_str = prepare_input(raw, file.filename)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid file: {e}")

    # --- Fan out to each provider ---
    claude_response = await ask_claude(data_str)
    gemini_response = await ask_gemini(data_str)
    openai_response = await ask_openai(data_str)

    # --- Print to console for quick debugging ---
    print("\n" + "=" * 60)
    print("CLAUDE RESPONSE:")
    print("-" * 60)
    print(claude_response)
    print("\n" + "=" * 60)
    print("GEMINI RESPONSE:")
    print("-" * 60)
    print(gemini_response)
    print("\n" + "=" * 60)
    print("OPENAI RESPONSE:")
    print("-" * 60)
    print(openai_response)
    print("=" * 60 + "\n")

    return _render_results(file.filename, claude_response, gemini_response, openai_response)


@app.post("/analyse-local", tags=["llm"])
async def analyse_local(filename: str = "john.json"):
    """
    Analyse a JSON file already saved in ../backend/data/.
    Handy for testing without uploading.
    """
    filepath = Path(__file__).parent.parent / "backend" / "data" / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filepath}")

    with open(filepath) as f:
        data = json.load(f)

    data = trim_transactions(data)
    data = enrich_transactions_with_weekday(data)
    data_str = json.dumps(data, indent=2)

    claude_response = await ask_claude(data_str)
    gemini_response = await ask_gemini(data_str)
    openai_response = await ask_openai(data_str)

    print("\n" + "=" * 60)
    print("CLAUDE RESPONSE:")
    print("-" * 60)
    print(claude_response)
    print("\n" + "=" * 60)
    print("GEMINI RESPONSE:")
    print("-" * 60)
    print(gemini_response)
    print("\n" + "=" * 60)
    print("OPENAI RESPONSE:")
    print("-" * 60)
    print(openai_response)
    print("=" * 60 + "\n")

    return _render_results(filename, claude_response, gemini_response, openai_response)


@app.post("/budget-tips", tags=["budget"])
async def budget_tips(text: str):
    """
    Get budget-friendly tips based on predicted spending patterns.

    Pass predicted spending as a query parameter or in request body.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Provide spending predictions as text")

    tips = await get_budget_tips(text)
    return {"tips": tips}


async def get_budget_tips(predictions: str) -> str:
    """Send predicted expenditure to OpenAI and get budget-friendly tips."""
    if not OPENAI_API_KEY:
        return "[SKIPPED] OPENAI_API_KEY not set"

    prompt = f"""Based on the following predicted spending patterns, provide 2-3 concise, actionable budget tips to save money. Keep each tip to 1 sentence. Focus on practical changes.

Predicted Spending:
{predictions}

Tips:"""

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[ERROR] Budget tips failed: {e}"


@app.post("/financial-summary", tags=["budget"])
async def financial_summary_from_file(file: UploadFile = File(...)):
    """
    Generate a financial summary (savings, rent, groceries, etc.) from transaction data.

    Upload a JSON, CSV, or PDF file; the LLM extracts figures suitable for the income-runway flow.
    """
    raw = await file.read()
    try:
        data_str = prepare_input(raw, file.filename or "file")
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid file: {e}")

    summary = await generate_financial_summary(data_str)
    return {"summary": summary}


async def generate_financial_summary(transaction_data: str) -> str:
    """Use OpenAI to extract a financial summary from transaction data for income-runway use."""
    if not OPENAI_API_KEY:
        return "[SKIPPED] OPENAI_API_KEY not set"

    prompt = """Analyze this transaction/banking data and produce a short financial summary that could be used to estimate "how long I can go without income."

Include, in plain text and in 4–8 short lines:
- Estimated savings or current balance (if visible in the data; otherwise say "savings/balance not clear from data").
- Monthly rent or mortgage (recurring housing).
- Monthly groceries and food.
- Other recurring monthly expenses (subscriptions, utilities, transport, etc.) with a brief total or breakdown.
- Any recurring income (salary, side income) if visible.

Write it as a single block of text that someone could paste into a "financial summary" field. No bullet symbols needed if you use line breaks. Be concise and use approximate numbers where exact ones aren't clear."""

    full_content = f"{prompt}\n\nTransaction data:\n{transaction_data[:30000]}"

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": full_content}],
            max_tokens=400,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[ERROR] Financial summary failed: {e}"


@app.post("/income-runway", tags=["budget"])
async def income_runway(text: str):
    """
    Estimate how long the user can go without any new income, based on savings and expenses.

    Pass a financial summary as text (e.g. savings, monthly expenses, other income).
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Provide a financial summary (savings, expenses) as text")

    result = await get_income_runway(text)
    return {"runway": result}


async def get_income_runway(financial_summary: str) -> str:
    """Use OpenAI to estimate runway (months without income) from a financial summary."""
    if not OPENAI_API_KEY:
        return "[SKIPPED] OPENAI_API_KEY not set"

    prompt = f"""Based on the following financial summary, estimate how long this person can go without any new income (runway). Consider savings, liquid assets, monthly expenses, and any recurring income they mentioned.

Financial Summary:
{financial_summary}

Respond in 2-4 short sentences: give the estimated runway (e.g. "About X months" or "Roughly Y months"), and one brief note on what would help extend it or what the main risk is. Be concise."""

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.5,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[ERROR] Income runway failed: {e}"


def _render_results(filename: str, claude: str, gemini: str, openai: str) -> HTMLResponse:
    """Render LLM responses as a readable HTML page with markdown rendering."""
    import html
    claude_escaped = html.escape(claude)
    gemini_escaped = html.escape(gemini)
    openai_escaped = html.escape(openai)

    page = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Prophit — Analysis: {html.escape(filename)}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0d1117; color: #c9d1d9; padding: 2rem; }}
    h1 {{ color: #58a6ff; margin-bottom: 0.5rem; }}
    .subtitle {{ color: #8b949e; margin-bottom: 2rem; }}
    .providers {{ display: flex; gap: 1.5rem; flex-wrap: wrap; }}
    .provider {{ flex: 1; min-width: 300px; background: #161b22;
                 border: 1px solid #30363d; border-radius: 8px; padding: 1.5rem; }}
    .provider h2 {{ color: #58a6ff; border-bottom: 1px solid #30363d;
                    padding-bottom: 0.5rem; margin-bottom: 1rem; }}
    .provider.claude h2 {{ color: #d2a8ff; }}
    .provider.gemini h2 {{ color: #7ee787; }}
    .provider.openai h2 {{ color: #10a981; }}
    .content {{ line-height: 1.6; }}
    .content table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; }}
    .content th, .content td {{ border: 1px solid #30363d; padding: 8px 12px; text-align: left; }}
    .content th {{ background: #21262d; color: #58a6ff; }}
    .content h3 {{ color: #c9d1d9; margin-top: 1.5rem; margin-bottom: 0.5rem; }}
    .content strong {{ color: #f0f6fc; }}
    .content ul, .content ol {{ padding-left: 1.5rem; margin: 0.5rem 0; }}
    .content hr {{ border: none; border-top: 1px solid #30363d; margin: 1.5rem 0; }}
  </style>
</head>
<body>
  <h1>Prophit Analysis</h1>
  <p class="subtitle">File: {html.escape(filename)}</p>
  <div class="providers">
    <div class="provider claude">
      <h2>Claude (Haiku 4.5)</h2>
      <div class="content" id="claude"></div>
    </div>
    <div class="provider gemini">
      <h2>Gemini (2.5 Flash Lite)</h2>
      <div class="content" id="gemini"></div>
    </div>
    <div class="provider openai">
      <h2>OpenAI (GPT-4o Mini)</h2>
      <div class="content" id="openai"></div>
    </div>
  </div>
  <script>
    const raw = {{
      claude: `{claude_escaped}`,
      gemini: `{gemini_escaped}`,
      openai: `{openai_escaped}`,
    }};
    document.getElementById('claude').innerHTML = marked.parse(raw.claude);
    document.getElementById('gemini').innerHTML = marked.parse(raw.gemini);
    document.getElementById('openai').innerHTML = marked.parse(raw.openai);
  </script>
</body>
</html>"""
    return HTMLResponse(content=page)
