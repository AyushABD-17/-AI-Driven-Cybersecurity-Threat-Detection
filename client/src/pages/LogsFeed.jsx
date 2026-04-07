import React from 'react';
import useAlertStore from '../stores/alertStore';
import { Activity, RadioTower } from 'lucide-react';

export default function LogsFeed() {
  const { alerts, isConnected } = useAlertStore();

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Raw Socket Feed</h1>
          <p className="text-gray-400 mt-1">Unfiltered log pipeline output</p>
        </div>
        <div className="flex items-center text-primary-400">
           {isConnected ? <RadioTower className="w-6 h-6 animate-pulse mr-2" /> : <Activity className="w-6 h-6 text-gray-600 mr-2" />}
           <span className="font-mono text-sm">{alerts.length} events buffered</span>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-base-800 border-b border-base-700">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Source IP</th>
                <th className="px-6 py-4">Dest IP</th>
                <th className="px-6 py-4">Protocol/Flag</th>
                <th className="px-6 py-4">Attack Label</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-700 font-mono">
              {alerts.length === 0 ? (
                <tr>
                   <td colSpan="7" className="px-6 py-8 text-center text-gray-500">Awaiting stream...</td>
                </tr>
              ) : (
                alerts.map((row, i) => (
                  <tr key={i} className="hover:bg-base-800/50 transition-colors">
                    <td className="px-6 py-3 text-gray-300">{new Date(row.timestamp).toISOString()}</td>
                    <td className="px-6 py-3 text-primary-400">{row.src_ip}:{row.src_port || '*'}</td>
                    <td className="px-6 py-3 text-accent-400">{row.dst_ip}:{row.dst_port}</td>
                    <td className="px-6 py-3 text-gray-300">{row.protocol} / {row.flag}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded inline-flex ${row.is_anomaly ? 'bg-danger-500/20 text-danger-400' : 'bg-success-500/10 text-success-400'}`}>
                        {row.attack_type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-300">{row.anomaly_score?.toFixed(4)}</td>
                    <td className="px-6 py-3 text-gray-300">{(row.confidence * 100)?.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
