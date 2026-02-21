"""Open Banking JSON format models."""
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from app.utils.timestamp import parse_timestamp


class Account(BaseModel):
    """Account metadata."""
    
    account_id: str = Field(..., description="Account identifier")
    account_type: str = Field(..., description="Account type")
    currency: str = Field(..., description="Account currency")
    display_name: Optional[str] = Field(None, description="Display name")
    account_number: Optional[Any] = Field(None, description="Account number (can be object or string)")
    provider: Optional[Any] = Field(None, description="Provider (can be object or string)")
    update_timestamp: Optional[str] = Field(None, description="Last update timestamp")


class Balance(BaseModel):
    """Balance snapshot."""
    
    currency: str = Field(..., description="Currency")
    amount: Optional[float] = Field(None, description="Balance amount")
    current: Optional[float] = Field(None, description="Current balance")
    available: Optional[float] = Field(None, description="Available balance")
    overdraft: Optional[float] = Field(None, description="Overdraft limit")
    timestamp: Optional[str] = Field(None, description="Balance timestamp")
    update_timestamp: Optional[str] = Field(None, description="Update timestamp")


class RunningBalance(BaseModel):
    """Running balance for a transaction."""
    
    currency: str = Field(..., description="Currency")
    amount: float = Field(..., description="Balance amount after transaction")


class OBTransaction(BaseModel):
    """Open Banking transaction."""
    
    timestamp: str = Field(..., description="Transaction timestamp (ISO8601)")
    description: str = Field(..., description="Transaction description")
    amount: float = Field(..., description="Transaction amount (negative for debit, positive for credit)")
    currency: str = Field(..., description="Transaction currency")
    transaction_id: Optional[str] = Field(None, description="Transaction ID")
    normalised_provider_transaction_id: Optional[str] = Field(None, description="Normalized provider transaction ID")
    transaction_type: Optional[str] = Field(None, description="Transaction type (DEBIT/CREDIT)")
    transaction_category: Optional[str] = Field(None, description="Transaction category (PURCHASE/DIRECT_DEBIT/etc.)")
    transaction_classification: Optional[List[str]] = Field(None, description="Transaction classifications")
    running_balance: Optional[RunningBalance] = Field(None, description="Running balance after transaction")
    meta: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    provider_transaction_id: Optional[str] = Field(None, description="Provider transaction ID")
    
    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: str) -> str:
        """Validate timestamp can be parsed."""
        try:
            parse_timestamp(v)
            return v
        except Exception as e:
            raise ValueError(f"Invalid timestamp format: {str(e)}")


class Statement(BaseModel):
    """Open Banking statement."""
    
    account: Account = Field(..., description="Account information")
    balance: Optional[List[Balance]] = Field(default=None, description="Balance snapshots")
    transactions: List[OBTransaction] = Field(..., min_length=1, description="List of transactions")


class OpenBankingExport(BaseModel):
    """Open Banking export root model."""
    
    statements: List[Statement] = Field(..., min_length=1, description="List of statements")
    total_accounts: Optional[int] = Field(None, description="Total number of accounts")
    fetched_at: Optional[str] = Field(None, description="Fetch timestamp")
    user_label: Optional[str] = Field(None, description="User label")
