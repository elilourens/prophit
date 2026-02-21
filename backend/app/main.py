"""FastAPI main application."""
import csv
import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from app.config import settings
from app.models.transaction import Transaction, TransactionCreate
from app.models.summary import (
    SummaryRunRequest,
    SummaryRunResponse,
    UploadResponse,
    OpenBankingUploadResponse,
    JudgeOutput,
    SamplingStats,
    DebugInfo,
)
from app.models.openbanking import OpenBankingExport, OBTransaction
from app.storage.database import get_db
from app.services.sampling import TransactionSampler
from app.services.features import FeatureExtractor
from app.services.prompts import PromptBuilder
from app.services.summarization import SummarizationService
from app.services.judge import JudgeService
from app.utils.privacy import obfuscate_transactions, obfuscate_merchant
from app.utils.timestamp import parse_timestamp

app = FastAPI(title=settings.app_name, debug=settings.debug)

# Initialize services
summarization_service = SummarizationService()
judge_service = JudgeService()
feature_extractor = FeatureExtractor()
prompt_builder = PromptBuilder()


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Prophit Finance API", "version": "1.0.0"}


@app.post("/transactions/upload", response_model=UploadResponse)
async def upload_transactions(
    file: UploadFile = File(...),
    user_id: str = Query(..., description="User identifier"),
):
    """
    Upload transactions from CSV or JSON file.
    
    Required CSV columns: timestamp, amount, currency, description
    Optional CSV columns: category, balance_after
    
    Accepted timestamp formats:
    - ISO with Z: "2024-01-02T09:10:00Z"
    - ISO with timezone: "2024-01-02T09:10:00+00:00"
    - ISO without timezone: "2024-01-02T09:10:00"
    - Space-separated: "2024-01-02 09:10:00"
    
    Expected JSON format:
    [{"timestamp": "...", "amount": ..., "currency": "...", "description": "...", ...}, ...]
    """
    transaction_store, _ = get_db()
    
    try:
        content = await file.read()
        text_content = content.decode("utf-8")
        
        transactions = []
        invalid_rows = []
        invalid_count = 0
        
        if file.filename.endswith(".csv"):
            # Parse CSV
            reader = csv.DictReader(text_content.splitlines())
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (row 1 is header)
                try:
                    # Validate required fields
                    if "timestamp" not in row or not row["timestamp"]:
                        raise ValueError("Missing required field: timestamp")
                    if "amount" not in row or not row["amount"]:
                        raise ValueError("Missing required field: amount")
                    if "description" not in row or not row["description"]:
                        raise ValueError("Missing required field: description")
                    
                    tx = TransactionCreate(
                        user_id=user_id,
                        timestamp=parse_timestamp(row["timestamp"]),
                        amount=float(row["amount"]),
                        currency=row.get("currency", "USD"),
                        description=row["description"],
                        category=row.get("category"),
                        balance_after=float(row["balance_after"]) if row.get("balance_after") else None,
                    )
                    transactions.append(tx)
                except Exception as e:
                    invalid_count += 1
                    error_msg = str(e)
                    # Obfuscate merchant names in error messages
                    if "description" in row:
                        obfuscated_desc = obfuscate_merchant(row["description"])
                        error_msg = error_msg.replace(row["description"], obfuscated_desc)
                    if invalid_count <= 5:  # Only store first 5 errors
                        invalid_rows.append(f"Row {row_num}: {error_msg}")
                    continue
        
        elif file.filename.endswith(".json"):
            # Parse JSON
            try:
                data = json.loads(text_content)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid JSON format: {str(e)}"
                )
            
            if not isinstance(data, list):
                raise HTTPException(
                    status_code=400,
                    detail="JSON must be an array of transaction objects"
                )
            
            for item_num, item in enumerate(data, start=1):
                try:
                    # Validate required fields
                    if "timestamp" not in item or not item["timestamp"]:
                        raise ValueError("Missing required field: timestamp")
                    if "amount" not in item:
                        raise ValueError("Missing required field: amount")
                    if "description" not in item or not item["description"]:
                        raise ValueError("Missing required field: description")
                    
                    tx = TransactionCreate(
                        user_id=user_id,
                        timestamp=parse_timestamp(str(item["timestamp"])),
                        amount=float(item["amount"]),
                        currency=item.get("currency", "USD"),
                        description=item["description"],
                        category=item.get("category"),
                        balance_after=float(item["balance_after"]) if item.get("balance_after") else None,
                    )
                    transactions.append(tx)
                except Exception as e:
                    invalid_count += 1
                    error_msg = str(e)
                    # Obfuscate merchant names in error messages
                    if "description" in item:
                        obfuscated_desc = obfuscate_merchant(str(item["description"]))
                        error_msg = error_msg.replace(str(item["description"]), obfuscated_desc)
                    if invalid_count <= 5:  # Only store first 5 errors
                        invalid_rows.append(f"Item {item_num}: {error_msg}")
                    continue
        else:
            raise HTTPException(status_code=400, detail="File must be CSV or JSON")
        
        # Check if we have any valid transactions
        if not transactions:
            error_detail = "No valid transactions found in uploaded file."
            if invalid_count > 0:
                error_detail += f" {invalid_count} row(s) were invalid."
                if invalid_rows:
                    error_detail += " First errors: " + "; ".join(invalid_rows[:3])
            raise HTTPException(status_code=400, detail=error_detail)
        
        # Store transactions
        try:
            count = transaction_store.add_transactions(transactions)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error storing transactions: {str(e)}"
            )
        
        # Get date range
        try:
            stats = transaction_store.get_transaction_stats(user_id)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error retrieving transaction stats: {str(e)}"
            )
        
        message = f"Successfully uploaded {count} transactions"
        if invalid_count > 0:
            message += f" ({invalid_count} invalid row(s) skipped)"
        
        return UploadResponse(
            user_id=user_id,
            transaction_count=count,
            date_range_start=stats.get("date_range_start"),
            date_range_end=stats.get("date_range_end"),
            message=message,
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch any unexpected exceptions and return proper 500
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )


