"""
SurakshaFlow — TimeSeries Database
Persistent storage for all simulation ticks (1-90+) with full event history.
Supports querying by tick range, account, and time intervals.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────
DATA_DIR = Path(__file__).parent.parent.parent / "data"
TIMESERIES_FILE = DATA_DIR / "timeseries_db.json"
MAX_TICKS = 90  # Store exactly 90 ticks as requested

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── In-Memory Cache ────────────────────────────────────────────
_timeseries_cache: Dict[int, dict] = {}
_current_tick: int = 0


def _load_db() -> Dict[int, dict]:
    """Load timeseries database from disk."""
    if TIMESERIES_FILE.exists():
        try:
            with open(TIMESERIES_FILE, 'r') as f:
                data = json.load(f)
                # Convert string keys back to integers
                return {int(k): v for k, v in data.items()}
        except Exception:
            return {}
    return {}


def _save_db(data: Dict[int, dict]) -> None:
    """Save timeseries database to disk."""
    try:
        with open(TIMESERIES_FILE, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        print(f"Warning: Failed to save timeseries DB: {e}")


def store_tick_event(tick: int, event_data: dict) -> None:
    """
    Store a single tick event in the timeseries database.
    Maintains exactly MAX_TICKS (90) entries in chronological order.
    """
    global _timeseries_cache, _current_tick
    
    # Ensure tick is within valid range
    if tick < 1 or tick > MAX_TICKS:
        return
    
    # Load from disk if cache is empty
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    # Store the event with metadata
    event_record = {
        "tick": tick,
        "timestamp": datetime.utcnow().isoformat(),
        "scenario_type": event_data.get("scenario_type", "unknown"),
        "is_suspicious": event_data.get("is_suspicious", False),
        "unified_score": event_data.get("risk_scores", {}).get("unified_score", 0),
        "cyber_score": event_data.get("risk_scores", {}).get("cyber_score", 0),
        "financial_score": event_data.get("risk_scores", {}).get("financial_score", 0),
        "graph_score": event_data.get("risk_scores", {}).get("graph_score", 0),
        "changes": event_data.get("changes", []),
        "cyber_event": event_data.get("cyber_event"),
        "transaction": event_data.get("transaction"),
        "alert": event_data.get("alert"),
        "gemini_analysis": event_data.get("gemini_analysis"),
        "accounts_involved": _extract_accounts(event_data),
    }
    
    _timeseries_cache[tick] = event_record
    _current_tick = tick
    
    # If we've reached MAX_TICKS, persist to disk
    if tick >= MAX_TICKS or tick % 10 == 0:
        _save_db(_timeseries_cache)


def _extract_accounts(event_data: dict) -> List[str]:
    """Extract all account IDs involved in this tick."""
    accounts = set()
    
    # From cyber event
    ce = event_data.get("cyber_event", {})
    if ce.get("account_id"):
        accounts.add(ce["account_id"])
    
    # From transaction
    tx = event_data.get("transaction", {})
    if tx.get("sender"):
        accounts.add(tx["sender"])
    if tx.get("receiver"):
        accounts.add(tx["receiver"])
    
    # From alert (handle None case)
    alert = event_data.get("alert") or {}
    for acc in alert.get("accounts_flagged", []):
        accounts.add(acc)
    
    return list(accounts)


def get_tick(tick: int) -> Optional[dict]:
    """Retrieve a specific tick by number (1-90)."""
    if tick < 1 or tick > MAX_TICKS:
        return None
    
    global _timeseries_cache
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    return _timeseries_cache.get(tick)


def get_tick_range(start: int, end: int) -> List[dict]:
    """Get all ticks in a range [start, end]."""
    global _timeseries_cache
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    start = max(1, start)
    end = min(MAX_TICKS, end)
    
    return [_timeseries_cache.get(tick) for tick in range(start, end + 1) 
            if tick in _timeseries_cache]


def get_all_ticks() -> List[dict]:
    """Get all stored ticks in chronological order."""
    global _timeseries_cache
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    return [v for k, v in sorted(_timeseries_cache.items())]


def get_ticks_by_account(account_id: str) -> List[dict]:
    """Get all ticks where a specific account was involved."""
    global _timeseries_cache
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    return [tick for tick in _timeseries_cache.values() 
            if account_id in tick.get("accounts_involved", [])]


def get_suspicious_ticks(threshold: float = 0.7) -> List[dict]:
    """Get all ticks with unified risk score above threshold."""
    global _timeseries_cache
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    return [tick for tick in _timeseries_cache.values() 
            if tick.get("unified_score", 0) >= threshold]


def get_current_tick_number() -> int:
    """Get the current/latest tick number."""
    return _current_tick


def reset_database() -> None:
    """Clear all timeseries data (use with caution)."""
    global _timeseries_cache, _current_tick
    _timeseries_cache = {}
    _current_tick = 0
    if TIMESERIES_FILE.exists():
        TIMESERIES_FILE.unlink()


def get_timeseries_stats() -> dict:
    """Get statistics about the timeseries database."""
    global _timeseries_cache
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    ticks = list(_timeseries_cache.values())
    if not ticks:
        return {"total_ticks": 0, "suspicious_events": 0, "avg_risk": 0}
    
    suspicious = sum(1 for t in ticks if t.get("unified_score", 0) >= 0.7)
    avg_risk = sum(t.get("unified_score", 0) for t in ticks) / len(ticks)
    
    return {
        "total_ticks": len(ticks),
        "suspicious_events": suspicious,
        "avg_risk": round(avg_risk, 3),
        "ticks_with_gemini": sum(1 for t in ticks if t.get("gemini_analysis")),
    }


def export_timeseries(format: str = "json") -> str:
    """Export the entire timeseries as JSON string."""
    global _timeseries_cache
    if not _timeseries_cache:
        _timeseries_cache = _load_db()
    
    if format == "json":
        return json.dumps(get_all_ticks(), indent=2, default=str)
    return ""


# Initialize on module load
_timeseries_cache = _load_db()
if _timeseries_cache:
    _current_tick = max(_timeseries_cache.keys())
