"""
SurakshaFlow — Firestore Demo Data Seeder
Seeds Firestore with realistic demo data for the full attack chain scenario.

Usage:
  python -m app.data_generator.seed_firestore          # Seed data
  python -m app.data_generator.seed_firestore --clean   # Wipe & re-seed
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.config import get_firestore_client
from app.services.firestore_service import clear_all_collections
from app.data_generator.scenarios import (
    generate_users,
    generate_cyber_events,
    generate_financial_transactions,
    generate_alerts,
    generate_risk_events,
)


def seed_firestore(clean: bool = False):
    """Write all demo data to Firestore."""
    db = get_firestore_client()
    print("🔌 Connected to Firestore")

    if clean:
        print("🧹 Cleaning all collections...")
        clear_all_collections()
        print("   ✓ All collections cleared")

    # ── Users ─────────────────────────────────────────────────
    users = generate_users()
    print(f"👤 Seeding {len(users)} users...")
    for user in users:
        db.collection("users").document(user.id).set(user.model_dump(mode="json"))
    print("   ✓ Users seeded")

    # ── Cyber Events ──────────────────────────────────────────
    events = generate_cyber_events()
    print(f"🛡️  Seeding {len(events)} cyber events...")
    for event in events:
        db.collection("cyber_events").document(event.id).set(event.model_dump(mode="json"))
    print("   ✓ Cyber events seeded")

    # ── Financial Transactions ────────────────────────────────
    txns = generate_financial_transactions()
    print(f"💰 Seeding {len(txns)} financial transactions...")
    for tx in txns:
        db.collection("financial_transactions").document(tx.id).set(tx.model_dump(mode="json"))
    print("   ✓ Financial transactions seeded")

    # ── Risk Events ───────────────────────────────────────────
    risk_events = generate_risk_events()
    print(f"⚠️  Seeding {len(risk_events)} risk events...")
    for re in risk_events:
        db.collection("risk_events").document(re.id).set(re.model_dump(mode="json"))
    print("   ✓ Risk events seeded")

    # ── Alerts ────────────────────────────────────────────────
    alerts = generate_alerts()
    print(f"🚨 Seeding {len(alerts)} alerts...")
    for alert in alerts:
        data = alert.model_dump(mode="json")
        # Flatten nested models for Firestore
        data["cyber_events"] = [e.model_dump(mode="json") for e in alert.cyber_events]
        data["financial_transactions"] = [t.model_dump(mode="json") for t in alert.financial_transactions]
        db.collection("alerts").document(alert.id).set(data)
    print("   ✓ Alerts seeded")

    print("\n✅ Firestore seeding complete!")
    print(f"   Users: {len(users)}")
    print(f"   Cyber Events: {len(events)}")
    print(f"   Transactions: {len(txns)}")
    print(f"   Risk Events: {len(risk_events)}")
    print(f"   Alerts: {len(alerts)}")


if __name__ == "__main__":
    clean = "--clean" in sys.argv
    seed_firestore(clean=clean)
