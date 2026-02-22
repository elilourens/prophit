"""
Test backend — Ingest a JSON file and send it to multiple LLM providers.

Providers:
  1. Claude (Anthropic)
  2. Gemini (Google)
  3. Groq

Run:
  uvicorn main:app --reload --port 8002
"""

import asyncio
import csv
import io
import json
import logging
import os
from datetime import date, datetime, timedelta

logger = logging.getLogger(__name__)
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
# Logging: structured terminal output for week-ahead context debugging
# ---------------------------------------------------------------------------
_STANDARD_LOG_RECORD_KEYS = frozenset(
    (
        "name", "msg", "args", "created", "filename", "funcName", "levelname", "levelno",
        "lineno", "module", "msecs", "pathname", "process", "processName", "relativeCreated",
        "stack_info", "exc_info", "exc_text", "message", "thread", "threadName", "taskName",
        "asctime", "getMessage",
    )
)


def _format_extra(record: logging.LogRecord) -> str:
    extra = {k: getattr(record, k) for k in record.__dict__ if k not in _STANDARD_LOG_RECORD_KEYS}
    if not extra:
        return ""
    try:
        return " | " + json.dumps(extra, default=str)
    except Exception:
        return " | " + str(extra)


class ExtraFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        suffix = _format_extra(record)
        return base + suffix if suffix else base


