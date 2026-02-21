"""Transaction data models."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Transaction(BaseModel):
    """Transaction model."""
    
    id: Optional[str] = None
    timestamp: datetime
    amount: float = Field(..., description="Negative for spending, positive for income")
    currency: str = Field(default="USD", description="Currency code")
    description: str = Field(..., description="Merchant/transaction description")
    category: Optional[str] = Field(None, description="Transaction category")
    balance_after: Optional[float] = Field(None, description="Account balance after transaction")
    
    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": "2024-01-15T10:30:00Z",
                "amount": -45.99,
                "currency": "USD",
                "description": "STARBUCKS #1234",
                "category": "Food & Dining",
                "balance_after": 1250.50
            }
        }


class TransactionCreate(Transaction):
    """Transaction creation model (includes user_id)."""
    
    user_id: str = Field(..., description="User identifier")
