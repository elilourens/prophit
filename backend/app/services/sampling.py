"""Transaction sampling strategies."""
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Optional
from app.models.transaction import Transaction
from app.utils.token_estimation import estimate_tokens


class TransactionSampler:
    """Samples transactions to fit within token budget."""
    
    def __init__(
        self,
        top_x: int = 50,
        stratified_n: int = 80,
        recency_days: int = 14,
        target_char_budget: int = 20000,
    ):
        """
        Initialize sampler.
        
        Args:
            top_x: Top X transactions by absolute amount
            stratified_n: Stratified sample size
            recency_days: Always include transactions from last N days
            target_char_budget: Target character budget for sampling
        """
        self.top_x = top_x
        self.stratified_n = stratified_n
        self.recency_days = recency_days
        self.target_char_budget = target_char_budget
    
    def to_compact_string(self, transactions: List[Transaction]) -> str:
        """
        Convert transactions to compact string representation for budgeting.
        Format: "YYYY-MM-DD|amount|currency|category|description" per line.
        
        Args:
            transactions: List of transactions
            
        Returns:
            Compact string representation
        """
        lines = []
        for tx in transactions:
            date_str = tx.timestamp.strftime("%Y-%m-%d")
            amount_str = str(tx.amount)
            currency_str = tx.currency or "USD"
            category_str = tx.category or ""
            desc_str = tx.description or ""
            lines.append(f"{date_str}|{amount_str}|{currency_str}|{category_str}|{desc_str}")
        return "\n".join(lines)
    
    def sample(
        self,
        transactions: List[Transaction],
        window_days: int = 180,
        as_of: Optional[datetime] = None,
    ) -> Tuple[List[Transaction], dict]:
        """
        Sample transactions using multiple strategies.
        
        Args:
            transactions: List of transactions (should already be filtered to window)
            window_days: Window size in days (for stats only, transactions already filtered)
            as_of: Reference date for recency calculations. If None, uses current UTC time.
        
        Returns:
            Tuple of (sampled_transactions, stats_dict)
        """
        if not transactions:
            return [], {
                "total_transactions": 0,
                "sampled_count": 0,
                "date_range_start": None,
                "date_range_end": None,
                "top_x_count": 0,
                "stratified_count": 0,
                "recency_count": 0,
            }
        
        # Transactions are already filtered by the endpoint, so use them directly
        windowed = transactions
        
        if not windowed:
            return [], {
                "total_transactions": len(transactions),
                "sampled_count": 0,
                "date_range_start": min(tx.timestamp for tx in transactions) if transactions else None,
                "date_range_end": max(tx.timestamp for tx in transactions) if transactions else None,
                "top_x_count": 0,
                "stratified_count": 0,
                "recency_count": 0,
            }
        
        date_range_start = min(tx.timestamp for tx in windowed)
        date_range_end = max(tx.timestamp for tx in windowed)
        
        # Strategy 1: Recency weighting (always include recent transactions)
        # Use as_of if provided, otherwise current time
        reference_date = as_of if as_of else datetime.now(timezone.utc)
        recency_cutoff = reference_date - timedelta(days=self.recency_days)
        recent = [tx for tx in windowed if tx.timestamp >= recency_cutoff]
        
        # Strategy 2: Top X by absolute amount
        sorted_by_amount = sorted(windowed, key=lambda tx: abs(tx.amount), reverse=True)
        top_x_txs = sorted_by_amount[:self.top_x]
        
        # Strategy 3: Stratified sampling (by category and time period)
        stratified = self._stratified_sample(windowed, self.stratified_n)
        
        # Combine all strategies
        sampled_set = set()
        sampled_list = []
        
        # Add recent transactions first
        for tx in recent:
            tx_id = tx.id or id(tx)
            if tx_id not in sampled_set:
                sampled_set.add(tx_id)
                sampled_list.append(tx)
        
        # Add top X
        for tx in top_x_txs:
            tx_id = tx.id or id(tx)
            if tx_id not in sampled_set:
                sampled_set.add(tx_id)
                sampled_list.append(tx)
        
        # Add stratified
        for tx in stratified:
            tx_id = tx.id or id(tx)
            if tx_id not in sampled_set:
                sampled_set.add(tx_id)
                sampled_list.append(tx)
        
        # Sort by timestamp
        sampled_list.sort(key=lambda tx: tx.timestamp)
        
        # Enforce budget using compact representation
        sampled_list = self._enforce_budget(
            sampled_list,
            recent,
            top_x_txs,
            stratified,
            recency_cutoff,
        )
        
        # Calculate actual char count used
        compact_str = self.to_compact_string(sampled_list)
        char_used = len(compact_str)
        
        stats = {
            "total_transactions": len(transactions),
            "sampled_count": len(sampled_list),
            "date_range_start": date_range_start,
            "date_range_end": date_range_end,
            "top_x_count": len([tx for tx in sampled_list if tx in top_x_txs]),
            "stratified_count": len([tx for tx in sampled_list if tx in stratified]),
            "recency_count": len(recent),
            "char_used": char_used,
        }
        
        return sampled_list, stats
    
    def _enforce_budget(
        self,
        sampled_list: List[Transaction],
        recent: List[Transaction],
        top_x_txs: List[Transaction],
        stratified: List[Transaction],
        recency_cutoff: datetime,
    ) -> List[Transaction]:
        """
        Enforce target_char_budget by trimming transactions in priority order.
        
        Priority (highest to lowest):
        1. Recent transactions (within recency_days)
        2. Top X by absolute amount
        3. Stratified samples
        4. Everything else
        
        Args:
            sampled_list: Current list of sampled transactions
            recent: List of recent transactions
            top_x_txs: List of top X transactions
            stratified: List of stratified transactions
            recency_cutoff: Cutoff date for recency
            
        Returns:
            Trimmed list that fits within budget
        """
        # Create priority sets for efficient lookup
        recent_set = {tx.id or id(tx) for tx in recent}
        top_x_set = {tx.id or id(tx) for tx in top_x_txs}
        stratified_set = {tx.id or id(tx) for tx in stratified}
        
        # Classify transactions by priority
        priority_1 = []  # Recent
        priority_2 = []  # Top X (but not recent)
        priority_3 = []  # Stratified (but not recent or top X)
        priority_4 = []  # Everything else
        
        for tx in sampled_list:
            tx_id = tx.id or id(tx)
            if tx_id in recent_set:
                priority_1.append(tx)
            elif tx_id in top_x_set:
                priority_2.append(tx)
            elif tx_id in stratified_set:
                priority_3.append(tx)
            else:
                priority_4.append(tx)
        
        # Build result in priority order, checking budget at each step
        result = []
        
        # Helper to check if adding a transaction would exceed budget
        def would_fit(tx: Transaction) -> bool:
            test_result = result + [tx]
            compact = self.to_compact_string(test_result)
            return len(compact) <= self.target_char_budget
        
        # Add priority 1 (recent) - always keep these if they fit
        for tx in priority_1:
            if would_fit(tx):
                result.append(tx)
            else:
                # Can't fit this one, stop adding from this priority
                break
        
        # Add priority 2 (top X, not recent)
        for tx in priority_2:
            if would_fit(tx):
                result.append(tx)
            else:
                break
        
        # Add priority 3 (stratified, not recent or top X)
        for tx in priority_3:
            if would_fit(tx):
                result.append(tx)
            else:
                break
        
        # Add priority 4 (everything else) if we still have budget
        for tx in priority_4:
            if would_fit(tx):
                result.append(tx)
            else:
                break
        
        return result
    
    def _stratified_sample(
        self,
        transactions: List[Transaction],
        n: int,
    ) -> List[Transaction]:
        """
        Stratified sampling by category and time period.
        Ensures representation across different categories and time periods.
        """
        if len(transactions) <= n:
            return transactions
        
        # Group by category
        by_category = {}
        uncategorized = []
        
        for tx in transactions:
            if tx.category:
                if tx.category not in by_category:
                    by_category[tx.category] = []
                by_category[tx.category].append(tx)
            else:
                uncategorized.append(tx)
        
        # Calculate samples per category
        categories = list(by_category.keys())
        samples_per_category = max(1, n // (len(categories) + 1)) if categories else n
        
        sampled = []
        
        # Sample from each category
        for category, txs in by_category.items():
            # Sort by timestamp and sample evenly across time
            txs.sort(key=lambda tx: tx.timestamp)
            step = max(1, len(txs) // samples_per_category)
            for i in range(0, len(txs), step):
                if len(sampled) < n:
                    sampled.append(txs[i])
        
        # Sample from uncategorized
        if uncategorized and len(sampled) < n:
            uncategorized.sort(key=lambda tx: tx.timestamp)
            step = max(1, len(uncategorized) // (n - len(sampled)))
            for i in range(0, len(uncategorized), step):
                if len(sampled) < n:
                    sampled.append(uncategorized[i])
        
        return sampled[:n]
