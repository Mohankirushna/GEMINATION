/**
 * SurakshaFlow — User Firestore Service
 * Provides Firestore persistence for end-user dashboard data with
 * graceful fallback to REST API / mock data when Firestore is unavailable.
 *
 * Collections:
 *   user_risk_snapshots/{accountId}  — latest risk scores per user
 *   user_transactions/{docId}       — financial transactions for users
 *   user_cyber_events/{docId}       — device/login events for users
 *   user_live_events/{docId}        — live simulation event history
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  Timestamp,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { getDbInstance, isFirebaseConfigured } from "./firebase";
import type {
  CyberEvent,
  FinancialTransaction,
  UserRiskResponse,
} from "../types";
import type { UserLiveEvent } from "./api";

// ── Helpers ──────────────────────────────────────────────────

function getDb() {
  if (!isFirebaseConfigured()) return null;
  return getDbInstance();
}

/** Returns true if Firestore is available and writable */
export function isFirestoreAvailable(): boolean {
  return !!getDb();
}

// ── Collection Names ─────────────────────────────────────────

const COLLECTIONS = {
  RISK_SNAPSHOTS: "user_risk_snapshots",
  TRANSACTIONS: "user_transactions",
  CYBER_EVENTS: "user_cyber_events",
  LIVE_EVENTS: "user_live_events",
} as const;

// ── Write Operations ─────────────────────────────────────────

/** Save a risk snapshot for an account (upserts by accountId) */
export async function saveRiskSnapshot(
  accountId: string,
  risk: UserRiskResponse
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await setDoc(doc(db, COLLECTIONS.RISK_SNAPSHOTS, accountId), {
      ...risk,
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn("Failed to save risk snapshot to Firestore:", e);
    return false;
  }
}

/** Save a cyber event */
export async function saveCyberEvent(
  event: CyberEvent
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await setDoc(doc(db, COLLECTIONS.CYBER_EVENTS, event.id), {
      id: event.id,
      timestamp: event.timestamp,
      event_type: event.event_type || event.type,
      device_id: event.device_id || event.deviceId,
      ip_geo: event.ip_geo || event.ipLocation,
      account_id: event.account_id || event.accountId,
      anomaly_score: event.anomaly_score ?? event.riskScore,
      raw_signals: event.raw_signals || null,
      created_at: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn("Failed to save cyber event to Firestore:", e);
    return false;
  }
}

/** Save a financial transaction */
export async function saveTransaction(
  tx: FinancialTransaction
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, tx.id), {
      id: tx.id,
      timestamp: tx.timestamp,
      sender: tx.sender || tx.senderId,
      receiver: tx.receiver || tx.receiverId,
      amount: tx.amount,
      method: tx.method || tx.type,
      velocity_score: tx.velocity_score ?? tx.riskScore,
      risk_flags: tx.risk_flags || [],
      created_at: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn("Failed to save transaction to Firestore:", e);
    return false;
  }
}

/** Save a live simulation event */
export async function saveLiveEvent(
  event: UserLiveEvent
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const docId = `${event.account_id}_tick_${event.tick}`;
    await setDoc(doc(db, COLLECTIONS.LIVE_EVENTS, docId), {
      tick: event.tick,
      timestamp: event.timestamp,
      account_id: event.account_id,
      is_anomaly: event.is_anomaly,
      risk_scores: event.risk_scores,
      risk_level: event.risk_level,
      changes: event.changes,
      warnings: event.warnings,
      procedures: event.procedures,
      gemini_analysis: event.gemini_analysis || null,
      created_at: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn("Failed to save live event to Firestore:", e);
    return false;
  }
}

// ── Read Operations ──────────────────────────────────────────

/** Get the latest risk snapshot for an account */
export async function getRiskSnapshot(
  accountId: string
): Promise<UserRiskResponse | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.RISK_SNAPSHOTS, accountId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      account_id: d.account_id ?? accountId,
      unified_score: d.unified_score ?? 0,
      cyber_score: d.cyber_score ?? 0,
      financial_score: d.financial_score ?? 0,
      graph_score: d.graph_score ?? 0,
      risk_level: d.risk_level ?? "low",
      explanation: d.explanation,
      recommended_action: d.recommended_action,
    };
  } catch (e) {
    console.warn("Failed to read risk snapshot from Firestore:", e);
    return null;
  }
}

