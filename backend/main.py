"""
TrueLayer Data API integration with FastAPI.

Supports multiple mock bank users. Each auth flow is tagged with a user label
(e.g. john, john1, john2). After auth, transactions are auto-fetched and saved
to backend/data/<user_label>.json.

Flow per user:
  1. GET /auth-link?user=john    → redirects to TrueLayer Mock Bank
  2. GET /callback?code=...      → exchanges code, auto-fetches & saves transactions
  3. GET /users                  → list all authenticated users + saved files
  4. GET /fetch-and-save         → re-fetch & save for current active user

Mock Bank credentials:  john/doe, john1/doe1, john2/doe2, … john100/doe100
"""

from typing import Dict, List, Optional
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

import config

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("truelayer")

app = FastAPI(
    title="Prophit — TrueLayer Integration",
    description="Retrieve and save bank statement data for multiple users via TrueLayer (sandbox)",
    version="0.3.0",
)

# Allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory to save transaction data
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# Multi-user token store:  { "john": { "access_token": "...", "refresh_token": "..." }, ... }
_sessions: Dict[str, Dict[str, str]] = {}

# Track which user label is currently being authenticated
_pending_auth_user: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_token(user: str) -> str:
    """Return the access token for a given user or raise 401."""
    session = _sessions.get(user)
    if not session or not session.get("access_token"):
        raise HTTPException(
            status_code=401,
            detail=f"User '{user}' not authenticated. Visit /auth-link?user={user} first.",
        )
    return session["access_token"]


async def _tl_get(token: str, path: str, params: Optional[dict] = None) -> dict:
    """Make an authenticated GET to the TrueLayer Data API."""
    url = f"{config.DATA_API}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, params=params)
    if resp.status_code != 200:
        logger.error("TrueLayer API error %s: %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.json() if resp.headers.get("content-type", "").startswith("application/json") else resp.text,
        )
    return resp.json()


async def _fetch_all_statements(token: str) -> dict:
    """Fetch all accounts, balances, and transactions for a token."""
    accounts_resp = await _tl_get(token, "/accounts")
    accounts = accounts_resp.get("results", [])

    statements = []
    for acct in accounts:
        acct_id = acct["account_id"]
        balance_resp = await _tl_get(token, f"/accounts/{acct_id}/balance")
        txn_resp = await _tl_get(token, f"/accounts/{acct_id}/transactions")

        statements.append({
            "account": acct,
            "balance": balance_resp.get("results", []),
            "transactions": txn_resp.get("results", []),
        })

    return {"statements": statements, "total_accounts": len(statements)}


def _save_user_data(user: str, data: dict) -> str:
    """Save statement data to data/<user>.json and return the file path."""
    data["fetched_at"] = datetime.utcnow().isoformat() + "Z"
    data["user_label"] = user

    filepath = DATA_DIR / f"{user}.json"
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

    logger.info("Saved data for user '%s' → %s", user, filepath)
    return str(filepath)


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
async def health():
    """Health check — shows authenticated users and saved data files."""
    saved = [f.name for f in DATA_DIR.glob("*.json")]
    return {
        "status": "ok",
        "authenticated_users": list(_sessions.keys()),
        "saved_files": saved,
        "hint": "Visit /auth-link?user=john to connect a user",
        "mock_users": "john/doe, john1/doe1, john2/doe2 … john100/doe100",
    }


@app.get("/auth-link", tags=["auth"])
async def auth_link(user: str = Query("john", description="User label (e.g. john, john1, john2)")):
    """
    Build a TrueLayer auth link for a specific user and redirect.

    Use different labels for each mock bank user you want to fetch.
    Mock Bank credentials: john/doe, john1/doe1, john2/doe2, etc.
    """
    global _pending_auth_user
    _pending_auth_user = user

    params = {
        "response_type": "code",
        "client_id": config.CLIENT_ID,
        "redirect_uri": config.REDIRECT_URI,
        "scope": config.SCOPES,
        "providers": "uk-cs-mock",
        "state": user,  # pass user label through OAuth state
    }
    auth_url = f"{config.AUTH_BASE}/?{urlencode(params)}"
    logger.info("Auth link for user '%s': %s", user, auth_url)
    return RedirectResponse(url=auth_url)


