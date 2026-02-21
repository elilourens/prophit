import csv
import json
import datetime
from pathlib import Path

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

CSV_FILE = "NWBCRDBLR____ 99724-20260221.csv"
OUT_FILE = DATA_DIR / "real_history.json"

transactions = []
txn_id_counter = 1

print(f"Parsing {CSV_FILE}...")

with open(CSV_FILE, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Stop at footer "Balance as at..."
        if row.get("Date") and row.get("Date").strip() != "" and not row.get("Type"):
            # Empty type might be the closing balance row
            continue
            
        date_str = row["Date"].strip()
        if not date_str:
            continue
            
        # Parse date like '20 Feb 2026'
        try:
            dt = datetime.datetime.strptime(date_str, "%d %b %Y")
        except ValueError:
            continue
            
        # Format true timestamp: YYYY-MM-DDT00:00:00Z
        timestamp = dt.strftime("%Y-%m-%dT12:00:00Z")
        
        desc = row["Description"].strip()
        
        try:
            val = float(row["Value"].replace(",", ""))
        except ValueError:
            continue
            
        # Credit Card formatting: Purchases are positive, Payments to card are negative.
        # Dashboard expects: Spending = Negative, Income = Positive.
        # So we negate the CSV value.
        amount = -val
        
        txn_type = "CREDIT" if amount > 0 else "DEBIT"
        
        transactions.append({
            "transaction_id": f"real_txn_{txn_id_counter}",
            "timestamp": timestamp,
            "description": desc,
            "amount": amount,
            "currency": "GBP",
            "transaction_type": txn_type,
            "transaction_category": row["Type"].strip()
        })
        txn_id_counter += 1

output = {
    "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "statements": [
        {
            "account": {
                "account_id": "real_nwb_cc",
                "account_type": "CREDIT",
                "display_name": "NatWest Credit Card",
                "currency": "GBP"
            },
            "balance": {
                "available": 0.0,
                "current": 144.43,
                "currency": "GBP"
            },
            "transactions": transactions
        }
    ]
}

with open(OUT_FILE, "w") as f:
    json.dump(output, f, indent=2)

print(f"Success. Wrote {len(transactions)} real transactions to {OUT_FILE}")
