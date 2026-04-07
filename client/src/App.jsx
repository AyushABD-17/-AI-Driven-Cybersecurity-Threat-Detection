import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NetworkGraph from './pages/NetworkGraph';
import Incidents from './pages/Incidents';
import LogsFeed from './pages/LogsFeed';
import Login from './pages/Login';
import { useSocket } from './services/socket';

const Analytics = () => <div className="p-8"><h1 className="text-3xl font-bold">Analytics Engine Active</h1><p className="text-gray-400 mt-2">Deeper offline metric mining would sit here.</p></div>;

const AppLayout = ({ children }) => {
  useSocket(); // Initializes realtime connection when layout mounts

  return (
    <div className="flex bg-base-900 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 bg-[#050810]">
        {children}
      </main>
    </div>
  );
};

// Private route wrapper checking for local token
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/graph" element={<PrivateRoute><NetworkGraph /></PrivateRoute>} />
        <Route path="/incidents" element={<PrivateRoute><Incidents /></PrivateRoute>} />
        <Route path="/logs" element={<PrivateRoute><LogsFeed /></PrivateRoute>} />
        <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
