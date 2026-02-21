"""Tests for transaction sampling."""
import pytest
from datetime import datetime, timedelta, timezone
from app.models.transaction import Transaction
from app.services.sampling import TransactionSampler


@pytest.fixture
def sample_transactions():
    """Generate sample transactions for testing."""
    transactions = []
    base_date = datetime.now(timezone.utc) - timedelta(days=100)
    
    # Create transactions with varying amounts
    for i in range(200):
        transactions.append(Transaction(
            id=f"tx_{i}",
            timestamp=base_date + timedelta(days=i % 100),
            amount=-50.0 - (i % 100),  # Varying amounts
            currency="USD",
            description=f"Transaction {i}",
            category="Test" if i % 2 == 0 else "Other",
            balance_after=1000.0 - (i * 10),
        ))
    
    # Add some large transactions
    for i in range(10):
        transactions.append(Transaction(
            id=f"large_{i}",
            timestamp=base_date + timedelta(days=i * 10),
            amount=-500.0,
            currency="USD",
            description=f"Large Transaction {i}",
            category="Large",
            balance_after=500.0,
        ))
    
    # Add recent transactions
    for i in range(20):
        transactions.append(Transaction(
            id=f"recent_{i}",
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            amount=-10.0,
            currency="USD",
            description=f"Recent Transaction {i}",
            category="Recent",
            balance_after=100.0,
        ))
    
    return transactions


def test_sampling_top_x(sample_transactions):
    """Test top X sampling strategy."""
    sampler = TransactionSampler(top_x=10, stratified_n=20, target_char_budget=5000)
    sampled, stats = sampler.sample(sample_transactions, window_days=180)
    
    assert len(sampled) > 0
    assert stats["top_x_count"] > 0
    assert stats["total_transactions"] == len(sample_transactions)


def test_sampling_recency(sample_transactions):
    """Test recency weighting."""
    sampler = TransactionSampler(
        top_x=5,
        stratified_n=10,
        recency_days=14,
        target_char_budget=5000,
    )
    sampled, stats = sampler.sample(sample_transactions, window_days=180)
    
    # Should include recent transactions
    assert stats["recency_count"] > 0
    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    recent_in_sample = [tx for tx in sampled if tx.timestamp >= recent_cutoff]
    assert len(recent_in_sample) > 0


def test_sampling_empty():
    """Test sampling with empty transaction list."""
    sampler = TransactionSampler()
    sampled, stats = sampler.sample([], window_days=180)
    
    assert len(sampled) == 0
    assert stats["total_transactions"] == 0
    assert stats["sampled_count"] == 0


def test_sampling_budget_limit(sample_transactions):
    """Test that sampling respects character budget."""
    sampler = TransactionSampler(
        top_x=1000,  # Very large
        stratified_n=1000,
        target_char_budget=1000,  # Small budget
    )
    sampled, stats = sampler.sample(sample_transactions, window_days=180)
    
    # Should be trimmed to fit budget using compact representation
    compact_str = sampler.to_compact_string(sampled)
    char_used = len(compact_str)
    
    # Budget must be respected
    assert char_used <= sampler.target_char_budget, \
        f"Budget exceeded: {char_used} > {sampler.target_char_budget}"
    
    # Stats should reflect the actual char count used
    assert stats["char_used"] == char_used
    assert stats["char_used"] <= sampler.target_char_budget
