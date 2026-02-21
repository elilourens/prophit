"""Transaction sampling strategies."""
from datetime import datetime, timedelta
from typing import List, Tuple
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
    
    def sample(
        self,
        transactions: List[Transaction],
        window_days: int = 180,
    ) -> Tuple[List[Transaction], dict]:
        """
        Sample transactions using multiple strategies.
        
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
        
        # Filter by window
        cutoff_date = datetime.utcnow() - timedelta(days=window_days)
        windowed = [tx for tx in transactions if tx.timestamp >= cutoff_date]
        
        if not windowed:
            return [], {
                "total_transactions": len(transactions),
                "sampled_count": 0,
                "date_range_start": min(tx.timestamp for tx in transactions),
                "date_range_end": max(tx.timestamp for tx in transactions),
                "top_x_count": 0,
                "stratified_count": 0,
                "recency_count": 0,
            }
        
        date_range_start = min(tx.timestamp for tx in windowed)
        date_range_end = max(tx.timestamp for tx in windowed)
        
        # Strategy 1: Recency weighting (always include recent transactions)
        recency_cutoff = datetime.utcnow() - timedelta(days=self.recency_days)
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
        
        # Check if we're within budget, if not, trim
        current_size = len(str(sampled_list))
        if current_size > self.target_char_budget:
            # Trim by removing oldest non-recent transactions
            trimmed = []
            for tx in sampled_list:
                if tx.timestamp >= recency_cutoff:
                    trimmed.append(tx)
                elif len(str(trimmed)) < self.target_char_budget * 0.8:
                    trimmed.append(tx)
            sampled_list = trimmed
        
        stats = {
            "total_transactions": len(transactions),
            "sampled_count": len(sampled_list),
            "date_range_start": date_range_start,
            "date_range_end": date_range_end,
            "top_x_count": len([tx for tx in sampled_list if tx in top_x_txs]),
            "stratified_count": len([tx for tx in sampled_list if tx in stratified]),
            "recency_count": len(recent),
        }
        
        return sampled_list, stats
    
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
