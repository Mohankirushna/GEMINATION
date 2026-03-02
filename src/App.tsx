/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import BankDashboard from "./pages/BankDashboard";
import NetworkGraph from "./pages/NetworkGraph";
import UserDashboard from "./pages/UserDashboard";

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "financial_institution" | "end_user";
}) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
          <span className="text-sm text-slate-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && profile.role !== requiredRole) {
    return (
      <Navigate
        to={profile.role === "financial_institution" ? "/bank" : "/user"}
        replace
      />
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { profile, loading } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            loading ? null : profile ? (
              <Navigate
                to={
                  profile.role === "financial_institution" ? "/bank" : "/user"
                }
                replace
              />
            ) : (
              <LandingPage />
            )
          }
        />
      </Route>

      <Route
        path="/auth"
        element={
          profile ? (
            <Navigate
              to={profile.role === "financial_institution" ? "/bank" : "/user"}
              replace
            />
          ) : (
            <AuthPage />
          )
        }
      />

      {/* Protected: Bank (Financial Institution) */}
      <Route path="/" element={<Layout />}>
        <Route
          path="bank"
          element={
            <ProtectedRoute requiredRole="financial_institution">
              <BankDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="bank/alerts"
          element={
            <ProtectedRoute requiredRole="financial_institution">
              <BankDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="bank/graph"
          element={
            <ProtectedRoute requiredRole="financial_institution">
              <NetworkGraph />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Protected: User (End User) */}
      <Route path="/" element={<Layout />}>
        <Route
          path="user"
          element={
            <ProtectedRoute requiredRole="end_user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="user/transactions"
          element={
            <ProtectedRoute requiredRole="end_user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
