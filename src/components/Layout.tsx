import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  ShieldAlert,
  Network,
  UserCircle,
  CreditCard,
  LogOut,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const bankNav: NavItem[] = [
  {
    label: "Dashboard",
    path: "/bank",
    icon: <LayoutDashboard className="h-4 w-4" />,
    exact: true,
  },
  {
    label: "Live Alerts",
    path: "/bank/alerts",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  {
    label: "Network Graph",
    path: "/bank/graph",
    icon: <Network className="h-4 w-4" />,
  },
];

const userNav: NavItem[] = [
  {
    label: "My Risk",
    path: "/user",
    icon: <UserCircle className="h-4 w-4" />,
    exact: true,
  },
  {
    label: "Transactions",
    path: "/user/transactions",
    icon: <CreditCard className="h-4 w-4" />,
  },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isBank = location.pathname.startsWith("/bank");
  const isUser = location.pathname.startsWith("/user");
  const isLanding = location.pathname === "/";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = isBank ? bankNav : isUser ? userNav : [];

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);

  // Landing page renders without sidebar
  if (isLanding) {
    return (
      <div className="min-h-screen bg-gradient-radial bg-grid">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0a0e1a] bg-grid">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-white/[0.06] bg-[#0c1021]/80 backdrop-blur-xl transition-transform lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-[#0a0e1a]" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-white">
            SurakshaFlow
          </span>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav Label */}
        <div className="px-5 pt-6 pb-2">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-slate-500 uppercase">
            {isBank ? "Intelligence Hub" : "Personal Security"}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-1 relative">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn("nav-link relative", isActive(item) && "active")}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-1">
          <div className="mx-2 mb-3 p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-cyan-500/10 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-300">
                Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              AI-powered risk explanations & SMS scam detection active.
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="nav-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Exit Dashboard
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="h-16 border-b border-white/[0.06] bg-[#0c1021]/60 backdrop-blur-lg flex items-center px-4 lg:px-8 sticky top-0 z-40">
          <button
            className="lg:hidden mr-3 text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {/* Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span className="text-xs font-medium text-emerald-400">LIVE</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
