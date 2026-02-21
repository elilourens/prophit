#!/bin/bash
# Simple script to run the FastAPI server

echo "Starting Prophit Finance API..."
echo "Server will be available at http://localhost:8000"
echo "API docs at http://localhost:8000/docs"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