@app.get("/callback", tags=["auth"])
async def callback(
    code: str = Query(..., description="OAuth authorization code"),
    state: Optional[str] = Query(None, description="User label from OAuth state"),
):
    """
    OAuth callback — exchanges code for access token, then auto-fetches
    and saves all transaction data for this user.
    """
    user = state or _pending_auth_user or "default"

    # Exchange code for token
    payload = {
        "grant_type": "authorization_code",
        "client_id": config.CLIENT_ID,
        "client_secret": config.CLIENT_SECRET,
        "redirect_uri": config.REDIRECT_URI,
        "code": code,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(config.TOKEN_URL, data=payload)

    if resp.status_code != 200:
        logger.error("Token exchange failed %s: %s", resp.status_code, resp.text)
        raise HTTPException(status_code=resp.status_code, detail=f"Token exchange failed: {resp.text}")

    data = resp.json()
    _sessions[user] = {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token", ""),
    }
    logger.info("Access token obtained for user '%s'", user)

    # Auto-fetch and save transactions
    try:
        statements = await _fetch_all_statements(data["access_token"])
        filepath = _save_user_data(user, statements)
        txn_count = sum(len(s["transactions"]) for s in statements["statements"])
    except Exception as e:
        logger.error("Auto-fetch failed for user '%s': %s", user, e)
        filepath = None
        txn_count = 0

    return {
        "message": f"User '{user}' authenticated and data saved!",
        "user": user,
        "accounts": statements["total_accounts"] if filepath else 0,
        "transactions_saved": txn_count,
        "saved_to": filepath,
        "next": f"Authenticate next user at /auth-link?user=<next_user>",
    }


# ---------------------------------------------------------------------------
# Multi-user management
# ---------------------------------------------------------------------------

@app.get("/users", tags=["users"])
async def list_users():
    """List all authenticated users and their saved data files."""
    users = []
    for user in _sessions:
        filepath = DATA_DIR / f"{user}.json"
        info = {"user": user, "has_saved_data": filepath.exists()}
        if filepath.exists():
            info["file"] = str(filepath)
            info["file_size_kb"] = round(filepath.stat().st_size / 1024, 1)
        users.append(info)
    return {"users": users, "total": len(users)}


@app.get("/fetch-and-save", tags=["users"])
async def fetch_and_save(user: str = Query(..., description="User label to fetch data for")):
    """Re-fetch and save transaction data for an already-authenticated user."""
    token = _get_token(user)
    statements = await _fetch_all_statements(token)
    filepath = _save_user_data(user, statements)
    txn_count = sum(len(s["transactions"]) for s in statements["statements"])

    return {
        "user": user,
        "accounts": statements["total_accounts"],
        "transactions_saved": txn_count,
        "saved_to": filepath,
    }


@app.get("/fetch-all-users", tags=["users"])
async def fetch_all_users():
    """Fetch and save transaction data for ALL authenticated users."""
    results = []
    for user, session in _sessions.items():
        try:
            token = session["access_token"]
            statements = await _fetch_all_statements(token)
            filepath = _save_user_data(user, statements)
            txn_count = sum(len(s["transactions"]) for s in statements["statements"])
            results.append({
                "user": user, "status": "saved",
                "accounts": statements["total_accounts"],
                "transactions": txn_count,
                "file": filepath,
            })
        except Exception as e:
            results.append({"user": user, "status": "error", "error": str(e)})

    return {"results": results, "total_users": len(results)}


# ---------------------------------------------------------------------------
# Data API endpoints (single-user, uses first authenticated session)
# ---------------------------------------------------------------------------

def _any_token() -> str:
    """Get any available token for convenience endpoints."""
    if not _sessions:
        raise HTTPException(status_code=401, detail="No users authenticated. Visit /auth-link first.")
    user = list(_sessions.keys())[-1]  # most recent
    return _sessions[user]["access_token"]


@app.get("/accounts", tags=["data"])
async def list_accounts(user: Optional[str] = Query(None, description="User label (uses latest if omitted)")):
    """List all connected bank accounts."""
    token = _get_token(user) if user else _any_token()
    return await _tl_get(token, "/accounts")


@app.get("/accounts/{account_id}/balance", tags=["data"])
async def get_balance(account_id: str, user: Optional[str] = Query(None)):
    """Get the balance for a specific account."""
    token = _get_token(user) if user else _any_token()
    return await _tl_get(token, f"/accounts/{account_id}/balance")


@app.get("/accounts/{account_id}/transactions", tags=["data"])
async def get_transactions(
    account_id: str,
    user: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from", description="Start date (ISO 8601)"),
    to_date: Optional[str] = Query(None, alias="to", description="End date (ISO 8601)"),
):
    """Get settled transactions for a specific account."""
    token = _get_token(user) if user else _any_token()
    params = {}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    return await _tl_get(token, f"/accounts/{account_id}/transactions", params or None)


@app.get("/statements", tags=["data"])
async def get_statements(user: Optional[str] = Query(None)):
    """Full statement dump — all accounts + balances + transactions."""
    token = _get_token(user) if user else _any_token()
    return await _fetch_all_statements(token)


@app.get("/info", tags=["data"])
async def get_user_info(user: Optional[str] = Query(None)):
    """Get identity / personal information for the connected user."""
    token = _get_token(user) if user else _any_token()
    return await _tl_get(token, "/info")


# ---------------------------------------------------------------------------
# Transaction History API (reads from saved JSON files — no live session needed)
# ---------------------------------------------------------------------------

def _load_saved_data(user: str) -> dict:
    """Load a user's saved JSON data from disk."""
    filepath = DATA_DIR / f"{user}.json"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"No saved data for user '{user}'. Authenticate first via /auth-link?user={user}")
    with open(filepath) as f:
        return json.load(f)


