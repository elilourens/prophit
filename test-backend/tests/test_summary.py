"""Tests for analysis.summary (structured financial summary)."""

import sys
from pathlib import Path

# Ensure test-backend is on path so "analysis" resolves
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analysis.summary import build_account_summaries, format_summary_for_display


def test_build_account_summaries_current():
    data = {
        "statements": [
            {
                "account_id": "acc_1",
                "account_type": "CURRENT",
                "currency": "GBP",
                "balance": [{"current": 1500, "available": 1400}],
                "transactions": [
                    {"timestamp": "2026-02-01T00:00:00Z", "amount": 2500, "transaction_type": "CREDIT", "description": "SALARY"},
                    {"timestamp": "2026-02-05T00:00:00Z", "amount": -800, "transaction_type": "DEBIT", "description": "RENT LANDLORD"},
                    {"timestamp": "2026-02-10T00:00:00Z", "amount": -120, "transaction_type": "DEBIT", "description": "TESCO"},
                ],
            }
        ]
    }
    summaries = build_account_summaries(data)
    assert len(summaries) == 1
    s = summaries[0]
    assert s["account_type"] == "CURRENT"
    assert s["balance_current"] == 1500
    assert s["balance_available"] == 1400
    assert s["totals"]["total_inflow"] == 2500
    assert s["totals"]["total_outflow"] == 920
    assert s["spending_breakdown"]["rent_mortgage"] == 800
    assert s["spending_breakdown"]["groceries_food"] == 120
    assert s["income_breakdown"]["salary_income"] == 2500
    assert s["runway_months"] is not None
    assert s["runway_months"] > 0


def test_build_account_summaries_credit_no_runway():
    data = {
        "statements": [
            {
                "account_id": "card_1",
                "account": {"account_type": "CREDIT"},
                "balance": {"current": 1200},
                "transactions": [
                    {"timestamp": "2026-02-01T00:00:00Z", "amount": -500, "transaction_type": "DEBIT", "description": "SHOP"},
                    {"timestamp": "2026-02-15T00:00:00Z", "amount": 400, "transaction_type": "CREDIT", "description": "DIRECT DEBIT PAYMENT", "transaction_category": "PAYMENT"},
                ],
            }
        ]
    }
    summaries = build_account_summaries(data)
    assert len(summaries) == 1
    s = summaries[0]
    assert s["account_type"] == "CREDIT"
    assert s["runway_months"] is None
    assert s["income_breakdown"]["repayments_in"] == 400
    assert any("Credit-card" in w or "runway" in w for w in (s["warnings"] or []))


def test_format_summary_for_display_includes_window_and_runway():
    data = {
        "statements": [
            {
                "account_id": "acc_1",
                "account_type": "CURRENT",
                "currency": "GBP",
                "balance": [{"current": 1000, "available": 1000}],
                "transactions": [
                    {"timestamp": "2026-02-20T00:00:00Z", "amount": -500, "transaction_type": "DEBIT", "description": "OTHER"},
                ],
            }
        ]
    }
    summaries = build_account_summaries(data)
    text = format_summary_for_display(summaries)
    assert "30d window:" in text
    assert "Runway:" in text
    assert "What this balance represents" in text
    assert "Outstanding" not in text  # CURRENT account


def test_format_summary_empty():
    assert "No accounts" in format_summary_for_display([])


def test_open_banking_shape_accounts():
    """Support data.accounts (OpenBanking) as well as data.statements."""
    data = {
        "accounts": [
            {
                "account_id": "ob_1",
                "currency": "GBP",
                "balance": [{"current": 50, "available": 50}],
                "transactions": [
                    {"timestamp": "2026-02-01T00:00:00Z", "amount": -50, "transaction_type": "DEBIT", "description": "COFFEE"},
                ],
            }
        ]
    }
    summaries = build_account_summaries(data)
    assert len(summaries) == 1
    assert summaries[0]["account_id"] == "ob_1"
    assert summaries[0]["totals"]["total_outflow"] == 50


if __name__ == "__main__":
    test_build_account_summaries_current()
    test_build_account_summaries_credit_no_runway()
    test_format_summary_for_display_includes_window_and_runway()
    test_format_summary_empty()
    test_open_banking_shape_accounts()
    print("All tests passed.")
