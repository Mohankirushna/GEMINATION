import { Link, Outlet, useLocation } from 'react-router-dom';
import { Shield, Activity, User, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const location = useLocation();
  const isBank = location.pathname.startsWith('/bank');
  const isUser = location.pathname.startsWith('/user');

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-indigo-600" />
                <span className="font-bold text-xl tracking-tight">SurakshaFlow</span>
              </Link>
            </div>
            <nav className="flex items-center gap-6">
              {isBank && (
                <>
                  <Link to="/bank" className={cn("text-sm font-medium", location.pathname === '/bank' ? "text-indigo-600" : "text-neutral-500 hover:text-neutral-900")}>
                    Dashboard
                  </Link>
                  <Link to="/bank/alerts" className={cn("text-sm font-medium", location.pathname === '/bank/alerts' ? "text-indigo-600" : "text-neutral-500 hover:text-neutral-900")}>
                    Alerts
                  </Link>
                  <Link to="/bank/graph" className={cn("text-sm font-medium", location.pathname === '/bank/graph' ? "text-indigo-600" : "text-neutral-500 hover:text-neutral-900")}>
                    Network Graph
                  </Link>
                </>
              )}
              {isUser && (
                <>
                  <Link to="/user" className={cn("text-sm font-medium", location.pathname === '/user' ? "text-indigo-600" : "text-neutral-500 hover:text-neutral-900")}>
                    My Risk
                  </Link>
                  <Link to="/user/transactions" className={cn("text-sm font-medium", location.pathname === '/user/transactions' ? "text-indigo-600" : "text-neutral-500 hover:text-neutral-900")}>
                    Transactions
                  </Link>
                </>
              )}
              {(isBank || isUser) && (
                <Link to="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
                  <LogOut className="h-4 w-4" />
                  Exit
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
