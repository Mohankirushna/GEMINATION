export type UserRole = 'end_user' | 'financial_institution';

export interface CyberEvent {
  id: string;
  timestamp: string;
  type: 'login' | 'malware' | 'impossible_travel' | 'new_device';
  deviceId: string;
  ipLocation: string;
  accountId: string;
  riskScore: number; // 0 to 1
}

export interface FinancialTransaction {
  id: string;
  timestamp: string;
  senderId: string;
  receiverId: string;
  amount: number;
  type: 'upi' | 'neft' | 'imps';
  riskScore: number; // 0 to 1
}

export interface Alert {
  id: string;
  timestamp: string;
  accountId: string;
  unifiedRiskScore: number; // 0 to 1
  cyberEvents: CyberEvent[];
  financialTransactions: FinancialTransaction[];
  status: 'new' | 'investigating' | 'resolved';
  geminiExplanation?: string;
  recommendedAction?: string;
}

export interface GraphNode {
  id: string;
  type: 'account' | 'device';
  riskScore: number;
  label: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'transaction' | 'login';
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
