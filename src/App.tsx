/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import BankDashboard from './pages/BankDashboard';
import NetworkGraph from './pages/NetworkGraph';
import UserDashboard from './pages/UserDashboard';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="bank" element={<BankDashboard />} />
          <Route path="bank/alerts" element={<BankDashboard />} />
          <Route path="bank/graph" element={<NetworkGraph />} />
          <Route path="user" element={<UserDashboard />} />
          <Route path="user/transactions" element={<UserDashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}
