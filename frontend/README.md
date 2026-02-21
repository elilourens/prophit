# Prophit Frontend — API Guide

The backend runs at **`http://localhost:3000`** and exposes transaction history via a REST API with CORS enabled.

## Transaction History Endpoints

### Get all users' transactions
```
GET http://localhost:3000/api/transactions
```

### Get a specific user's transactions
```
GET http://localhost:3000/api/transactions/{user}
```

**Query params:**
| Param | Description | Example |
|-------|-------------|---------|
| `account_type` | Filter by account type | `TRANSACTION`, `SAVINGS` |
| `txn_type` | Filter by transaction type | `DEBIT`, `CREDIT` |

### Example: fetch from JavaScript
```js
// All users
const res = await fetch('http://localhost:3000/api/transactions');
const data = await res.json();
// data.users[0].accounts[0].transactions

// Single user, debits only
const res2 = await fetch('http://localhost:3000/api/transactions/john?txn_type=DEBIT');
const debits = await res2.json();
```

### Response shape
```json
{
  "user": "john",
  "fetched_at": "2026-02-21T14:04:33Z",
  "accounts": [
    {
      "account_id": "...",
      "display_name": "TRANSACTION ACCOUNT 1",
      "currency": "GBP",
      "balance": [{ "available": 102.0, "current": 22.0 }],
      "transactions": [
        { "description": "REGENDA REDWING", "amount": -150.0, "transaction_type": "DEBIT", "timestamp": "..." }
      ],
      "transaction_count": 437
    }
  ],
  "total_transactions": 2185
}
```

## Other useful endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check + list of authenticated users |
| `GET /docs` | Swagger UI (interactive API docs) |
| `GET /users` | List users with saved data file info |
| `GET /auth-link?user=john` | Start bank auth flow for a new user |

## Available mock users

| Username | Password |
|----------|----------|
| john | doe |
| john1 | doe1 |
| john2 | doe2 |
| … | … |
| john100 | doe100 |