@app.get("/api/transactions/{user}", tags=["transaction-history"])
async def get_user_transactions(
    user: str,
    account_type: Optional[str] = Query(None, description="Filter by account type (e.g. TRANSACTION, SAVINGS)"),
    txn_type: Optional[str] = Query(None, description="Filter by transaction type (DEBIT or CREDIT)"),
):
    """
    Get saved transaction history for a specific user.

    Reads from data/<user>.json — no live TrueLayer session required.
    Supports filtering by account_type and txn_type.
    """
    data = _load_saved_data(user)
    result = []

    for stmt in data.get("statements", []):
        acct = stmt["account"]

        # Filter by account type
        if account_type and acct.get("account_type", "").upper() != account_type.upper():
            continue

        transactions = stmt.get("transactions", [])

        # Filter by transaction type
        if txn_type:
            transactions = [t for t in transactions if t.get("transaction_type", "").upper() == txn_type.upper()]

        result.append({
            "account_id": acct["account_id"],
            "account_type": acct.get("account_type"),
            "display_name": acct.get("display_name"),
            "currency": acct.get("currency"),
            "balance": stmt.get("balance", []),
            "transactions": transactions,
            "transaction_count": len(transactions),
        })

    return {
        "user": user,
        "fetched_at": data.get("fetched_at"),
        "accounts": result,
        "total_transactions": sum(a["transaction_count"] for a in result),
    }


@app.get("/api/transactions", tags=["transaction-history"])
async def get_all_transactions():
    """
    Get saved transaction history for ALL users.

    Returns a summary with transaction counts per user, plus the data.
    """
    users_data = []

    for filepath in sorted(DATA_DIR.glob("*.json")):
        user = filepath.stem
        with open(filepath) as f:
            data = json.load(f)

        accounts = []
        for stmt in data.get("statements", []):
            acct = stmt["account"]
            txns = stmt.get("transactions", [])
            accounts.append({
                "account_id": acct["account_id"],
                "account_type": acct.get("account_type"),
                "display_name": acct.get("display_name"),
                "currency": acct.get("currency"),
                "balance": stmt.get("balance", []),
                "transactions": txns,
                "transaction_count": len(txns),
            })

        total_txns = sum(a["transaction_count"] for a in accounts)
        users_data.append({
            "user": user,
            "fetched_at": data.get("fetched_at"),
            "accounts": accounts,
            "total_transactions": total_txns,
        })

    return {
        "users": users_data,
        "total_users": len(users_data),
        "grand_total_transactions": sum(u["total_transactions"] for u in users_data),
    }