def normalize_openbanking_transaction(
    ob_tx: OBTransaction,
    user_id: str,
) -> TransactionCreate:
    """
    Normalize an Open Banking transaction to our internal Transaction model.
    
    Args:
        ob_tx: Open Banking transaction
        user_id: User identifier
        
    Returns:
        TransactionCreate instance
    """
    # Determine transaction ID
    tx_id = (
        ob_tx.transaction_id
        or ob_tx.normalised_provider_transaction_id
        or ob_tx.provider_transaction_id
    )
    
    # Parse timestamp
    timestamp = parse_timestamp(ob_tx.timestamp)
    
    # Determine category
    category = (
        ob_tx.transaction_category
        or (ob_tx.meta.get("provider_transaction_category") if ob_tx.meta else None)
        or "Other"
    )
    
    # Get balance_after from running_balance
    balance_after = None
    if ob_tx.running_balance:
        balance_after = ob_tx.running_balance.amount
    
    return TransactionCreate(
        id=tx_id,
        user_id=user_id,
        timestamp=timestamp,
        amount=ob_tx.amount,
        currency=ob_tx.currency,
        description=ob_tx.description,
        category=category,
        balance_after=balance_after,
    )


@app.post("/transactions/upload/openbanking", response_model=OpenBankingUploadResponse)
async def upload_openbanking_transactions(
    export: OpenBankingExport,
    user_id: str = Query(..., description="User identifier"),
):
    """
    Upload transactions from Open Banking JSON export.
    
    Accepts Open Banking format with statements containing accounts and transactions.
    Validates structure and normalizes transactions to internal format.
    
    Query Parameters:
    - user_id (required): User identifier
    
    Request Body:
    - Open Banking export JSON with statements array
    """
    transaction_store, _ = get_db()
    
    try:
        # Collect all transactions from all statements
        all_transactions = []
        seen_transaction_ids = set()
        
        for statement in export.statements:
            for ob_tx in statement.transactions:
                # Deduplicate by transaction_id
                tx_id = (
                    ob_tx.transaction_id
                    or ob_tx.normalised_provider_transaction_id
                    or ob_tx.provider_transaction_id
                )
                
                if tx_id and tx_id in seen_transaction_ids:
                    continue  # Skip duplicates
                
                if tx_id:
                    seen_transaction_ids.add(tx_id)
                
                # Normalize to our Transaction model
                tx = normalize_openbanking_transaction(ob_tx, user_id)
                all_transactions.append(tx)
        
        if not all_transactions:
            raise HTTPException(
                status_code=400,
                detail="No transactions found in Open Banking export"
            )
        
        # Store transactions
        count = transaction_store.add_transactions(all_transactions)
        
        # Get date range
        stats = transaction_store.get_transaction_stats(user_id)
        
        # Count unique accounts
        accounts_count = len(export.statements)
        
        message = f"Successfully uploaded {count} transactions from {accounts_count} account(s)"
        
        return OpenBankingUploadResponse(
            user_id=user_id,
            transaction_count=count,
            date_range_start=stats.get("date_range_start"),
            date_range_end=stats.get("date_range_end"),
            accounts_count=accounts_count,
            message=message,
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch any unexpected exceptions and return proper 500
        raise HTTPException(
            status_code=500,
            detail=f"Error processing Open Banking export: {str(e)}"
        )


@app.post("/summaries/run", response_model=SummaryRunResponse)
async def run_summarization(request: SummaryRunRequest):
    """
    Run the summarization pipeline:
    1. Sample transactions
    2. Extract features
    3. Generate summaries from multiple LLMs
    4. Judge and select best summaries
    
    The window is calculated as [as_of - window_days, as_of]. If as_of is not provided,
    it defaults to the current UTC time. This allows testing with historical data by
    specifying an as_of date in the past.
    """
    transaction_store, summary_store = get_db()
    
    # Determine reference date for window calculation
    if request.as_of:
        reference_date = request.as_of
        # Ensure timezone-aware (assume UTC if naive)
        if reference_date.tzinfo is None:
            reference_date = reference_date.replace(tzinfo=timezone.utc)
    else:
        reference_date = datetime.now(timezone.utc)
    
    # Calculate window: [as_of - window_days, as_of]
    start_date = reference_date - timedelta(days=request.window_days)
    end_date = reference_date
    
    # Get transactions within the window
    transactions = transaction_store.get_transactions(
        request.user_id,
        start_date=start_date,
        end_date=end_date,
    )
    
    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for user {request.user_id} in the specified window"
        )
    
    # Sample transactions
    sampler = TransactionSampler(
        top_x=request.top_x,
        stratified_n=request.stratified_n,
        target_char_budget=request.target_char_budget,
    )
    sampled_transactions, sampling_stats = sampler.sample(
        transactions, 
        request.window_days,
        as_of=reference_date,
    )
    
    # Extract features
    aggregations = feature_extractor.extract_aggregations(sampled_transactions)
    balance_health = feature_extractor.extract_balance_health(
        sampled_transactions,
        as_of=reference_date,
    )
    
    # Format for prompt
    transaction_data = feature_extractor.format_for_prompt(
        sampled_transactions,
        aggregations,
        balance_health,
    )
    
    # Build prompts
    daily_prompt = prompt_builder.build_daily_prompt(transaction_data)
    monthly_prompt = prompt_builder.build_monthly_prompt(transaction_data)
    
    # Generate summaries from multiple LLMs
    daily_summaries = await summarization_service.generate_summaries(
        daily_prompt,
        "daily",
        request.llm_models,
    )
    
    monthly_summaries = await summarization_service.generate_summaries(
        monthly_prompt,
        "monthly",
        request.llm_models,
    )
    
    if not daily_summaries:
        raise HTTPException(status_code=500, detail="Failed to generate daily summaries")
    
    if not monthly_summaries:
        raise HTTPException(status_code=500, detail="Failed to generate monthly summaries")
    
    # Judge summaries
    daily_judge = await judge_service.judge_summaries(
        daily_summaries,
        "daily",
        request.judge_model,
    )
    
    monthly_judge = await judge_service.judge_summaries(
        monthly_summaries,
        "monthly",
        request.judge_model,
    )
    
    # Save summaries
    summary_store.save_summary(request.user_id, "daily", daily_judge)
    summary_store.save_summary(request.user_id, "monthly", monthly_judge)
    
    # Build debug info
    debug_info = DebugInfo(
        sampling_stats=SamplingStats(**sampling_stats),
        prompt_sizes={
            "daily": len(daily_prompt),
            "monthly": len(monthly_prompt),
        },
    )
    
    return SummaryRunResponse(
        user_id=request.user_id,
        daily=daily_judge,
        monthly=monthly_judge,
        debug=debug_info,
    )


@app.get("/summaries/latest", response_model=dict)
async def get_latest_summaries(
    user_id: str = Query(..., description="User identifier"),
):
    """
    Get the latest generated summaries for a user.
    """
    _, summary_store = get_db()
    
    daily = summary_store.get_latest_summary(user_id, "daily")
    monthly = summary_store.get_latest_summary(user_id, "monthly")
    
    if not daily and not monthly:
        raise HTTPException(
            status_code=404,
            detail=f"No summaries found for user {user_id}"
        )
    
    return {
        "user_id": user_id,
        "daily": daily.model_dump() if daily else None,
        "monthly": monthly.model_dump() if monthly else None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
