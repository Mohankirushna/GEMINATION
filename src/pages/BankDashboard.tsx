import { useState, useEffect } from 'react';
import { ShieldAlert, Activity, Users, ArrowUpRight, ArrowDownRight, Search, Filter } from 'lucide-react';
import { getMockAlerts } from '../services/mockData';
import { Alert } from '../types';
import { generateAlertExplanation } from '../services/geminiService';
import { cn } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '10:00', risk: 0.2 },
  { time: '10:05', risk: 0.3 },
  { time: '10:10', risk: 0.8 },
  { time: '10:15', risk: 0.95 },
  { time: '10:20', risk: 0.9 },
  { time: '10:25', risk: 0.4 },
  { time: '10:30', risk: 0.2 },
];

export default function BankDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  useEffect(() => {
    setAlerts(getMockAlerts());
  }, []);

  const handleAlertClick = async (alert: Alert) => {
    setSelectedAlert(alert);
    if (!alert.geminiExplanation && alert.unifiedRiskScore > 0.7) {
      setLoadingExplanation(true);
      const explanation = await generateAlertExplanation(alert);
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, geminiExplanation: explanation.explanation, recommendedAction: explanation.recommendation } : a));
      setSelectedAlert(prev => prev?.id === alert.id ? { ...prev, geminiExplanation: explanation.explanation, recommendedAction: explanation.recommendation } : prev);
      setLoadingExplanation(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Unified Intelligence Dashboard</h1>
          <p className="text-neutral-500 mt-1">Real-time fusion of Cyber and Financial signals.</p>
        </div>
        <div className="flex gap-4">
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            Generate STR Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">High Risk Alerts</p>
              <h3 className="text-2xl font-bold text-neutral-900">24</h3>
            </div>
          </div>
          <div className="mt-auto flex items-center text-sm font-medium text-red-600">
            <ArrowUpRight className="h-4 w-4 mr-1" />
            12% from last hour
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Transactions Monitored</p>
              <h3 className="text-2xl font-bold text-neutral-900">14,205</h3>
            </div>
          </div>
          <div className="mt-auto flex items-center text-sm font-medium text-emerald-600">
            <ArrowUpRight className="h-4 w-4 mr-1" />
            5% from last hour
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Active Mule Rings</p>
              <h3 className="text-2xl font-bold text-neutral-900">3</h3>
            </div>
          </div>
          <div className="mt-auto flex items-center text-sm font-medium text-amber-600">
            <ArrowDownRight className="h-4 w-4 mr-1" />
            1 resolved today
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-neutral-900">Live Alert Feed</h2>
              <div className="flex gap-2">
                <button className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg">
                  <Filter className="h-5 w-5" />
                </button>
                <button className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg">
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={cn(
                    "p-6 cursor-pointer hover:bg-neutral-50 transition-colors",
                    selectedAlert?.id === alert.id && "bg-indigo-50/50"
                  )}
                  onClick={() => handleAlertClick(alert)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        alert.unifiedRiskScore > 0.8 ? "bg-red-500" : alert.unifiedRiskScore > 0.4 ? "bg-amber-500" : "bg-emerald-500"
                      )} />
                      <span className="font-semibold text-neutral-900">Account: {alert.accountId}</span>
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-neutral-500">Risk Score</span>
                      <div className={cn(
                        "text-lg font-bold",
                        alert.unifiedRiskScore > 0.8 ? "text-red-600" : alert.unifiedRiskScore > 0.4 ? "text-amber-600" : "text-emerald-600"
                      )}>
                        {(alert.unifiedRiskScore * 100).toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm text-neutral-600">
                    <div className="flex items-center gap-1">
                      <ShieldAlert className="h-4 w-4 text-neutral-400" />
                      {alert.cyberEvents.length} Cyber Events
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-4 w-4 text-neutral-400" />
                      {alert.financialTransactions.length} Financial Events
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900 mb-6">System Risk Trend</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="risk" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          {selectedAlert ? (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden sticky top-24">
              <div className="p-6 border-b border-neutral-200 bg-neutral-50">
                <h2 className="text-lg font-semibold text-neutral-900">Alert Details</h2>
                <p className="text-sm text-neutral-500">ID: {selectedAlert.id}</p>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-indigo-600" />
                    Gemini AI Analysis
                  </h3>
                  {loadingExplanation ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                      <div className="h-4 bg-neutral-200 rounded w-full"></div>
                      <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
                    </div>
                  ) : selectedAlert.geminiExplanation ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-sm text-neutral-700 leading-relaxed">
                        {selectedAlert.geminiExplanation}
                      </div>
                      <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 text-sm">
                        <span className="font-semibold text-red-900 block mb-1">Recommended Action:</span>
                        <span className="text-red-800">{selectedAlert.recommendedAction}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 italic">Analysis not available for this risk level.</p>
                  )}
                </div>

                <div className="border-t border-neutral-100 pt-6">
                  <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-3">Cyber Signals</h3>
                  {selectedAlert.cyberEvents.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedAlert.cyberEvents.map(event => (
                        <li key={event.id} className="text-sm flex justify-between items-start">
                          <div>
                            <span className="font-medium text-neutral-900 block">{event.type.replace('_', ' ')}</span>
                            <span className="text-neutral-500 text-xs">{event.deviceId} • {event.ipLocation}</span>
                          </div>
                          <span className="text-xs font-medium px-2 py-1 rounded bg-neutral-100 text-neutral-600">
                            Risk: {event.riskScore}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">No cyber signals detected.</p>
                  )}
                </div>

                <div className="border-t border-neutral-100 pt-6">
                  <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-3">Financial Signals</h3>
                  {selectedAlert.financialTransactions.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedAlert.financialTransactions.map(tx => (
                        <li key={tx.id} className="text-sm flex justify-between items-start">
                          <div>
                            <span className="font-medium text-neutral-900 block">₹{tx.amount.toLocaleString()} ({tx.type.toUpperCase()})</span>
                            <span className="text-neutral-500 text-xs">{tx.senderId} → {tx.receiverId}</span>
                          </div>
                          <span className="text-xs font-medium px-2 py-1 rounded bg-neutral-100 text-neutral-600">
                            Risk: {tx.riskScore}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-500">No financial signals detected.</p>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                    Freeze Account
                  </button>
                  <button className="flex-1 bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center h-full flex flex-col items-center justify-center text-neutral-500">
              <ShieldAlert className="h-12 w-12 text-neutral-300 mb-4" />
              <p>Select an alert from the feed to view detailed analysis and Gemini AI recommendations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
