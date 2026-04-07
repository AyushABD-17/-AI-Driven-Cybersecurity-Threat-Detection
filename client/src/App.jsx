import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NetworkGraph from './pages/NetworkGraph';
import Incidents from './pages/Incidents';
import LogsFeed from './pages/LogsFeed';
import { useSocket } from './services/socket';

// Placeholder mappings
const Analytics = () => <div className="p-8"><h1 className="text-3xl font-bold">Analytics Engine Active</h1><p className="text-gray-400 mt-2">Deeper offline metric mining would sit here.</p></div>;

const AppLayout = ({ children }) => {
  useSocket(); // Initializes realtime connection

  return (
    <div className="flex bg-base-900 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 bg-[#050810]">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/graph" element={<AppLayout><NetworkGraph /></AppLayout>} />
        <Route path="/incidents" element={<AppLayout><Incidents /></AppLayout>} />
        <Route path="/logs" element={<AppLayout><LogsFeed /></AppLayout>} />
        <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
      </Routes>
    </BrowserRouter>
  );
}