/** Get recent cyber events for an account from Firestore */
export async function getCyberEvents(
  accountId: string,
  maxResults = 20
): Promise<CyberEvent[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const q = query(
      collection(db, COLLECTIONS.CYBER_EVENTS),
      where("account_id", "==", accountId),
      orderBy("created_at", "desc"),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id ?? d.id,
        timestamp: data.timestamp ?? "",
        type: data.event_type ?? "login",
        event_type: data.event_type,
        deviceId: data.device_id ?? "",
        device_id: data.device_id,
        ipLocation: data.ip_geo ?? "",
        ip_geo: data.ip_geo,
        accountId: data.account_id ?? accountId,
        account_id: data.account_id,
        riskScore: data.anomaly_score ?? 0,
        anomaly_score: data.anomaly_score,
        raw_signals: data.raw_signals,
      } as CyberEvent;
    });
  } catch (e) {
    console.warn("Failed to read cyber events from Firestore:", e);
    return [];
  }
}

/** Get recent transactions for an account */
export async function getTransactions(
  accountId: string,
  maxResults = 20
): Promise<FinancialTransaction[]> {
  const db = getDb();
  if (!db) return [];
  try {
    // Query transactions where user is sender
    const senderQ = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where("sender", "==", accountId),
      orderBy("created_at", "desc"),
      limit(maxResults)
    );
    const senderSnap = await getDocs(senderQ);

    const txMap = new Map<string, FinancialTransaction>();
    senderSnap.docs.forEach((d) => {
      const data = d.data();
      txMap.set(d.id, {
        id: data.id ?? d.id,
        timestamp: data.timestamp ?? "",
        senderId: data.sender ?? "",
        sender: data.sender,
        receiverId: data.receiver ?? "",
        receiver: data.receiver,
        amount: data.amount ?? 0,
        type: data.method ?? "upi",
        method: data.method,
        riskScore: data.velocity_score ?? 0,
        velocity_score: data.velocity_score,
        risk_flags: data.risk_flags,
      } as FinancialTransaction);
    });

    return Array.from(txMap.values()).slice(0, maxResults);
  } catch (e) {
    console.warn("Failed to read transactions from Firestore:", e);
    return [];
  }
}

// ── Real-time Listeners ──────────────────────────────────────

/** Hook: listen to risk snapshot changes for an account */
export function useFirestoreRisk(accountId: string) {
  const [risk, setRisk] = useState<UserRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [firestoreOk, setFirestoreOk] = useState(false);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      setFirestoreOk(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, COLLECTIONS.RISK_SNAPSHOTS, accountId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setRisk({
            account_id: d.account_id ?? accountId,
            unified_score: d.unified_score ?? 0,
            cyber_score: d.cyber_score ?? 0,
            financial_score: d.financial_score ?? 0,
            graph_score: d.graph_score ?? 0,
            risk_level: d.risk_level ?? "low",
            explanation: d.explanation,
            recommended_action: d.recommended_action,
          });
        }
        setLoading(false);
        setFirestoreOk(true);
      },
      (err) => {
        console.warn("Firestore risk listener error:", err.message);
        setFirestoreOk(false);
        setLoading(false);
      }
    );

    return unsub;
  }, [accountId]);

  return { risk, loading, firestoreOk };
}

/** Hook: listen to recent cyber events */
export function useFirestoreCyberEvents(accountId: string, maxResults = 8) {
  const [events, setEvents] = useState<CyberEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [firestoreOk, setFirestoreOk] = useState(false);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      setFirestoreOk(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.CYBER_EVENTS),
      where("account_id", "==", accountId),
      orderBy("created_at", "desc"),
      limit(maxResults)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const dd = d.data();
          return {
            id: dd.id ?? d.id,
            timestamp: dd.timestamp ?? "",
            type: dd.event_type ?? "login",
            event_type: dd.event_type,
            deviceId: dd.device_id ?? "",
            device_id: dd.device_id,
            ipLocation: dd.ip_geo ?? "",
            ip_geo: dd.ip_geo,
            accountId: dd.account_id ?? accountId,
            account_id: dd.account_id,
            riskScore: dd.anomaly_score ?? 0,
            anomaly_score: dd.anomaly_score,
            raw_signals: dd.raw_signals,
          } as CyberEvent;
        });
        setEvents(data);
        setLoading(false);
        setFirestoreOk(true);
      },
      (err) => {
        console.warn("Firestore cyber events listener error:", err.message);
        setFirestoreOk(false);
        setLoading(false);
      }
    );

    return unsub;
  }, [accountId, maxResults]);

  return { events, loading, firestoreOk };
}

