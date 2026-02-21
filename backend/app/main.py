"""FastAPI main application."""
import csv
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from app.config import settings
from app.models.transaction import Transaction, TransactionCreate
from app.models.summary import (
    SummaryRunRequest,
    SummaryRunResponse,
    UploadResponse,
    JudgeOutput,
    SamplingStats,
    DebugInfo,
)
from app.storage.database import get_db
from app.services.sampling import TransactionSampler
from app.services.features import FeatureExtractor
from app.services.prompts import PromptBuilder
from app.services.summarization import SummarizationService
from app.services.judge import JudgeService
from app.utils.privacy import obfuscate_transactions

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
    
    Expected CSV format:
    timestamp,amount,currency,description,category,balance_after
    
    Expected JSON format:
    [{"timestamp": "...", "amount": ..., ...}, ...]
    """
    transaction_store, _ = get_db()
    
    try:
        content = await file.read()
        text_content = content.decode("utf-8")
        
        transactions = []
        
        if file.filename.endswith(".csv"):
            # Parse CSV
            reader = csv.DictReader(text_content.splitlines())
            for row in reader:
                try:
                    tx = TransactionCreate(
                        user_id=user_id,
                        timestamp=datetime.fromisoformat(row["timestamp"]),
                        amount=float(row["amount"]),
                        currency=row.get("currency", "USD"),
                        description=row["description"],
                        category=row.get("category"),
                        balance_after=float(row["balance_after"]) if row.get("balance_after") else None,
                    )
                    transactions.append(tx)
                except Exception as e:
                    # Skip invalid rows
                    print(f"Skipping invalid row: {e}")
                    continue
        
        elif file.filename.endswith(".json"):
            # Parse JSON
            data = json.loads(text_content)
            for item in data:
                try:
                    tx = TransactionCreate(
                        user_id=user_id,
                        timestamp=datetime.fromisoformat(item["timestamp"]),
                        amount=float(item["amount"]),
                        currency=item.get("currency", "USD"),
                        description=item["description"],
                        category=item.get("category"),
                        balance_after=float(item["balance_after"]) if item.get("balance_after") else None,
                    )
                    transactions.append(tx)
                except Exception as e:
                    print(f"Skipping invalid item: {e}")
                    continue
        else:
            raise HTTPException(status_code=400, detail="File must be CSV or JSON")
        
        if not transactions:
            raise HTTPException(status_code=400, detail="No valid transactions found in file")
        
        # Store transactions
        count = transaction_store.add_transactions(transactions)
        
        # Get date range
        stats = transaction_store.get_transaction_stats(user_id)
        
        return UploadResponse(
            user_id=user_id,
            transaction_count=count,
            date_range_start=stats.get("date_range_start"),
            date_range_end=stats.get("date_range_end"),
            message=f"Successfully uploaded {count} transactions",
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/summaries/run", response_model=SummaryRunResponse)
async def run_summarization(request: SummaryRunRequest):
    """
    Run the summarization pipeline:
    1. Sample transactions
    2. Extract features
    3. Generate summaries from multiple LLMs
    4. Judge and select best summaries
    """
    transaction_store, summary_store = get_db()
    
    # Get transactions
    cutoff_date = datetime.utcnow() - timedelta(days=request.window_days)
    transactions = transaction_store.get_transactions(
        request.user_id,
        start_date=cutoff_date,
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
    sampled_transactions, sampling_stats = sampler.sample(transactions, request.window_days)
    
    # Extract features
    aggregations = feature_extractor.extract_aggregations(sampled_transactions)
    balance_health = feature_extractor.extract_balance_health(sampled_transactions)
    
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
