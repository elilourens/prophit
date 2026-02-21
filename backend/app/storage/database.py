"""Database storage layer using SQLite."""
import sqlite3
import json
from datetime import datetime
from typing import List, Optional
from contextlib import contextmanager
from app.models.transaction import Transaction, TransactionCreate
from app.models.summary import JudgeOutput
from app.config import settings


class TransactionStore:
    """Storage for transactions."""
    
    def __init__(self, db_path: str = "prophit.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize database tables."""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT,
                    balance_after REAL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_timestamp 
                ON transactions(user_id, timestamp)
            """)
            conn.commit()
    
    @contextmanager
    def _get_conn(self):
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def add_transactions(self, transactions: List[TransactionCreate]) -> int:
        """Add transactions to the database."""
        import uuid
        with self._get_conn() as conn:
            count = 0
            for tx in transactions:
                tx_id = tx.id or str(uuid.uuid4())
                conn.execute("""
                    INSERT OR REPLACE INTO transactions 
                    (id, user_id, timestamp, amount, currency, description, category, balance_after, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    tx_id,
                    tx.user_id,
                    tx.timestamp.isoformat(),
                    tx.amount,
                    tx.currency,
                    tx.description,
                    tx.category,
                    tx.balance_after,
                    datetime.utcnow().isoformat(),
                ))
                count += 1
            conn.commit()
            return count
    
    def get_transactions(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Transaction]:
        """Get transactions for a user within date range."""
        with self._get_conn() as conn:
            query = "SELECT * FROM transactions WHERE user_id = ?"
            params = [user_id]
            
            if start_date:
                query += " AND timestamp >= ?"
                params.append(start_date.isoformat())
            
            if end_date:
                query += " AND timestamp <= ?"
                params.append(end_date.isoformat())
            
            query += " ORDER BY timestamp ASC"
            
            rows = conn.execute(query, params).fetchall()
            return [
                Transaction(
                    id=row["id"],
                    timestamp=datetime.fromisoformat(row["timestamp"]),
                    amount=row["amount"],
                    currency=row["currency"],
                    description=row["description"],
                    category=row["category"],
                    balance_after=row["balance_after"],
                )
                for row in rows
            ]
    
    def get_transaction_stats(self, user_id: str) -> dict:
        """Get basic statistics about user's transactions."""
        transactions = self.get_transactions(user_id)
        if not transactions:
            return {
                "count": 0,
                "date_range_start": None,
                "date_range_end": None,
            }
        
        timestamps = [tx.timestamp for tx in transactions]
        return {
            "count": len(transactions),
            "date_range_start": min(timestamps),
            "date_range_end": max(timestamps),
        }


class SummaryStore:
    """Storage for generated summaries."""
    
    def __init__(self, db_path: str = "prophit.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize database tables."""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS summaries (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    summary_type TEXT NOT NULL,
                    judge_output TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_type_created 
                ON summaries(user_id, summary_type, created_at)
            """)
            conn.commit()
    
    @contextmanager
    def _get_conn(self):
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def save_summary(
        self,
        user_id: str,
        summary_type: str,
        judge_output: JudgeOutput,
    ) -> str:
        """Save a summary."""
        import uuid
        summary_id = str(uuid.uuid4())
        
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO summaries (id, user_id, summary_type, judge_output, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                summary_id,
                user_id,
                summary_type,
                json.dumps(judge_output.model_dump(), default=str),
                datetime.utcnow().isoformat(),
            ))
            conn.commit()
        return summary_id
    
    def get_latest_summary(
        self,
        user_id: str,
        summary_type: str,
    ) -> Optional[JudgeOutput]:
        """Get the latest summary for a user and type."""
        with self._get_conn() as conn:
            row = conn.execute("""
                SELECT judge_output FROM summaries
                WHERE user_id = ? AND summary_type = ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (user_id, summary_type)).fetchone()
            
            if not row:
                return None
            
            data = json.loads(row["judge_output"])
            return JudgeOutput(**data)


# Global instances
_transaction_store = None
_summary_store = None


def get_db():
    """Get database store instances."""
    global _transaction_store, _summary_store
    if _transaction_store is None:
        _transaction_store = TransactionStore()
    if _summary_store is None:
        _summary_store = SummaryStore()
    return _transaction_store, _summary_store
