"""Tests for API endpoints."""
import pytest
import json
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_transaction_data():
    """Sample transaction data for testing."""
    transactions = []
    base_date = datetime.now(timezone.utc) - timedelta(days=30)
    
    for i in range(50):
        transactions.append({
            "timestamp": (base_date + timedelta(days=i)).isoformat(),
            "amount": -50.0 - (i * 2),
            "currency": "USD",
            "description": f"Test Transaction {i}",
            "category": "Test" if i % 2 == 0 else "Other",
            "balance_after": 1000.0 - (i * 10),
        })
    
    return transactions


def test_root_endpoint():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


def test_upload_transactions_json(sample_transaction_data, tmp_path):
    """Test uploading transactions as JSON."""
    # Create a temporary JSON file
    json_file = tmp_path / "transactions.json"
    with open(json_file, "w") as f:
        json.dump(sample_transaction_data, f)
    
    with open(json_file, "rb") as f:
        response = client.post(
            "/transactions/upload",
            files={"file": ("transactions.json", f, "application/json")},
            params={"user_id": "test_user_1"},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test_user_1"
    assert data["transaction_count"] == 50
    assert "date_range_start" in data
    assert "date_range_end" in data


def test_upload_transactions_csv(tmp_path):
    """Test uploading transactions as CSV."""
    csv_content = """timestamp,amount,currency,description,category,balance_after
2024-01-01T10:00:00,-50.0,USD,Test Transaction 1,Test,1000.0
2024-01-02T10:00:00,-75.0,USD,Test Transaction 2,Other,925.0
2024-01-03T10:00:00,-100.0,USD,Test Transaction 3,Test,825.0"""
    
    csv_file = tmp_path / "transactions.csv"
    with open(csv_file, "w") as f:
        f.write(csv_content)
    
    with open(csv_file, "rb") as f:
        response = client.post(
            "/transactions/upload",
            files={"file": ("transactions.csv", f, "text/csv")},
            params={"user_id": "test_user_2"},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_count"] == 3


def test_run_summarization(sample_transaction_data, tmp_path):
    """Test running summarization pipeline."""
    # First upload transactions
    json_file = tmp_path / "transactions.json"
    with open(json_file, "w") as f:
        json.dump(sample_transaction_data, f)
    
    with open(json_file, "rb") as f:
        upload_response = client.post(
            "/transactions/upload",
            files={"file": ("transactions.json", f, "application/json")},
            params={"user_id": "test_user_3"},
        )
    
    assert upload_response.status_code == 200
    
    # Now run summarization
    request_data = {
        "user_id": "test_user_3",
        "window_days": 180,
        "top_x": 20,
        "stratified_n": 30,
        "llm_models": ["mock:gpt", "mock:claude"],
        "judge_model": "mock:judge",
        "target_char_budget": 10000,
    }
    
    response = client.post("/summaries/run", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test_user_3"
    assert "daily" in data
    assert "monthly" in data
    assert "debug" in data
    assert data["daily"]["winning_model_id"] in ["mock:gpt", "mock:claude"]


def test_get_latest_summaries():
    """Test getting latest summaries."""
    response = client.get("/summaries/latest", params={"user_id": "test_user_3"})
    
    # Should work if summaries exist, or 404 if not
    assert response.status_code in [200, 404]
    
    if response.status_code == 200:
        data = response.json()
        assert "user_id" in data
        assert "daily" in data or "monthly" in data


def test_summarization_with_as_of(tmp_path):
    """Test summarization with as_of parameter for historical data."""
    # Create 2024 transaction data
    transactions_2024 = []
    base_date = datetime(2024, 1, 1)
    
    for i in range(30):
        transactions_2024.append({
            "timestamp": (base_date + timedelta(days=i)).isoformat(),
            "amount": -50.0 - (i * 2),
            "currency": "USD",
            "description": f"2024 Transaction {i}",
            "category": "Test" if i % 2 == 0 else "Other",
            "balance_after": 1000.0 - (i * 10),
        })
    
    # Upload transactions
    json_file = tmp_path / "transactions_2024.json"
    with open(json_file, "w") as f:
        json.dump(transactions_2024, f)
    
    with open(json_file, "rb") as f:
        upload_response = client.post(
            "/transactions/upload",
            files={"file": ("transactions_2024.json", f, "application/json")},
            params={"user_id": "test_user_as_of"},
        )
    
    assert upload_response.status_code == 200
    assert upload_response.json()["transaction_count"] == 30
    
    # Run summarization with as_of set to a date in 2024
    # This should work even though the data is old
    as_of_date = datetime(2024, 1, 31, tzinfo=timezone.utc)  # End of January 2024
    
    request_data = {
        "user_id": "test_user_as_of",
        "window_days": 30,  # Look back 30 days from as_of
        "top_x": 10,
        "stratified_n": 15,
        "llm_models": ["mock:gpt", "mock:claude"],
        "judge_model": "mock:judge",
        "target_char_budget": 10000,
        "as_of": as_of_date.isoformat(),
    }
    
    response = client.post("/summaries/run", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test_user_as_of"
    assert "daily" in data
    assert "monthly" in data
    assert "debug" in data
    assert data["daily"]["winning_model_id"] in ["mock:gpt", "mock:claude"]
    
    # Verify that transactions were found (window should include Jan 1-31, 2024)
    assert data["debug"]["sampling_stats"]["total_transactions"] > 0
