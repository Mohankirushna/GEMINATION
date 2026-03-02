import { Alert, CyberEvent, FinancialTransaction, GraphData } from '../types';

export const generateMockCyberEvents = (): CyberEvent[] => [
  {
    id: 'c1',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    type: 'new_device',
    deviceId: 'dev_8891',
    ipLocation: 'Mumbai, IN',
    accountId: 'acc_A',
    riskScore: 0.8,
  },
  {
    id: 'c2',
    timestamp: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    type: 'login',
    deviceId: 'dev_8891',
    ipLocation: 'Mumbai, IN',
    accountId: 'acc_B',
    riskScore: 0.9,
  },
  {
    id: 'c3',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    type: 'impossible_travel',
    deviceId: 'dev_8891',
    ipLocation: 'Delhi, IN',
    accountId: 'acc_C',
    riskScore: 0.95,
  },
];

export const generateMockFinancialTransactions = (): FinancialTransaction[] => [
  {
    id: 't1',
    timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    senderId: 'victim_1',
    receiverId: 'acc_A',
    amount: 50000,
    type: 'upi',
    riskScore: 0.7,
  },
  {
    id: 't2',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    senderId: 'acc_A',
    receiverId: 'acc_B',
    amount: 25000,
    type: 'upi',
    riskScore: 0.85,
  },
  {
    id: 't3',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    senderId: 'acc_A',
    receiverId: 'acc_C',
    amount: 25000,
    type: 'upi',
    riskScore: 0.85,
  },
  {
    id: 't4',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    senderId: 'acc_B',
    receiverId: 'kingpin_1',
    amount: 24000,
    type: 'imps',
    riskScore: 0.9,
  },
  {
    id: 't5',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    senderId: 'acc_C',
    receiverId: 'kingpin_1',
    amount: 24000,
    type: 'imps',
    riskScore: 0.9,
  },
];

export const generateMockGraphData = (): GraphData => ({
  nodes: [
    { id: 'victim_1', type: 'account', riskScore: 0.1, label: 'Victim' },
    { id: 'acc_A', type: 'account', riskScore: 0.8, label: 'Mule A' },
    { id: 'acc_B', type: 'account', riskScore: 0.9, label: 'Mule B' },
    { id: 'acc_C', type: 'account', riskScore: 0.95, label: 'Mule C' },
    { id: 'kingpin_1', type: 'account', riskScore: 0.99, label: 'Kingpin' },
    { id: 'dev_8891', type: 'device', riskScore: 0.9, label: 'Suspicious Device' },
  ],
  edges: [
    { source: 'victim_1', target: 'acc_A', type: 'transaction', weight: 50000 },
    { source: 'acc_A', target: 'acc_B', type: 'transaction', weight: 25000 },
    { source: 'acc_A', target: 'acc_C', type: 'transaction', weight: 25000 },
    { source: 'acc_B', target: 'kingpin_1', type: 'transaction', weight: 24000 },
    { source: 'acc_C', target: 'kingpin_1', type: 'transaction', weight: 24000 },
    { source: 'dev_8891', target: 'acc_A', type: 'login', weight: 1 },
    { source: 'dev_8891', target: 'acc_B', type: 'login', weight: 1 },
    { source: 'dev_8891', target: 'acc_C', type: 'login', weight: 1 },
  ],
});

export const getMockAlerts = (): Alert[] => [
  {
    id: 'alert_1',
    timestamp: new Date().toISOString(),
    accountId: 'acc_A',
    unifiedRiskScore: 0.92,
    status: 'new',
    cyberEvents: generateMockCyberEvents(),
    financialTransactions: generateMockFinancialTransactions(),
  },
  {
    id: 'alert_2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    accountId: 'acc_X',
    unifiedRiskScore: 0.45,
    status: 'resolved',
    cyberEvents: [],
    financialTransactions: [
      {
        id: 't_x1',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        senderId: 'acc_X',
        receiverId: 'merchant_1',
        amount: 15000,
        type: 'upi',
        riskScore: 0.4,
      }
    ],
  }
];
