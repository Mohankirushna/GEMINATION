import { Link } from 'react-router-dom';
import { Shield, Building2, UserCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full space-y-12 text-center">
        <div className="space-y-4">
          <div className="flex justify-center mb-8">
            <div className="bg-indigo-100 p-4 rounded-full">
              <Shield className="h-16 w-16 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-neutral-900">
            SurakshaFlow
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Unified Cyber-Financial Intelligence Platform. Fusing SOC signals with AML monitoring to detect and disrupt money mule networks in real-time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <Link
            to="/bank"
            className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-indigo-300 transition-all"
          >
            <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Building2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Financial Institution</h2>
            <p className="text-neutral-500 text-center">
              Monitor unified risk scores, view graph analytics, and act on Gemini AI-powered alerts.
            </p>
          </Link>

          <Link
            to="/user"
            className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-neutral-200 hover:shadow-md hover:emerald-300 transition-all"
          >
            <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UserCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold text-neutral-900 mb-2">End User</h2>
            <p className="text-neutral-500 text-center">
              View your personal risk meter, monitor linked accounts, and receive early warnings.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