def _configure_logging() -> None:
    if logging.root.handlers:
        return
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    for h in logging.root.handlers:
        h.setFormatter(ExtraFormatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s"))


_configure_logging()

# Environment check (no secrets) for week-ahead context debugging
logging.getLogger("context_service").info(
    "Environment check",
    extra={
        "OPEN_METEO_BASE": os.getenv("OPEN_METEO_BASE"),
        "OPEN_HOLIDAYS_BASE": os.getenv("OPEN_HOLIDAYS_BASE"),
        "HTTP_PROXY": os.getenv("HTTP_PROXY"),
        "HTTPS_PROXY": os.getenv("HTTPS_PROXY"),
    },
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Week-ahead context (weather + holidays). If unset, use placeholder and set context_unavailable.
USER_LAT = os.getenv("USER_LAT")
USER_LON = os.getenv("USER_LON")
USER_COUNTRY = os.getenv("USER_COUNTRY", "GB")
USER_SUBDIVISION = os.getenv("USER_SUBDIVISION")  # e.g. GB-ENG

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


# ---------------------------------------------------------------------------
# Financial summary / income runway — account-type-aware analysis
# ---------------------------------------------------------------------------

# Payment-like descriptions that must NOT be counted as income (repayments on credit).
PAYMENT_LIKE_DESCRIPTIONS = frozenset(
    s.strip().upper()
    for s in (
        "DIRECT DEBIT PAYMENT",
        "FASTER PAYMENT RECEIVED",
        "PAYMENT RECEIVED",
        "BANK TRANSFER",
        "STANDING ORDER",
        "DD PAYMENT",
        "CARD PAYMENT",
    )
)


def is_credit_account(statement: dict) -> bool:
    """Return True if this statement is for a credit account (balance is liability, not savings)."""
    account = statement.get("account") or {}
    at = (account.get("account_type") or statement.get("account_type") or "").upper()
    return at == "CREDIT"


def _description_looks_like_payment(description: str, transaction_category: str) -> bool:
    """True if this transaction should be classified as payment/repayment, not income."""
    if (transaction_category or "").upper() == "PAYMENT":
        return True
    if not description:
        return False
    desc_upper = (description or "").strip().upper()
    if desc_upper in PAYMENT_LIKE_DESCRIPTIONS:
        return True
    if "PAYMENT" in desc_upper and ("RECEIVED" in desc_upper or "DEBIT" in desc_upper):
        return True
    return False


def classify_transaction(txn: dict, account_type: str) -> str:
    """
    Classify a transaction as 'spend', 'repayment', 'income', or 'unknown'.
    - CREDIT account: DEBIT = spend; CREDIT with PAYMENT category/description = repayment; CREDIT and not PAYMENT = income (e.g. refund).
    - CURRENT (or other): DEBIT = spend; CREDIT and not PAYMENT = income; CREDIT with PAYMENT = repayment (e.g. transfer).
    """
    txn_type = (txn.get("transaction_type") or "").upper()
    category = (txn.get("transaction_category") or "").upper()
    description = (txn.get("description") or "").strip()

    if txn_type == "DEBIT":
        return "spend"
    if txn_type != "CREDIT":
        return "unknown"

    is_payment = _description_looks_like_payment(description, category)
    if account_type == "CREDIT":
        return "repayment" if is_payment else "income"
    # CURRENT or other: only treat as income if explicitly not a payment
    if is_payment:
        return "repayment"
    return "income"


def _parse_balance_current(statement: dict):
    """Extract current balance from statement. Supports balance.current or balance[0].current."""
    balance = statement.get("balance")
    if balance is None:
        return None
    if isinstance(balance, dict):
        return balance.get("current")
    if isinstance(balance, list) and balance:
        first = balance[0]
        if isinstance(first, dict):
            return first.get("current")
    return None


def _txn_date(txn: dict):
    """Parse transaction timestamp to date, or None."""
    ts = txn.get("timestamp") or txn.get("date")
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        return dt.date()
    except (ValueError, TypeError):
        return None


def _last_n_days(txns: list, days: int):
    """Filter transactions to those in the last `days` calendar days from the latest txn date."""
    if not txns:
        return []
    dates = [_txn_date(t) for t in txns]
    valid = [d for d in dates if d is not None]
    if not valid:
        return txns
    cutoff = max(valid) - timedelta(days=days)
    return [t for t in txns if _txn_date(t) and _txn_date(t) >= cutoff]


def _recurring_merchants(txns: list, within_days: int = 90) -> list:
    """Same description 2+ times in different calendar months (within last within_days)."""
    recent = _last_n_days(txns, within_days)
    by_desc_month = {}
    for t in recent:
        d = _txn_date(t)
        if not d:
            continue
        desc = (t.get("description") or "").strip() or "(no description)"
        key = (desc, d.year, d.month)
        by_desc_month[key] = by_desc_month.get(key, 0) + 1
    # Descriptions that appear in at least 2 different months
    by_desc = {}
    for (desc, y, m), count in by_desc_month.items():
        by_desc[desc] = by_desc.get(desc, set())
        by_desc[desc].add((y, m))
    return [desc for desc, months in by_desc.items() if len(months) >= 2]


def _high_frequency_merchants(txns: list, within_days: int = 30) -> list:
    """Same description 2+ times in last 30 days."""
    recent = _last_n_days(txns, within_days)
    by_desc = {}
    for t in recent:
        desc = (t.get("description") or "").strip() or "(no description)"
        by_desc[desc] = by_desc.get(desc, 0) + 1
    return [desc for desc, count in by_desc.items() if count >= 2]


def build_financial_context(data: dict) -> list[dict]:
    """
    Build per-statement financial context: account_type, balance, spend, repayments, true_income,
    net_cash_flow, recurring/high-frequency merchants. Only derived from data; no heuristics.
    """
    result = []
    for statement in data.get("statements", []):
        account_type = "CREDIT" if is_credit_account(statement) else "CURRENT"
        balance_current = _parse_balance_current(statement)
        txns = statement.get("transactions", [])
        last_30 = _last_n_days(txns, 30)

        spend_30 = 0.0
        repayments_30 = 0.0
        true_income_30 = 0.0

        for t in last_30:
            amt = float(t.get("amount") or 0)
            txn_type = (t.get("transaction_type") or "").upper()
            if txn_type == "DEBIT":
                spend_30 += abs(amt)
            elif txn_type == "CREDIT":
                kind = classify_transaction(t, account_type)
                if kind == "repayment":
                    repayments_30 += abs(amt)
                elif kind == "income":
                    true_income_30 += abs(amt)

        if account_type == "CREDIT":
            net_cash_flow_30 = repayments_30 - spend_30
        else:
            net_cash_flow_30 = true_income_30 - spend_30

        recurring = _recurring_merchants(txns, 90)
        high_freq = _high_frequency_merchants(txns, 30)
        repayments_lt_spend = account_type == "CREDIT" and repayments_30 < spend_30

        result.append({
            "account_type": account_type,
            "balance_current": balance_current,
            "spend_30d": round(spend_30, 2),
            "repayments_30d": round(repayments_30, 2),
            "true_income_30d": round(true_income_30, 2),
            "net_cash_flow_30d": round(net_cash_flow_30, 2),
            "recurring_merchants": recurring[:20],
            "high_frequency_merchants": high_freq[:20],
            "repayments_lt_spend": repayments_lt_spend,
        })
    return result


def _validate_credit_output(text: str) -> str:
    """Remove or rewrite unsupported claims when output is for a CREDIT account."""
    if not text:
        return text
    lower = text.lower()
    out = text
    if "months without income" in lower or "runway" in lower:
        out = out.replace("months without income", "N/A (credit card data)")
        out = out.replace("Months without income", "N/A (credit card data)")
        out = out.replace("runway", "runway (not applicable for credit cards)")
    if "savings" in lower and "outstanding" not in lower and "debt" not in lower:
        out = out.replace("savings", "outstanding balance (debt — not savings)")
        out = out.replace("Savings", "Outstanding balance (debt — not savings)")
    return out


def _extract_pdf(raw_bytes: bytes) -> str:
    """Extract all text from a PDF file."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


PDF_TRANSACTION_EXTRACTION_PROMPT = """\
You are a bank statement parser. Extract ALL transactions from the provided bank statement text.

Output ONLY a valid JSON array of transactions. Each transaction must have:
- "date": the transaction date in YYYY-MM-DD format (convert from any format you see)
- "description": the merchant/payee name or transaction description
- "amount": the amount as a number (NEGATIVE for debits/spending, POSITIVE for credits/income)
- "category": categorize as one of: Groceries, Dining, Coffee, Transport, Shopping, Subscriptions, Utilities, Rent, Entertainment, Healthcare, Transfer, Income, Other

Rules:
- Include EVERY transaction you can find in the statement
- Convert dates to YYYY-MM-DD format
- For debits/payments/purchases: use NEGATIVE amounts
- For credits/deposits/refunds: use POSITIVE amounts
- Remove currency symbols, just output the number
- If you cannot determine a field, use reasonable defaults
- Output ONLY the JSON array, no explanations, no markdown code blocks

Example output:
[
  {"date": "2026-02-15", "description": "TESCO STORES", "amount": -45.67, "category": "Groceries"},
  {"date": "2026-02-14", "description": "SALARY ACME INC", "amount": 2500.00, "category": "Income"},
  {"date": "2026-02-13", "description": "NETFLIX", "amount": -15.99, "category": "Subscriptions"}
]
"""


async def extract_transactions_from_pdf(pdf_text: str) -> list[dict]:
    """Use LLM to extract structured transactions from PDF bank statement text."""
    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY not set for PDF extraction")
        return []

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PDF_TRANSACTION_EXTRACTION_PROMPT},
                {"role": "user", "content": f"Extract transactions from this bank statement:\n\n{pdf_text[:30000]}"}
            ],
            max_tokens=4000,
            temperature=0.1,
        )

        result_text = response.choices[0].message.content.strip()

        # Clean up response - remove markdown code blocks if present
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        elif result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        result_text = result_text.strip()

        transactions = json.loads(result_text)
        logger.info(f"Extracted {len(transactions)} transactions from PDF")
        return transactions

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        return []
    except Exception as e:
        logger.error(f"PDF transaction extraction failed: {e}")
        return []


async def parse_pdf_to_transactions(raw_bytes: bytes) -> dict:
    """
    Full pipeline: extract text from PDF, then use LLM to parse transactions.
    Returns dict with transactions array and summary.
    """
    # Step 1: Extract text from PDF
    pdf_text = _extract_pdf(raw_bytes)
    if not pdf_text.strip():
        return {"transactions": [], "error": "Could not extract text from PDF"}

    # Step 2: Use LLM to extract structured transactions
    transactions = await extract_transactions_from_pdf(pdf_text)

    if not transactions:
        return {"transactions": [], "error": "Could not extract transactions from PDF text"}

    # Step 3: Calculate basic summary
    total_spent = sum(abs(t["amount"]) for t in transactions if t.get("amount", 0) < 0)
    total_income = sum(t["amount"] for t in transactions if t.get("amount", 0) > 0)

    # Get date range
    dates = [t.get("date") for t in transactions if t.get("date")]
    dates.sort()

    return {
        "transactions": transactions,
        "summary": {
            "total_transactions": len(transactions),
            "total_spent": round(total_spent, 2),
            "total_income": round(total_income, 2),
            "date_range": {
                "start": dates[0] if dates else None,
                "end": dates[-1] if dates else None,
            }
        }
    }


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


# Context-effect guidance: must be included in all candidate and judge prompts.
CONTEXT_EFFECT_GUIDANCE = """
CONTEXT-EFFECT RULES (you MUST follow these):
- Adjust likelihoods and/or expected spend using ONLY the weather and holiday context provided below. Do NOT invent weather or holiday facts.
- If precip_probability >= 60: you MAY increase likelihood for ride-hailing/food delivery by +5 to +20 (depending on history strength); you MAY decrease walk-in dining by -5 to -15. Always clamp final likelihood to 0–95.
- If is_holiday is true: you MAY increase discretionary/entertainment likelihood by +5 to +15; commuting/transport may decrease unless transaction history suggests otherwise.
- If context is missing or "Unknown", do NOT adjust; state "insufficient evidence" for context-based changes and base predictions only on transaction history.
- Do NOT add weather or holiday details that are not in the provided day_context. Do NOT hallucinate context.
"""


def _build_context_summary(day_context: list[dict]) -> str:
    """
    One line per day. Never show 'not a holiday' unless holiday_status=='ok'.
    Weather: show 'weather unknown' when weather_status!='ok'.
    Holiday: if holiday_status=='ok' and is_holiday -> 'HOLIDAY: <name>'; elif holiday_status=='ok' -> 'not a holiday'; else -> 'holiday unknown'.
    """
    lines = []
    for dc in day_context:
        date_str = dc.get("date", "?")[:10]
        w = dc.get("weather") or {}
        h = dc.get("holiday") or {}
        w_status = w.get("weather_status", "error")
        h_status = h.get("holiday_status", "error")
        parts = [f"{date_str}:"]
        if w_status == "ok":
            cond = w.get("condition_summary")
            precip = w.get("precip_probability")
            temp_max = w.get("temp_max_c")
            if cond:
                parts.append(cond.lower())
                if precip is not None:
                    parts.append(f" (precip {precip}%)")
            else:
                parts.append("—")
            if temp_max is not None:
                parts.append(f", max {temp_max:.0f}°C")
        else:
            parts.append("weather unknown")
        if h_status == "ok":
            if h.get("is_holiday"):
                name = h.get("holiday_name") or h.get("name") or "Holiday"
                parts.append(f", HOLIDAY: {name}")
            else:
                parts.append(", not a holiday")
        else:
            parts.append(", holiday unknown")
        lines.append(" ".join(parts))
    return "\n".join(lines)


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


def _calendar_candidate_prompt(
    start_date: str,
    day_context_json: str,
    context_summary_line: str,
    provider_name: str,
) -> str:
    return f"""You are a spending prediction engine. You are given:
1. The user's RAW transaction data
2. Prediction tables from multiple AI models
3. WEEK-AHEAD CONTEXT (weather and public holidays) for each of the next 7 days.

CONTEXT SUMMARY (location and conditions):
{context_summary_line}

Your job: produce a single week-ahead calendar (7 days starting {start_date}) that:
- Uses the raw transaction data and model tables to pick 2-3 predictions per day (behavior, likelihood, avg_spend, agreed_by).
- MUST adjust likelihoods using the provided day_context: rainy days increase likelihood for delivery/ride-hailing if user has history; holidays/weekends may increase leisure/eating-out/shopping. If context is missing for a day, do not fabricate weather/holiday.
{CONTEXT_EFFECT_GUIDANCE}

DAY CONTEXT (use only this; do not invent):
{day_context_json}

REQUIRED: Every prediction MUST have "agreed_by" as a non-empty array. For this calendar (produced by {provider_name}), set agreed_by to exactly ["{provider_name}"] for every prediction.

Output ONLY raw JSON with NO markdown code fences (no ```json, no ```), NO explanations. Schema:
{{ "week_start": "{start_date}", "daily_predictions": [ {{ "date": "YYYY-MM-DD", "day": "Monday", "predictions": [ {{ "behavior": "...", "likelihood": 0-95, "avg_spend": number, "agreed_by": ["{provider_name}"] }} ] }} ] }}
"""


JUDGE_PROMPT = """\
You are a judge evaluating three candidate week-ahead spending calendars. You are given:
1. The same DAY CONTEXT (weather and holidays) that the candidates used.
2. Three candidate calendar JSONs (claude, gemini, openai).

Evaluation rubric:
- Uses weather/holiday context correctly: likelihoods and spend expectations are plausibly adjusted for rain, temperature, and holidays. No invented context.
- Avoids hallucination: only behaviors and merchants that appear in the transaction evidence; no fabricated weather or holiday facts.
- Plausible likelihood calibration: values 0–95, consistent with history and context.
- Consistency with transaction history: merchant names and amounts align with raw data.
- Valid schema: valid JSON with week_start and daily_predictions array. Every prediction MUST have a non-empty "agreed_by" array.

When choosing or merging: if you merge predictions from multiple candidates, set agreed_by to the union of provider names that had that prediction (e.g. ["claude", "gemini"]). Never leave agreed_by empty; use at least ["judge"] if you invent nothing.

You MUST penalize candidates that ignore context or fabricate context. Choose the single best candidate (output its exact JSON) or merge the best parts into one calendar. If merging, preserve valid schema and only include predictions supported by evidence and context.

Output ONLY the chosen or merged calendar as raw JSON. No markdown fences, no explanation.
"""


async def ask_claude_calendar(data_str: str, claude_result: str, gemini_result: str, openai_result: str) -> str:
    """Send raw data + combined provider results to Claude to build a week-ahead calendar (legacy, no context)."""
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


def _parse_calendar_json(raw: str) -> dict | None:
    """Strip markdown fences and parse calendar JSON. Returns None on failure."""
    cleaned = (raw or "").strip()
    for prefix in ("```json\n", "```json", "```"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].lstrip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].rstrip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        return None


def _normalize_final_calendar_agreed_by(cal: dict) -> None:
    """Ensure every prediction has non-empty agreed_by (mutates cal)."""
    for day in cal.get("daily_predictions") or []:
        for p in day.get("predictions") or []:
            ab = p.get("agreed_by")
            if not ab or not isinstance(ab, list):
                p["agreed_by"] = ["judge"]
            else:
                p["agreed_by"] = [x for x in ab if x]
            if not p["agreed_by"]:
                p["agreed_by"] = ["judge"]


def _context_summary_line_for_prompt(metadata: dict, context_summary: str) -> str:
    """Short line for prompts: location source and which days have rain/holiday."""
    loc = metadata.get("location_source", "unknown")
    default = " (default location)" if metadata.get("used_default_location") else ""
    lines = [f"Location source: {loc}{default}."]
    if metadata.get("context_errors"):
        lines.append("Context errors: " + "; ".join(metadata["context_errors"]))
    lines.append("Per-day summary:\n" + context_summary)
    return "\n".join(lines)


async def _ask_calendar_candidate_claude(
    data_str: str,
    combined_tables: str,
    day_context: list[dict],
    start_date: str,
    context_summary_line: str,
) -> str:
    if not ANTHROPIC_API_KEY:
        return ""
    prompt = _calendar_candidate_prompt(
        start_date, json.dumps(day_context, indent=2), context_summary_line, "claude"
    )
    body = f"{prompt}\n\n=== Raw Transaction Data ===\n{data_str}\n\n=== Model Predictions ===\n{combined_tables}"
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": body}],
        )
        return message.content[0].text or ""
    except Exception as e:
        return f"[ERROR] {e}"


async def _ask_calendar_candidate_gemini(
    data_str: str,
    combined_tables: str,
    day_context: list[dict],
    start_date: str,
    context_summary_line: str,
) -> str:
    if not GEMINI_API_KEY:
        return ""
    prompt = _calendar_candidate_prompt(
        start_date, json.dumps(day_context, indent=2), context_summary_line, "gemini"
    )
    body = f"{prompt}\n\n=== Raw Transaction Data ===\n{data_str}\n\n=== Model Predictions ===\n{combined_tables}"
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=body,
        )
        return response.text or ""
    except Exception as e:
        return f"[ERROR] {e}"


async def _ask_calendar_candidate_openai(
    data_str: str,
    combined_tables: str,
    day_context: list[dict],
    start_date: str,
    context_summary_line: str,
) -> str:
    if not OPENAI_API_KEY:
        return ""
    prompt = _calendar_candidate_prompt(
        start_date, json.dumps(day_context, indent=2), context_summary_line, "openai"
    )
    body = f"{prompt}\n\n=== Raw Transaction Data ===\n{data_str}\n\n=== Model Predictions ===\n{combined_tables}"
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": body}],
            max_tokens=2048,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        return f"[ERROR] {e}"


async def _ask_judge_calendar(
    day_context: list[dict],
    claude_cal: str,
    gemini_cal: str,
    openai_cal: str,
) -> str:
    """Judge picks best of three candidate calendars. Uses Claude."""
    if not ANTHROPIC_API_KEY:
        return ""
    body = (
        f"{JUDGE_PROMPT}\n\n=== DAY CONTEXT ===\n{json.dumps(day_context, indent=2)}\n\n"
        "=== Candidate Claude ===\n" + claude_cal + "\n\n"
        "=== Candidate Gemini ===\n" + gemini_cal + "\n\n"
        "=== Candidate OpenAI ===\n" + openai_cal
    )
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": body}],
        )
        return message.content[0].text or ""
    except Exception as e:
        return f"[ERROR] {e}"


async def run_week_ahead_pipeline(
    data_str: str,
    lat: float | None = None,
    lon: float | None = None,
    country_code: str | None = None,
    subdivision_code: str | None = None,
    include_candidate_outputs: bool = False,
) -> dict:
    """
    Run context-aware week-ahead: build day_context, 3 candidate calendars, judge picks best.

    Response schema:
    {
      "context_summary": str,        // One line per day, e.g. "2026-02-22: rainy (80%), not a holiday"
      "day_context": [                // 7 items
        {
          "date": "YYYY-MM-DD",
          "weekday": "Monday",
          "weather": { "precip_probability": 0-100, "precip_mm": float, "temp_min_c", "temp_max_c", "condition_summary": "Rainy|Clear|..." },
          "holiday": { "is_holiday": bool, "name": str|null, "type": "Public"|null }
        }
      ],
      "context_unavailable": bool,
      "candidate_outputs": { "claude": str, "gemini": str, "openai": str } | null,  // when include_candidate_outputs
      "judge_output": str,            // Raw judge LLM response
      "final_calendar": { "week_start", "daily_predictions": [ { "date", "day", "predictions": [ { "behavior", "likelihood", "avg_spend", "agreed_by" } ] } ] },
      "final_calendar_raw": str
    }
    """
    start = date.today() + timedelta(days=1)
    start_date = start.isoformat()
    lat = float(lat) if lat is not None else (float(USER_LAT) if USER_LAT else None)
    lon = float(lon) if lon is not None else (float(USER_LON) if USER_LON else None)
    country = country_code or USER_COUNTRY
    subdivision = subdivision_code or USER_SUBDIVISION

    logger.info(
        "Week-ahead pipeline started",
        extra={
            "start_date": start_date,
            "lat": lat,
            "lon": lon,
            "country_code": country,
            "subdivision_code": subdivision,
        },
    )
    from services.context_service import get_week_context_with_availability
    day_context, context_metadata = get_week_context_with_availability(start, lat, lon, country, subdivision)
    context_summary = _build_context_summary(day_context)
    context_available = context_metadata.get("context_available", False)
    context_unavailable = not context_available
    if context_unavailable and context_metadata.get("context_errors"):
        logger.warning(
            "Week-ahead context partially or fully unavailable: %s",
            "; ".join(context_metadata["context_errors"]),
        )

    context_summary_line = _context_summary_line_for_prompt(context_metadata, context_summary)

    # Pattern tables from 3 models (for candidate inputs)
    claude_result = await ask_claude(data_str)
    gemini_result = await ask_gemini(data_str)
    openai_result = await ask_openai(data_str)
    combined_tables = (
        "=== Claude ===\n" + claude_result + "\n\n=== Gemini ===\n" + gemini_result + "\n\n=== OpenAI ===\n" + openai_result
    )

    # Three candidates produce calendar JSON (each sets agreed_by to its provider name)
    claude_cal, gemini_cal, openai_cal = await asyncio.gather(
        _ask_calendar_candidate_claude(data_str, combined_tables, day_context, start_date, context_summary_line),
        _ask_calendar_candidate_gemini(data_str, combined_tables, day_context, start_date, context_summary_line),
        _ask_calendar_candidate_openai(data_str, combined_tables, day_context, start_date, context_summary_line),
    )

    candidate_outputs = None
    if include_candidate_outputs:
        candidate_outputs = {"claude": claude_cal, "gemini": gemini_cal, "openai": openai_cal}

    # Judge picks best
    judge_raw = await _ask_judge_calendar(day_context, claude_cal, gemini_cal, openai_cal)
    final_calendar = _parse_calendar_json(judge_raw)
    if final_calendar is None:
        for raw in (claude_cal, gemini_cal, openai_cal):
            final_calendar = _parse_calendar_json(raw)
            if final_calendar is not None:
                break
        if final_calendar is None:
            final_calendar = {"week_start": start_date, "daily_predictions": [], "error": "Could not parse any calendar"}
    _normalize_final_calendar_agreed_by(final_calendar)

    return {
        "context_summary": context_summary,
        "day_context": day_context,
        "context_unavailable": context_unavailable,
        "context_available": context_available,
        "context_errors": context_metadata.get("context_errors", []),
        "location_source": context_metadata.get("location_source", "unknown"),
        "used_default_location": context_metadata.get("used_default_location", False),
        "weather_ok": context_metadata.get("weather_ok", False),
        "holiday_ok": context_metadata.get("holiday_ok", False),
        "holiday_status": context_metadata.get("holiday_status", "missing"),
        "holiday_error": context_metadata.get("holiday_error"),
        "candidate_outputs": candidate_outputs,
        "judge_output": judge_raw,
        "final_calendar": final_calendar,
        "final_calendar_raw": judge_raw,
    }


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


@app.post("/parse-pdf", tags=["llm"])
async def parse_pdf_endpoint(file: UploadFile = File(...)):
    """
    Parse a PDF bank statement and return transactions as JSON.
    Uses LLM to extract structured transaction data.

    Returns:
    {
        "transactions": [
            {"date": "YYYY-MM-DD", "description": "...", "amount": -XX.XX, "category": "..."},
            ...
        ],
        "summary": {
            "total_transactions": N,
            "total_spent": XX.XX,
            "total_income": XX.XX,
            "date_range": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
        }
    }
    """
    raw = await file.read()
    filename = file.filename or "file.pdf"

    # Check if it's a PDF
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for transaction extraction")

    try:
        result = await parse_pdf_to_transactions(raw)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")


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


@app.get("/week-ahead-context-check", tags=["calendar"])
async def week_ahead_context_check(
    lat: float | None = None,
    lon: float | None = None,
    country_code: str | None = None,
    subdivision_code: str | None = None,
    debug: bool = False,
):
    """
    Quick check: fetch week context (weather + holidays) for the next 7 days and return day_context.
    Use to verify Open-Meteo and OpenHolidaysAPI calls succeed. No transaction file required.
    If debug=true, sets root logger to DEBUG for this request for verbose logs.
    """
    if debug:
        logging.getLogger().setLevel(logging.DEBUG)
    start = date.today() + timedelta(days=1)
    from services.context_service import get_week_context_with_availability
    lat = float(lat) if lat is not None else (float(USER_LAT) if USER_LAT else None)
    lon = float(lon) if lon is not None else (float(USER_LON) if USER_LON else None)
    country = country_code or USER_COUNTRY
    subdivision = subdivision_code or USER_SUBDIVISION
    day_context, metadata = get_week_context_with_availability(start, lat, lon, country, subdivision)
    summary = _build_context_summary(day_context)
    return {
        "day_context": day_context,
        "context_summary": summary,
        "context_used": metadata.get("context_used", False),
        "weather_ok": metadata.get("weather_ok"),
        "holiday_status": metadata.get("holiday_status"),
        "holiday_error": metadata.get("holiday_error"),
        "context_errors": metadata.get("context_errors", []),
    }


@app.post("/week-ahead", tags=["llm", "calendar"])
async def week_ahead(
    file: UploadFile = File(...),
    lat: float | None = None,
    lon: float | None = None,
    country_code: str | None = None,
    subdivision_code: str | None = None,
    include_candidate_outputs: bool = False,
):
    """
    Context-aware week-ahead predictions: weather (Open-Meteo) + public holidays (OpenHolidaysAPI).
    Runs 3 candidate LLMs (calendar each), then judge LLM picks best. Returns context_summary,
    day_context, final_calendar, and optionally candidate_outputs.
    """
    raw = await file.read()
    try:
        data_str = prepare_input(raw, file.filename or "file")
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid file: {e}")

    result = await run_week_ahead_pipeline(
        data_str,
        lat=lat,
        lon=lon,
        country_code=country_code,
        subdivision_code=subdivision_code,
        include_candidate_outputs=include_candidate_outputs,
    )
    return result


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
    Generate a financial summary from transaction data. Account-type aware:
    CREDIT = spend/repayments/outstanding balance only (no runway). CURRENT = summary suitable for runway.
    """
    raw = await file.read()
    try:
        data_str = prepare_input(raw, file.filename or "file")
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid file: {e}")

    summary = await generate_financial_summary(data_str)
    return {"summary": summary}


def _build_structured_financial_payload(contexts: list[dict]) -> str:
    """Turn build_financial_context output into a clear text payload for the LLM."""
    lines = []
    for i, ctx in enumerate(contexts):
        acc = ctx["account_type"]
        lines.append(f"Account {i + 1} — Type: {acc}")
        if ctx.get("balance_current") is not None:
            lines.append(f"  balance_current: {ctx['balance_current']} (interpret as {'outstanding debt' if acc == 'CREDIT' else 'available funds'})")
        lines.append(f"  spend_30d: {ctx['spend_30d']}, repayments_30d: {ctx['repayments_30d']}, true_income_30d: {ctx['true_income_30d']}")
        lines.append(f"  net_cash_flow_30d: {ctx['net_cash_flow_30d']}")
        if acc == "CREDIT":
            lines.append(f"  repayments_lt_spend: {ctx['repayments_lt_spend']}")
            if ctx.get("recurring_merchants"):
                lines.append(f"  recurring_merchants: {ctx['recurring_merchants'][:10]}")
            if ctx.get("high_frequency_merchants"):
                lines.append(f"  high_frequency_merchants: {ctx['high_frequency_merchants'][:10]}")
        lines.append("")
    return "\n".join(lines)


async def generate_financial_summary(transaction_data: str) -> str:
    """
    Generate account-type-aware financial summary. When JSON has statements/accounts,
    use deterministic structured aggregation (analysis.summary) for explicit, reproducible output.
    Otherwise fall back to LLM for raw/PDF/CSV text.
    """
    try:
        data = json.loads(transaction_data)
    except (json.JSONDecodeError, TypeError):
        data = None

    if data and (data.get("statements") or data.get("accounts")):
        from analysis.summary import build_account_summaries, format_summary_for_display
        summaries = build_account_summaries(data)
        if summaries:
            return format_summary_for_display(summaries)
        # Empty accounts list: fall through to LLM
    else:
        data = None

    # Non-JSON or no statements/accounts: use LLM (existing behaviour)
    if not OPENAI_API_KEY:
        return "[SKIPPED] OPENAI_API_KEY not set. Upload JSON with statements/accounts for deterministic summary."

    has_credit = False
    if data and data.get("statements"):
        contexts = build_financial_context(data)
        has_credit = any(c["account_type"] == "CREDIT" for c in contexts)
        structured_payload = _build_structured_financial_payload(contexts)
    else:
        structured_payload = None

    if structured_payload:
        system_credit = (
            "This is a credit card account. balance.current is outstanding debt, not savings. "
            "Payments (e.g. DIRECT DEBIT PAYMENT, FASTER PAYMENT RECEIVED) are repayments, not income. "
            "Do NOT compute 'months without income'. Do NOT label the balance as available funds or savings."
        )
        full_content = f"""Use ONLY the following structured analysis. Do not infer numbers not given.

{structured_payload}

Instructions:
- For each CREDIT account: Report total spend (last 30 days), total repayments (last 30 days), net card balance change, recurring subscriptions if listed, high-frequency merchants if listed. Flag if repayments are lower than spending. Do NOT mention "savings", "runway", or "months without income".
- For each CURRENT account: Report available funds (balance_current), monthly spend, true_income (only CREDIT transactions that are NOT PAYMENT category), net cash flow. You may then say this summary can be used for runway estimation.

Write a single block of text, 4–8 short lines per account. Be precise; only state what is in the data.

CREDIT account rule: {system_credit}"""
    else:
        full_content = f"""Analyze this transaction/banking data and produce a short financial summary.

CRITICAL: If the data appears to be from a credit card (e.g. balance as liability, payment credits):
- Do NOT treat balance as savings or available cash.
- Do NOT estimate "months without income" or runway.
- Treat payment-like credits (e.g. DIRECT DEBIT PAYMENT, FASTER PAYMENT RECEIVED) as card repayments, not income.
If the data is from a current/savings account with clear income and expenses, you may summarize savings and expenses for runway use.

Write 4–8 short lines. Only state what can be derived from the data; no fabricated estimates.

Data:
{transaction_data[:25000]}"""

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": full_content}],
            max_tokens=500,
            temperature=0.2,
        )
        out = response.choices[0].message.content
        if has_credit:
            out = _validate_credit_output(out)
        return out
    except Exception as e:
        return f"[ERROR] Financial summary failed: {e}"


@app.post("/income-runway", tags=["budget"])
async def income_runway(text: str):
    """
    Estimate how long the user can go without any new income. Only valid for current/savings accounts
    with positive cash balance. Credit card summaries must not be used for runway.
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Provide a financial summary (savings, expenses) as text")

    result = await get_income_runway(text)
    return {"runway": result}


def _summary_suggests_credit_card(text: str) -> bool:
    """Heuristic: summary likely describes credit card data (runway not applicable)."""
    if not text:
        return False
    lower = text.lower()
    return (
        "credit card" in lower
        or "outstanding balance" in lower
        or "outstanding debt" in lower
        or ("repayments" in lower and "savings" not in lower and "balance" in lower)
    )


async def get_income_runway(financial_summary: str) -> str:
    """
    Estimate runway only when the summary describes current/savings with positive cash.
    If summary describes credit card debt, do not estimate months without income.
    """
    if not OPENAI_API_KEY:
        return "[SKIPPED] OPENAI_API_KEY not set"

    guardrail = (
        " If this summary describes credit card debt or outstanding balance as the primary balance, "
        "do NOT estimate months without income; instead state clearly that runway cannot be estimated from credit card data."
    )
    prompt = f"""Based on the following financial summary, estimate how long this person can go without any new income (runway) only if the summary clearly describes liquid savings/current account balance and monthly expenses. Consider only savings, liquid assets, monthly expenses, and recurring income — not credit card balance.{guardrail}

Financial Summary:
{financial_summary}

Respond in 2-4 short sentences. If the data is from a credit card or does not support runway, say so and do not give a number of months. Otherwise give estimated runway and one brief note. Be concise."""

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
        )
        out = response.choices[0].message.content
        # Output validation: if summary suggests credit and response still claims runway, rewrite
        if _summary_suggests_credit_card(financial_summary):
            if "months without income" in out.lower() or ("month" in out.lower() and "runway" in out.lower()):
                out = "Runway cannot be estimated from credit card data. The balance shown is outstanding debt, not savings; payments are repayments, not income."
        return out
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
