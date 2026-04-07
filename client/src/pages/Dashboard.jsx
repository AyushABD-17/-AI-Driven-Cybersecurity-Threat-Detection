import React from 'react';
import { ShieldAlert, Activity, ShieldCheck, Crosshair, Wifi } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useAlertStore from '../stores/alertStore';

// Temporary dummy chart data to showcase aesthetics while live data streams in
const generateDummyData = () => {
    return Array.from({length: 20}).map((_, i) => ({
      time: new Date(Date.now() - (20 - i) * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      anomaly_score: Math.random() * 0.4 - 0.2 // mostly normal with spikes
    }));
};

export default function Dashboard() {
  const { stats, alerts, isConnected } = useAlertStore();

  const mockChartData = generateDummyData();

  return (
    <div className="p-8 animate-fade-in max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time threat monitoring and network analytics</p>
        </div>
        
        <div className="flex items-center space-x-3 glass-card px-4 py-2 rounded-full">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success-400 animate-pulse-fast shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-danger-400'}`}></div>
          <span className="text-sm font-medium text-gray-300">
            {isConnected ? 'Stream Active' : 'Disconnected'}
          </span>
          <Wifi className="w-4 h-4 text-gray-400 ml-2" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        
        {/* Card 1 */}
        <div className="glass-card p-6 border-l-4 border-l-primary-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Alerts (24h)</p>
              <h3 className="text-3xl font-bold text-white mt-2">{stats.alertsToday || 142}</h3>
            </div>
            <div className="p-3 bg-primary-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-primary-400" />
            </div>
          </div>
          <p className="text-xs text-primary-400 mt-4 flex items-center">
             +12.5% from yesterday
          </p>
        </div>

        {/* Card 2 */}
        <div className="glass-card p-6 border-l-4 border-l-danger-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium">Critical Threats</p>
              <h3 className="text-3xl font-bold text-danger-400 mt-2 animate-glow-pulse">{stats.criticalOpen || 3}</h3>
            </div>
            <div className="p-3 bg-danger-500/10 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-danger-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Require immediate attention</p>
        </div>

        {/* Card 3 */}
        <div className="glass-card p-6 border-l-4 border-l-accent-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium">ML Confidence avg</p>
              <h3 className="text-3xl font-bold text-white mt-2">94.2%</h3>
            </div>
            <div className="p-3 bg-accent-500/10 rounded-lg">
              <Crosshair className="w-6 h-6 text-accent-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Random Forest ensemble</p>
        </div>

        {/* Card 4 */}
        <div className="glass-card p-6 border-l-4 border-l-success-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium">Resolved Incidents</p>
              <h3 className="text-3xl font-bold text-white mt-2">{stats.resolved || 89}</h3>
            </div>
            <div className="p-3 bg-success-500/10 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-success-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">All-time resolution count</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white">Mean Anomaly Score</h2>
            <span className="text-xs bg-base-700 px-3 py-1 rounded-full text-gray-300">Last 20 mins</span>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="time" stroke="#6B7280" tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                <YAxis stroke="#6B7280" tick={{fill: '#6B7280', fontSize: 12}} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#E5E7EB' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="anomaly_score" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#3B82F6', stroke: '#0B0F19', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Threat Feed */}
        <div className="glass-card p-6 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center">
              Live Threat Feed
              <span className="ml-2 w-2 h-2 rounded-full bg-danger-400 animate-pulse"></span>
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ShieldCheck className="w-12 h-12 mb-3 opacity-20" />
                <p>No active threats detected</p>
                <p className="text-xs mt-1">Listening to Redis stream...</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className={`p-4 rounded-lg bg-base-900 border ${alert.severity === 'critical' ? 'border-danger-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-base-700'} animate-slide-up`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold uppercase ${alert.severity === 'critical' ? 'text-danger-400' : 'text-warning-400'}`}>
                      {alert.severity} • {alert.attack_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm font-mono text-gray-300">
                    <span className="text-primary-400">{alert.src_ip}</span> → <span className="text-accent-400">{alert.dst_ip}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Anomaly Score: {(alert.anomaly_score).toFixed(3)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
