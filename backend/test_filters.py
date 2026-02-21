import urllib.request
import urllib.parse
import json

def test_api():
    print("Testing /api/transactions/fake_correlated")
    base_url = "http://localhost:3000/api/transactions/fake_correlated"
    
    # 1. Base (No filters)
    req = urllib.request.urlopen(base_url)
    res = json.loads(req.read())
    print(f"Base Transactions: {res.get('total_transactions')}")
    
    # 2. Date Filter
    params = urllib.parse.urlencode({
        "from_date": "2026-01-01",
        "to_date": "2026-01-31"
    })
    req = urllib.request.urlopen(f"{base_url}?{params}")
    res = json.loads(req.read())
    print(f"Jan 2026 Transactions: {res.get('total_transactions')}")
    
    # 3. Temp Filter (Cold days only)
    params = urllib.parse.urlencode({
        "max_temp": 5.0
    })
    req = urllib.request.urlopen(f"{base_url}?{params}")
    res = json.loads(req.read())
    print(f"Cold Days (<= 5C) Transactions: {res.get('total_transactions')}")
    
    # 4. Combo Filter
    params = urllib.parse.urlencode({
        "from_date": "2026-01-01",
        "to_date": "2026-02-28",
        "min_temp": 10.0
    })
    req = urllib.request.urlopen(f"{base_url}?{params}")
    res = json.loads(req.read())
    print(f"Warm Days in Jan/Feb (>= 10C): {res.get('total_transactions')}")

if __name__ == "__main__":
    test_api()
