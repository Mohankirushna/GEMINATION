import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Smartphone, CreditCard, Bell, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { generateMockCyberEvents, generateMockFinancialTransactions } from '../services/mockData';
import { CyberEvent, FinancialTransaction } from '../types';

export default function UserDashboard() {
  const [cyberEvents, setCyberEvents] = useState<CyberEvent[]>([]);
  const [financialEvents, setFinancialEvents] = useState<FinancialTransaction[]>([]);
  
  const riskScore = 0.65; // Mock user risk score

  useEffect(() => {
    setCyberEvents(generateMockCyberEvents().slice(0, 2));
    setFinancialEvents(generateMockFinancialTransactions().slice(0, 3));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">My Security Dashboard</h1>
          <p className="text-neutral-500 mt-1">Monitor your personal risk and account activity.</p>
        </div>
        <div className="flex gap-4">
          <button className="bg-white border border-neutral-300 text-neutral-700 px-4 py-2 rounded-lg font-medium hover:bg-neutral-50 transition-colors flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alert Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={cn(
          "p-8 rounded-3xl border shadow-sm flex flex-col justify-center items-center text-center",
          riskScore > 0.7 ? "bg-red-50 border-red-200" : riskScore > 0.4 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
        )}>
          {riskScore > 0.7 ? (
            <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
          ) : riskScore > 0.4 ? (
            <ShieldAlert className="h-16 w-16 text-amber-500 mb-4" />
          ) : (
            <ShieldCheck className="h-16 w-16 text-emerald-500 mb-4" />
          )}
          
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Personal Risk Meter</h2>
          <div className="text-5xl font-bold tracking-tight mb-4" style={{ color: riskScore > 0.7 ? '#ef4444' : riskScore > 0.4 ? '#f59e0b' : '#10b981' }}>
            {(riskScore * 100).toFixed(0)}<span className="text-2xl text-neutral-400">/100</span>
          </div>
          <p className="text-neutral-600 max-w-xs">
            {riskScore > 0.7 
              ? "High risk detected. Please review recent logins and transactions immediately." 
              : riskScore > 0.4 
              ? "Moderate risk. We noticed some unusual activity on your account." 
              : "Your account is secure. No unusual activity detected."}
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-indigo-600" />
              Recent Device Activity
            </h3>
            <div className="space-y-4">
              {cyberEvents.map(event => (
                <div key={event.id} className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <div>
                    <p className="font-medium text-neutral-900 text-sm">{event.type.replace('_', ' ')}</p>
                    <p className="text-xs text-neutral-500">{event.ipLocation} • {new Date(event.timestamp).toLocaleTimeString()}</p>
                  </div>
                  {event.riskScore > 0.7 && (
                    <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-md">
                      Review
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View all devices <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              Recent Transactions
            </h3>
            <div className="space-y-4">
              {financialEvents.map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <div>
                    <p className="font-medium text-neutral-900 text-sm">To: {tx.receiverId}</p>
                    <p className="text-xs text-neutral-500">{tx.type.toUpperCase()} • {new Date(tx.timestamp).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900">₹{tx.amount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View all transactions <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {riskScore > 0.4 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 items-start">
          <div className="p-2 bg-amber-100 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-900 mb-1">Early Warning: Potential Mule Activity</h3>
            <p className="text-amber-800 text-sm mb-4">
              We detected a login from an unrecognized device in Mumbai, followed by rapid fund transfers. This pattern is often associated with account takeovers or money mule recruitment.
            </p>
            <div className="flex gap-3">
              <button className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
                Secure My Account
              </button>
              <button className="bg-white border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors">
                This was me
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
