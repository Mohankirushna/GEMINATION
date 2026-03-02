"""
SurakshaFlow — Cyber Risk Engine
Scores accounts based on device fingerprint anomalies, impossible travel,
login velocity, and phishing indicators.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import timedelta
from typing import List

from ..models import CyberEvent

# Approximate geo-coordinates for Indian cities (lat, lon)
_CITY_COORDS: dict[str, tuple[float, float]] = {
    "Mumbai, IN": (19.076, 72.8777),
    "Delhi, IN": (28.6139, 77.2090),
    "Bengaluru, IN": (12.9716, 77.5946),
    "Chennai, IN": (13.0827, 80.2707),
    "Kolkata, IN": (22.5726, 88.3639),
    "Hyderabad, IN": (17.3850, 78.4867),
    "Pune, IN": (18.5204, 73.8567),
    "Ahmedabad, IN": (23.0225, 72.5714),
    "Jaipur, IN": (26.9124, 75.7873),
    "Lucknow, IN": (26.8467, 80.9462),
}


def _haversine_km(c1: tuple[float, float], c2: tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lon) pairs in km."""
    lat1, lon1 = math.radians(c1[0]), math.radians(c1[1])
    lat2, lon2 = math.radians(c2[0]), math.radians(c2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _device_reuse_score(events: List[CyberEvent]) -> float:
    """Score how many distinct accounts share the same device_id."""
    device_accounts: dict[str, set[str]] = defaultdict(set)
    for e in events:
        device_accounts[e.device_id].add(e.account_id)

    if not device_accounts:
        return 0.0

    max_shared = max(len(accs) for accs in device_accounts.values())
    # 1 account = 0, 2 = 0.5, 3+ = 0.8–1.0
    if max_shared <= 1:
        return 0.0
    return min(1.0, 0.3 + 0.25 * (max_shared - 1))


def _impossible_travel_score(events: List[CyberEvent]) -> float:
    """Detect logins from geographically distant locations within short time."""
    sorted_events = sorted(events, key=lambda e: e.timestamp)
    max_score = 0.0

    for i in range(len(sorted_events) - 1):
        e1, e2 = sorted_events[i], sorted_events[i + 1]
        c1 = _CITY_COORDS.get(e1.ip_geo)
        c2 = _CITY_COORDS.get(e2.ip_geo)

        if not c1 or not c2 or e1.ip_geo == e2.ip_geo:
            continue

        dist_km = _haversine_km(c1, c2)
        time_hours = (e2.timestamp - e1.timestamp).total_seconds() / 3600.0

        if time_hours <= 0:
            time_hours = 0.01  # avoid division by zero

        # Speed in km/h — anything > 900 km/h is impossible (flight speed ~800)
        speed = dist_km / time_hours
        if speed > 400:
            score = min(1.0, speed / 1000.0)
            max_score = max(max_score, score)

    return max_score


def _login_velocity_score(events: List[CyberEvent]) -> float:
    """Score rapid login attempts within a short window."""
    login_events = [e for e in events if e.event_type.value in ("login", "new_device")]
    if len(login_events) < 2:
        return 0.0

    sorted_logins = sorted(login_events, key=lambda e: e.timestamp)

    # Count logins in rolling 5-minute windows
    max_count = 0
    window = timedelta(minutes=5)
    for i, event in enumerate(sorted_logins):
        count = sum(
            1 for j in range(i, len(sorted_logins))
            if sorted_logins[j].timestamp - event.timestamp <= window
        )
        max_count = max(max_count, count)

    # 1 login = 0, 2 = 0.3, 3 = 0.6, 4+ = 0.8–1.0
    if max_count <= 1:
        return 0.0
    return min(1.0, 0.15 + 0.2 * (max_count - 1))


def _phishing_indicator_score(events: List[CyberEvent]) -> float:
    """Check for phishing event types and raw signal indicators."""
    phishing_count = 0
    for e in events:
        if e.event_type.value == "phishing":
            phishing_count += 1
        # Check raw_signals for phishing indicators
        if e.raw_signals.get("phishing_link"):
            phishing_count += 1
        if e.raw_signals.get("malware_callback"):
            phishing_count += 0.5

    if phishing_count == 0:
        return 0.0
    return min(1.0, 0.5 + 0.2 * phishing_count)


def compute_cyber_score(events: List[CyberEvent]) -> float:
    """
    Compute the unified cyber risk score for an account.

    Weights:
      device_reuse  = 0.30
      impossible_travel = 0.30
      login_velocity = 0.25
      phishing = 0.15

    Returns: float in [0, 1]
    """
    if not events:
        return 0.0

    dr = _device_reuse_score(events)
    it = _impossible_travel_score(events)
    lv = _login_velocity_score(events)
    ph = _phishing_indicator_score(events)

    score = 0.30 * dr + 0.30 * it + 0.25 * lv + 0.15 * ph
    return round(min(1.0, max(0.0, score)), 4)


def compute_cyber_score_detailed(events: List[CyberEvent]) -> dict:
    """Return the cyber score with individual factor breakdown."""
    dr = _device_reuse_score(events)
    it = _impossible_travel_score(events)
    lv = _login_velocity_score(events)
    ph = _phishing_indicator_score(events)

    score = 0.30 * dr + 0.30 * it + 0.25 * lv + 0.15 * ph
    return {
        "cyber_score": round(min(1.0, max(0.0, score)), 4),
        "factors": {
            "device_reuse": round(dr, 4),
            "impossible_travel": round(it, 4),
            "login_velocity": round(lv, 4),
            "phishing_indicator": round(ph, 4),
        },
    }
