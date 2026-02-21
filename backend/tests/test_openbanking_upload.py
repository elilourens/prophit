"""Tests for Open Banking upload endpoint."""
import pytest
import json
from pathlib import Path
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.storage.database import get_db

client = TestClient(app)


@pytest.fixture
def openbanking_sample():
    """Load Open Banking sample data."""
    fixture_path = Path(__file__).parent / "fixtures" / "john_sample.json"
    with open(fixture_path, "r") as f:
        return json.load(f)


def test_upload_openbanking_success(openbanking_sample):
    """Test successful Open Banking upload."""
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob"},
        json=openbanking_sample,
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["user_id"] == "test_user_ob"
    assert data["transaction_count"] > 0
    assert data["accounts_count"] == 1
    assert "date_range_start" in data
    assert "date_range_end" in data
    assert "message" in data
    
    # Verify transactions were stored
    transaction_store, _ = get_db()
    stored = transaction_store.get_transactions("test_user_ob")
    assert len(stored) == data["transaction_count"]


def test_upload_openbanking_validation_missing_statements():
    """Test validation error when statements are missing."""
    invalid_data = {"total_accounts": 1}
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob"},
        json=invalid_data,
    )
    
    assert response.status_code == 422
    assert "statements" in response.text.lower()


def test_upload_openbanking_validation_empty_statements():
    """Test validation error when statements array is empty."""
    invalid_data = {"statements": []}
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob"},
        json=invalid_data,
    )
    
    assert response.status_code == 422


def test_upload_openbanking_validation_missing_timestamp(openbanking_sample):
    """Test validation error when transaction timestamp is missing."""
    # Remove timestamp from first transaction
    openbanking_sample["statements"][0]["transactions"][0].pop("timestamp", None)
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob"},
        json=openbanking_sample,
    )
    
    assert response.status_code == 422
    assert "timestamp" in response.text.lower()


def test_upload_openbanking_timestamp_parsing(openbanking_sample):
    """Test that timestamps with Z suffix are parsed correctly."""
    # Ensure we have a transaction with Z suffix
    openbanking_sample["statements"][0]["transactions"][0]["timestamp"] = "2024-01-15T10:30:00Z"
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob_timestamp"},
        json=openbanking_sample,
    )
    
    assert response.status_code == 200
    
    # Verify timestamp was parsed correctly
    transaction_store, _ = get_db()
    stored = transaction_store.get_transactions("test_user_ob_timestamp")
    assert len(stored) > 0
    # Check that timestamp is timezone-aware
    assert stored[0].timestamp.tzinfo is not None


def test_upload_openbanking_balance_mapping(openbanking_sample):
    """Test that running_balance is correctly mapped to balance_after."""
    # Set a specific running_balance on first transaction
    test_tx = openbanking_sample["statements"][0]["transactions"][0]
    test_tx["running_balance"] = {
        "currency": "GBP",
        "amount": 1000.50
    }
    # Store the transaction_id to find it later
    test_tx_id = (
        test_tx.get("transaction_id")
        or test_tx.get("normalised_provider_transaction_id")
        or test_tx.get("provider_transaction_id")
    )
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob_balance"},
        json=openbanking_sample,
    )
    
    assert response.status_code == 200
    
    # Verify balance_after was set
    transaction_store, _ = get_db()
    stored = transaction_store.get_transactions("test_user_ob_balance")
    assert len(stored) > 0
    # Find the transaction we modified by ID
    tx_with_balance = next((tx for tx in stored if tx.id == test_tx_id), None)
    assert tx_with_balance is not None, f"Transaction {test_tx_id} not found"
    assert tx_with_balance.balance_after == 1000.50


def test_upload_openbanking_category_mapping(openbanking_sample):
    """Test that transaction_category is correctly mapped."""
    # Set a specific category on first transaction and clear meta to avoid fallback
    test_tx = openbanking_sample["statements"][0]["transactions"][0]
    test_tx["transaction_category"] = "PURCHASE"
    test_tx["meta"] = {}
    test_tx_id = (
        test_tx.get("transaction_id")
        or test_tx.get("normalised_provider_transaction_id")
        or test_tx.get("provider_transaction_id")
    )
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob_category"},
        json=openbanking_sample,
    )
    
    assert response.status_code == 200
    
    # Verify category was set
    transaction_store, _ = get_db()
    stored = transaction_store.get_transactions("test_user_ob_category")
    assert len(stored) > 0
    # Find the transaction we modified by ID
    tx_with_category = next((tx for tx in stored if tx.id == test_tx_id), None)
    assert tx_with_category is not None, f"Transaction {test_tx_id} not found"
    assert tx_with_category.category == "PURCHASE"


def test_upload_openbanking_deduplication(openbanking_sample):
    """Test that duplicate transactions are deduplicated."""
    # Duplicate first transaction
    first_tx = openbanking_sample["statements"][0]["transactions"][0].copy()
    openbanking_sample["statements"][0]["transactions"].append(first_tx)
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob_dedup"},
        json=openbanking_sample,
    )
    
    assert response.status_code == 200
    
    # Verify only unique transactions were stored
    transaction_store, _ = get_db()
    stored = transaction_store.get_transactions("test_user_ob_dedup")
    # Should have original count, not doubled
    assert len(stored) == len(openbanking_sample["statements"][0]["transactions"]) - 1


def test_upload_openbanking_multiple_accounts():
    """Test upload with multiple accounts."""
    multi_account_data = {
        "statements": [
            {
                "account": {
                    "account_id": "acc1",
                    "account_type": "CURRENT",
                    "currency": "GBP",
                    "display_name": "Account 1"
                },
                "transactions": [
                    {
                        "timestamp": "2024-01-01T10:00:00Z",
                        "description": "Transaction 1",
                        "amount": -50.0,
                        "currency": "GBP",
                        "transaction_id": "tx1"
                    }
                ]
            },
            {
                "account": {
                    "account_id": "acc2",
                    "account_type": "SAVINGS",
                    "currency": "GBP",
                    "display_name": "Account 2"
                },
                "transactions": [
                    {
                        "timestamp": "2024-01-02T10:00:00Z",
                        "description": "Transaction 2",
                        "amount": -75.0,
                        "currency": "GBP",
                        "transaction_id": "tx2"
                    }
                ]
            }
        ]
    }
    
    response = client.post(
        "/transactions/upload/openbanking",
        params={"user_id": "test_user_ob_multi"},
        json=multi_account_data,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["accounts_count"] == 2
    assert data["transaction_count"] == 2
