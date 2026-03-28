import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Debts from './pages/Debts';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Users from './pages/Users';
import Settings from './pages/Settings';
import { FirebaseSetupOverlay } from './components/FirebaseSetupOverlay';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { currentUser, userData, loading, showFirebaseSetup, setShowFirebaseSetup } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">بارکردن...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  if (roles && (!userData?.role || !roles.includes(userData.role))) {
    return <Navigate to={(!userData?.role || userData.role === 'cashier') ? '/pos' : '/'} />;
  }

  return (
    <>
      {children}
      {showFirebaseSetup && <FirebaseSetupOverlay onClose={() => setShowFirebaseSetup(false)} />}
    </>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<ProtectedRoute roles={['admin', 'manager']}><Dashboard /></ProtectedRoute>} />
          <Route path="pos" element={<ProtectedRoute roles={['admin', 'manager', 'cashier']}><POS /></ProtectedRoute>} />
          <Route path="products" element={<ProtectedRoute roles={['admin', 'manager']}><Products /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute roles={['admin', 'manager']}><Inventory /></ProtectedRoute>} />
          <Route path="debts" element={<ProtectedRoute roles={['admin', 'manager', 'cashier']}><Debts /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute roles={['admin', 'manager']}><Reports /></ProtectedRoute>} />
          <Route path="expenses" element={<ProtectedRoute roles={['admin', 'manager']}><Expenses /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        </Route>
      </Routes>
    </Router>
  );
}
