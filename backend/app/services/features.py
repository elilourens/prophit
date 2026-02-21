"""Feature extraction from transactions."""
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from app.models.transaction import Transaction


class FeatureExtractor:
    """Extracts features and statistics from transactions."""
    
    def extract_balance_health(
        self,
        transactions: List[Transaction],
        days: int = 30,
        as_of: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Extract balance health features.
        
        Args:
            transactions: List of transactions
            days: Number of days to look back
            as_of: Reference date for calculation. If None, uses current UTC time.
        
        Returns:
            Dictionary with balance statistics
        """
        if not transactions:
            return {
                "min_balance_30d": None,
                "avg_balance": None,
                "max_balance_30d": None,
                "overdraft_count": 0,
                "balance_trend": "unknown",
            }
        
        # Filter to last N days relative to reference date
        reference_date = as_of if as_of else datetime.now(timezone.utc)
        cutoff = reference_date - timedelta(days=days)
        recent = [tx for tx in transactions if tx.timestamp >= cutoff]
        
        balances = [tx.balance_after for tx in recent if tx.balance_after is not None]
        
        if not balances:
            return {
                "min_balance_30d": None,
                "avg_balance": None,
                "max_balance_30d": None,
                "overdraft_count": 0,
                "balance_trend": "unknown",
            }
        
        min_balance = min(balances)
        max_balance = max(balances)
        avg_balance = sum(balances) / len(balances)
        overdraft_count = len([b for b in balances if b < 0])
        
        # Determine trend (simple: compare first half to second half)
        if len(balances) >= 4:
            first_half = balances[:len(balances)//2]
            second_half = balances[len(balances)//2:]
            first_avg = sum(first_half) / len(first_half)
            second_avg = sum(second_half) / len(second_half)
            
            if second_avg > first_avg * 1.05:
                trend = "increasing"
            elif second_avg < first_avg * 0.95:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "unknown"
        
        return {
            "min_balance_30d": min_balance,
            "avg_balance": avg_balance,
            "max_balance_30d": max_balance,
            "overdraft_count": overdraft_count,
            "balance_trend": trend,
        }
    
    def extract_aggregations(
        self,
        transactions: List[Transaction],
    ) -> Dict[str, Any]:
        """
        Extract aggregated statistics.
        
        Returns:
            Dictionary with aggregated stats
        """
        if not transactions:
            return {
                "total_income": 0.0,
                "total_spending": 0.0,
                "net_flow": 0.0,
                "transaction_count": 0,
                "avg_transaction": 0.0,
                "by_category": {},
                "by_currency": {},
            }
        
        income = sum(tx.amount for tx in transactions if tx.amount > 0)
        spending = abs(sum(tx.amount for tx in transactions if tx.amount < 0))
        net_flow = income - spending
        
        by_category = {}
        for tx in transactions:
            category = tx.category or "Uncategorized"
            if category not in by_category:
                by_category[category] = {"count": 0, "total": 0.0}
            by_category[category]["count"] += 1
            by_category[category]["total"] += abs(tx.amount)
        
        by_currency = {}
        for tx in transactions:
            currency = tx.currency
            if currency not in by_currency:
                by_currency[currency] = {"count": 0, "total": 0.0}
            by_currency[currency]["count"] += 1
            by_currency[currency]["total"] += abs(tx.amount)
        
        avg_transaction = sum(abs(tx.amount) for tx in transactions) / len(transactions) if transactions else 0.0
        
        return {
            "total_income": income,
            "total_spending": spending,
            "net_flow": net_flow,
            "transaction_count": len(transactions),
            "avg_transaction": avg_transaction,
            "by_category": by_category,
            "by_currency": by_currency,
        }
    
    def format_for_prompt(
        self,
        transactions: List[Transaction],
        aggregations: Dict[str, Any],
        balance_health: Dict[str, Any],
    ) -> str:
        """
        Format transaction data for LLM prompt.
        
        Returns:
            Formatted string representation
        """
        lines = []
        
        # Aggregations
        lines.append("=== AGGREGATED STATISTICS ===")
        lines.append(f"Total Income: ${aggregations['total_income']:.2f}")
        lines.append(f"Total Spending: ${aggregations['total_spending']:.2f}")
        lines.append(f"Net Flow: ${aggregations['net_flow']:.2f}")
        lines.append(f"Transaction Count: {aggregations['transaction_count']}")
        lines.append(f"Average Transaction: ${aggregations['avg_transaction']:.2f}")
        lines.append("")
        
        # Balance health
        if balance_health.get("avg_balance") is not None:
            lines.append("=== BALANCE HEALTH ===")
            lines.append(f"Min Balance (30d): ${balance_health['min_balance_30d']:.2f}")
            lines.append(f"Avg Balance: ${balance_health['avg_balance']:.2f}")
            lines.append(f"Max Balance (30d): ${balance_health['max_balance_30d']:.2f}")
            lines.append(f"Overdraft Count: {balance_health['overdraft_count']}")
            lines.append(f"Balance Trend: {balance_health['balance_trend']}")
            lines.append("")
        
        # Category breakdown
        if aggregations.get("by_category"):
            lines.append("=== SPENDING BY CATEGORY ===")
            for category, data in sorted(
                aggregations["by_category"].items(),
                key=lambda x: x[1]["total"],
                reverse=True
            )[:10]:  # Top 10
                lines.append(f"{category}: ${data['total']:.2f} ({data['count']} transactions)")
            lines.append("")
        
        # Sample transactions
        lines.append("=== SAMPLE TRANSACTIONS ===")
        for tx in transactions[:50]:  # Limit to 50 for prompt
            lines.append(
                f"{tx.timestamp.strftime('%Y-%m-%d %H:%M')} | "
                f"${tx.amount:.2f} {tx.currency} | "
                f"{tx.description} | "
                f"Category: {tx.category or 'N/A'} | "
                f"Balance: ${tx.balance_after:.2f}" if tx.balance_after else "Balance: N/A"
            )
        
        return "\n".join(lines)
