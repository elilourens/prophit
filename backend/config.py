"""TrueLayer configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("TRUELAYER_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("TRUELAYER_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("TRUELAYER_REDIRECT_URI", "http://localhost:8000/callback")
AUTH_BASE = os.getenv("TRUELAYER_AUTH_BASE", "https://auth.truelayer-sandbox.com")
API_BASE = os.getenv("TRUELAYER_API_BASE", "https://api.truelayer-sandbox.com")

# Scopes requested during auth — covers all Data API endpoints
SCOPES = "info accounts balance transactions cards offline_access"

# Token exchange endpoint
TOKEN_URL = f"{AUTH_BASE}/connect/token"

# Data API base
DATA_API = f"{API_BASE}/data/v1"
