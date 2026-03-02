"""
SurakshaFlow — Backend Configuration
Loads environment variables and initializes Firebase Admin SDK.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Load .env from backend directory
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

# ── Feature Flags ──────────────────────────────────────────────
ENABLE_GRAPH_ANALYTICS: bool = os.getenv("ENABLE_GRAPH_ANALYTICS", "true").lower() == "true"
ENABLE_DIGITAL_TWIN: bool = os.getenv("ENABLE_DIGITAL_TWIN", "true").lower() == "true"
ENABLE_GEMINI: bool = os.getenv("ENABLE_GEMINI", "true").lower() == "true"

# ── Gemini ─────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Server ─────────────────────────────────────────────────────
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

# ── Firebase Admin ─────────────────────────────────────────────
_firebase_app = None
_firestore_client = None


def get_firebase_app():
    """Lazy-initialize Firebase Admin SDK."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    project_id = os.getenv("FIREBASE_PROJECT_ID", "")

    if sa_path and Path(sa_path).exists():
        cred = credentials.Certificate(sa_path)
        _firebase_app = firebase_admin.initialize_app(cred)
    elif project_id:
        # Use application-default credentials (e.g. on GCP)
        _firebase_app = firebase_admin.initialize_app(options={"projectId": project_id})
    else:
        # Fallback: init with no credentials (will use emulator or fail gracefully)
        try:
            _firebase_app = firebase_admin.initialize_app()
        except ValueError:
            _firebase_app = firebase_admin.get_app()

    return _firebase_app


def get_firestore_client() -> firestore.firestore.Client:
    """Get Firestore client, initializing Firebase if needed."""
    global _firestore_client
    if _firestore_client is None:
        get_firebase_app()
        _firestore_client = firestore.client()
    return _firestore_client
