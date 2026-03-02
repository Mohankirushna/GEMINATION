export type UserRole = "end_user" | "financial_institution";

export interface CyberEvent {
  id: string;
  timestamp: string;
  type: "login" | "malware" | "impossible_travel" | "new_device" | "phishing";
  event_type?: string;
  deviceId: string;
  device_id?: string;
  ipLocation: string;
  ip_geo?: string;
  accountId: string;
  account_id?: string;
  riskScore: number;
  anomaly_score?: number;
  raw_signals?: Record<string, any>;
}

export interface FinancialTransaction {
  id: string;
  timestamp: string;
  senderId: string;
  sender?: string;
  receiverId: string;
  receiver?: string;
  amount: number;
  type: "upi" | "neft" | "imps";
  method?: string;
  riskScore: number;
  velocity_score?: number;
  risk_flags?: string[];
}

export interface Alert {
  id: string;
  timestamp: string;
  accountId: string;
  accounts_flagged?: string[];
  unifiedRiskScore: number;
  unified_risk_score?: number;
  cyberEvents: CyberEvent[];
  cyber_events?: CyberEvent[];
  financialTransactions: FinancialTransaction[];
  financial_transactions?: FinancialTransaction[];
  status: "new" | "investigating" | "resolved" | "escalated";
  severity?: "low" | "medium" | "high" | "critical";
  geminiExplanation?: string;
  gemini_explanation?: string;
  recommendedAction?: string;
  recommended_action?: string;
  created_at?: string;
  risk_breakdown?: Record<string, RiskEvent>;
}

export interface RiskEvent {
  id: string;
  account_id: string;
  unified_score: number;
  cyber_score: number;
  financial_score: number;
  graph_score: number;
  explanation: string;
  recommended_action: string;
  created_at?: string;
}

export interface GraphNode {
  id: string;
  type: "account" | "device";
  riskScore: number;
  risk_score?: number;
  label: string;
  node_label?: string;
  degree_centrality?: number;
  betweenness_centrality?: number;
  pagerank?: number;
  community?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "transaction" | "login";
  weight: number;
  timestamp?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DashboardSummary {
  total_alerts: number;
  high_risk_count: number;
  transactions_monitored: number;
  active_mule_rings: number;
  risk_trend: Array<{ time: string; risk: number; alerts?: number }>;
}

export interface UserRiskResponse {
  account_id: string;
  unified_score: number;
  cyber_score: number;
  financial_score: number;
  graph_score: number;
  ml_score?: number;
  risk_level: string;
  explanation?: string;
  recommended_action?: string;
}

export interface GeminiExplanation {
  explanation: string;
  recommendation: string;
  confidence: number;
  key_indicators: string[];
}

export interface SMSAnalysisResult {
  is_scam: boolean;
  confidence: number;
  explanation: string;
  risk_indicators: string[];
}

export interface SimulationResult {
  no_action: {
    downstream_accounts: number;
    total_exposure: number;
    affected_accounts?: string[];
  };
  optimal_action: {
    account_to_freeze: string;
    prevented_loss: number;
    prevented_percentage: number;
    remaining_exposure?: number;
    remaining_downstream?: number;
    disruption_effectiveness?: number;
    money_saved_by_surakshaflow?: number;
    message?: string;
  };
}

export interface STRReportResult {
  report_id: string;
  alert_id: string;
  download_url: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  linkedAccounts: string[];
  photoURL?: string;
}