/** Hook: listen to recent transactions */
export function useFirestoreTransactions(accountId: string, maxResults = 8) {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [firestoreOk, setFirestoreOk] = useState(false);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      setFirestoreOk(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where("sender", "==", accountId),
      orderBy("created_at", "desc"),
      limit(maxResults)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const dd = d.data();
          return {
            id: dd.id ?? d.id,
            timestamp: dd.timestamp ?? "",
            senderId: dd.sender ?? "",
            sender: dd.sender,
            receiverId: dd.receiver ?? "",
            receiver: dd.receiver,
            amount: dd.amount ?? 0,
            type: dd.method ?? "upi",
            method: dd.method,
            riskScore: dd.velocity_score ?? 0,
            velocity_score: dd.velocity_score,
            risk_flags: dd.risk_flags,
          } as FinancialTransaction;
        });
        setTransactions(data);
        setLoading(false);
        setFirestoreOk(true);
      },
      (err) => {
        console.warn("Firestore transactions listener error:", err.message);
        setFirestoreOk(false);
        setLoading(false);
      }
    );

    return unsub;
  }, [accountId, maxResults]);

  return { transactions, loading, firestoreOk };
}

// ── Seed Initial Data ────────────────────────────────────────

/** Seed demo user data to Firestore collections */
export async function seedUserDataToFirestore(
  accountId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    // Create initial risk snapshot
    await saveRiskSnapshot(accountId, {
      account_id: accountId,
      unified_score: 0.15,
      cyber_score: 0.1,
      financial_score: 0.05,
      graph_score: 0.03,
      risk_level: "low",
      explanation: "Your account is secure. No unusual activity detected.",
    });

    // Seed some initial transactions
    const demoTxns = [
      {
        id: `tx_${accountId}_1`,
        timestamp: new Date().toISOString(),
        sender: accountId,
        receiver: "merchant_grocery",
        amount: 150,
        method: "upi",
        velocity_score: 0.02,
        risk_flags: [],
      },
      {
        id: `tx_${accountId}_2`,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        sender: accountId,
        receiver: "merchant_recharge",
        amount: 499,
        method: "upi",
        velocity_score: 0.05,
        risk_flags: [],
      },
      {
        id: `tx_${accountId}_3`,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        sender: accountId,
        receiver: "merchant_food",
        amount: 320,
        method: "upi",
        velocity_score: 0.01,
        risk_flags: [],
      },
    ];

    for (const tx of demoTxns) {
      await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, tx.id), {
        ...tx,
        created_at: serverTimestamp(),
      });
    }

    // Seed initial cyber events
    const demoCyber = [
      {
        id: `ce_${accountId}_1`,
        timestamp: new Date().toISOString(),
        event_type: "login",
        device_id: `dev_${accountId}_primary`,
        ip_geo: "Bengaluru, IN",
        account_id: accountId,
        anomaly_score: 0.03,
      },
      {
        id: `ce_${accountId}_2`,
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        event_type: "login",
        device_id: `dev_${accountId}_primary`,
        ip_geo: "Bengaluru, IN",
        account_id: accountId,
        anomaly_score: 0.02,
      },
    ];

    for (const ce of demoCyber) {
      await setDoc(doc(db, COLLECTIONS.CYBER_EVENTS, ce.id), {
        ...ce,
        created_at: serverTimestamp(),
      });
    }

    return true;
  } catch (e) {
    console.warn("Failed to seed user data to Firestore:", e);
    return false;
  }
}
