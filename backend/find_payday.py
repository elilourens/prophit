import json
import os
from pathlib import Path
from datetime import datetime
from collections import defaultdict

DATA_DIR = Path(__file__).parent / "data"

def find_payday_for_user(filepath: Path):
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
    except Exception as e:
        return f"Error reading {filepath.name}: {e}"

    credits = []
    
    # Extract all transactions
    for stmt in data.get("statements", []):
        for t in stmt.get("transactions", []):
            if t.get("transaction_type", "").upper() == "CREDIT":
                credits.append(t)
                
    if not credits:
        return "No credit transactions detected."

    # Group credits by description to find the primary income source
    # We will score each description by its total volume.
    desc_totals = defaultdict(float)
    desc_dates = defaultdict(list)
    
    for t in credits:
        desc = t.get("description", "Unknown").strip()
        amt = t.get("amount", 0.0)
        
        # Parse day of month
        ts_str = t.get("timestamp", "")
        if ts_str:
            try:
                # Handle Z at the end
                ts_str = ts_str.replace("Z", "+00:00")
                dt = datetime.fromisoformat(ts_str)
                day = dt.day
                desc_dates[desc].append(day)
            except ValueError:
                pass
                
        desc_totals[desc] += amt

    if not desc_totals:
        return "No valid timestamps found on credits."

    # Identify the description with the highest total inbound volume
    # This is highly likely to be the employer / salary.
    primary_income_desc = max(desc_totals.items(), key=lambda x: x[1])[0]
    dates = desc_dates[primary_income_desc]
    
    if not dates:
        return f"Primary income '{primary_income_desc}' has no valid dates."
        
    # Find the most common day of the month for this income source
    day_counts = defaultdict(int)
    for d in dates:
        day_counts[d] += 1
        
    best_day = max(day_counts.items(), key=lambda x: x[1])[0]
    
    # Formatting the suffix (st, nd, rd, th)
    if 11 <= best_day <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(best_day % 10, "th")

    total_volume = desc_totals[primary_income_desc]
    
    return f"Likely Payday: {best_day}{suffix} of the month (Source: '{primary_income_desc}', Total Vol: £{total_volume:,.2f})"

def main():
    if not DATA_DIR.exists():
        print(f"Data directory not found: {DATA_DIR}")
        return

    json_files = list(DATA_DIR.glob("*.json"))
    if not json_files:
        print("No user JSON files found in data directory.")
        return

    print("--- Payday Analysis ---")
    for fp in sorted(json_files):
        print(f"\nUser Profile: {fp.stem}")
        result = find_payday_for_user(fp)
        print(f"  -> {result}")

if __name__ == "__main__":
    main()
