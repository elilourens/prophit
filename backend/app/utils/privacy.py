"""Privacy utilities for obfuscating sensitive data in logs."""
import re
from typing import List
from app.models.transaction import Transaction


def obfuscate_merchant(description: str) -> str:
    """
    Obfuscate merchant names in transaction descriptions.
    Replaces alphanumeric characters with asterisks, preserves structure.
    """
    # Replace alphanumeric characters with asterisks, keep spaces and special chars
    obfuscated = re.sub(r'[A-Za-z0-9]', '*', description)
    return obfuscated


def obfuscate_transactions(transactions: List[Transaction]) -> List[dict]:
    """
    Obfuscate transaction data for logging.
    Returns a list of dictionaries with obfuscated merchant names.
    """
    return [
        {
            "timestamp": str(tx.timestamp),
            "amount": tx.amount,
            "currency": tx.currency,
            "description": obfuscate_merchant(tx.description),
            "category": tx.category or "***",
            "balance_after": tx.balance_after if tx.balance_after else None,
        }
        for tx in transactions
    ]
