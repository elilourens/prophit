import json
import random
import datetime
import urllib.request
from pathlib import Path

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# 1. Load Calendar Data
cal_file = DATA_DIR / "calendar_events.json"
calendar_map = {}
if cal_file.exists():
    with open(cal_file) as f:
        cal_data = json.load(f).get("daily_calendar", [])
        calendar_map = {d["date"]: d["busy_hours"] for d in cal_data}
else:
    print(f"Warning: {cal_file} not found. Calendar correlation will be flat.")

# 2. Fetch Holidays
print("Fetching Public Holidays (IE) for 2025-2026...")
holidays_url = "https://openholidaysapi.org/PublicHolidays?countryIsoCode=IE&languageIsoCode=EN&validFrom=2025-01-01&validTo=2026-12-31"
try:
    req = urllib.request.urlopen(holidays_url)
    holidays_data = json.loads(req.read())
    holidays_map = {h["startDate"]: True for h in holidays_data}
except Exception as e:
    print(f"Failed to fetch holidays: {e}")
    holidays_map = {}

end_date = datetime.date.today() + datetime.timedelta(days=14)

# 3. Fetch Weather
print("Fetching Historical & Forecasted Weather (London)...")
weather_url = (
    "https://api.open-meteo.com/v1/forecast?"
    "latitude=51.5074&longitude=-0.1278"
    f"&start_date=2025-11-25&end_date={end_date.isoformat()}"
    "&daily=temperature_2m_mean,precipitation_sum"
    "&timezone=Europe/London"
)
try:
    req = urllib.request.urlopen(weather_url)
    weather_data_json = json.loads(req.read())
    weather_map = {}
    for i, d in enumerate(weather_data_json["daily"]["time"]):
        weather_map[d] = {
            "temp": weather_data_json["daily"]["temperature_2m_mean"][i],
            "precip": weather_data_json["daily"]["precipitation_sum"][i]
        }
except Exception as e:
    print(f"Failed to fetch weather: {e}")
    weather_map = {}

transactions = []
# Match calendar dates roughly
start_date = datetime.date(2025, 11, 25)
current = start_date
txn_id_counter = 1

print(f"Generating correlated transactions from {start_date} to {end_date}...")

while current <= end_date:
    date_str = current.isoformat()
    
    # Base daily spending
    daily_spend = 50.0
    
    # Correlation 1: Temperature (+ Spend heavily when it's hotter)
    temp = weather_map.get(date_str, {}).get("temp")
    if temp is not None:
        daily_spend += temp * 15.0  # +£15 per celsius degree
        
    # Correlation 2: Precip (- Spend less when raining)
    precip = weather_map.get(date_str, {}).get("precip")
    if precip is not None:
        daily_spend -= precip * 12.0  # -£12 per mm of rain
        
    # Correlation 3: Calendar (+ Spend heavily when very busy)
    busy = calendar_map.get(date_str, 0.0)
    daily_spend += busy * 40.0        # +£40 per busy hour

    # Correlation 4: Holidays (Massive spending spikes)
    is_holiday = holidays_map.get(date_str, False)
    if is_holiday:
        daily_spend += random.uniform(300.0, 600.0)
        
    # Introduce some noise so it's not a perfect mathematical line
    daily_spend += random.uniform(-40.0, 40.0)
    
    # Don't let it go zero or negative
    daily_spend = max(5.0, daily_spend)
    
    # Split daily spending into a few random transactions
    num_txns = random.randint(1, 5)
    for _ in range(num_txns):
        amount = -(daily_spend / num_txns)
        transactions.append({
            "transaction_id": f"txn_{date_str.replace('-','')}_{txn_id_counter}",
            "timestamp": f"{date_str}T{random.randint(9,20):02d}:{random.randint(0,59):02d}:00Z",
            "description": "Correlated Synthetic Spend",
            "amount": round(amount, 2),
            "currency": "GBP",
            "transaction_type": "DEBIT",
            "transaction_category": "SYNTHETIC"
        })
        txn_id_counter += 1
        
    # Give the user a monthly salary to offset it
    if current.day == 25:
        transactions.append({
            "transaction_id": f"salary_{current.year}_{current.month}",
            "timestamp": f"{date_str}T08:00:00Z",
            "description": "MegaCorp Salary",
            "amount": 7500.0,
            "currency": "GBP",
            "transaction_type": "CREDIT",
            "transaction_category": "SALARY"
        })
        
    current += datetime.timedelta(days=1)

# Build TrueLayer-like JSON structure
output = {
    "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "statements": [
        {
            "account": {
                "account_id": "account_fake_correlated",
                "account_type": "TRANSACTION",
                "display_name": "Synthetic Account",
                "currency": "GBP"
            },
            "balance": {
                "available": 125000.00,
                "current": 125000.00,
                "currency": "GBP"
            },
            "transactions": transactions
        }
    ]
}

out_file = DATA_DIR / "fake_correlated.json"
with open(out_file, "w") as f:
    json.dump(output, f, indent=2)

print(f"Success. Wrote {len(transactions)} synthetic transactions to {out_file}")
