import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [report, setReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      // In a real app we attach the JWT token 
      // Replace dummy with actual logic if auth active
      const res = await axios.get(`${API_BASE}/incidents?status=open&limit=20`);
      if (res.data.data) {
        setIncidents(res.data.data.incidents || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (incidentId) => {
    setGeneratingReport(true);
    setReport(null);
    try {
      const res = await axios.post(`${API_BASE}/reports/generate`, { incidentId });
      setReport(res.data.data.htmlContent);
    } catch (err) {
      console.error(err);
      setReport(`<div class="text-danger-400">Failed to generate report using LLM. Model may be down.</div>`);
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Incident Queue</h1>
        <p className="text-gray-400 mt-1">Review active threats and generate LLM summaries</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Incident List */}
        <div className="w-1/3 glass-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-base-700 flex relative">
            <Search className="w-5 h-5 absolute left-7 top-6 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search ID or IP..." 
              className="input-field pl-10"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
            ) : incidents.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No open incidents</div>
            ) : (
              incidents.map((incident) => (
                <div 
                  key={incident._id}
                  onClick={() => { setSelectedIncident(incident); setReport(null); }}
                  className={`p-4 rounded-xl cursor-pointer border transition-colors ${selectedIncident?._id === incident._id ? 'bg-primary-500/10 border-primary-500/50' : 'bg-base-900 border-base-700 hover:border-base-600'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-primary-400">INC-{incident._id.slice(-6).toUpperCase()}</span>
                    <span className={`text-xs px-2 py-1 rounded bg-danger-500/10 text-danger-400 font-medium uppercase uppercase`}>
                      {incident.severity}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white">{incident.attackClass} Attack</h4>
                  <div className="text-xs text-gray-400 mt-1 flex justify-between">
                    <span>{incident.sourceIp}</span>
                    <span>{new Date(incident.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Incident Detail */}
        <div className="w-2/3 glass-card overflow-hidden flex flex-col">
          {selectedIncident ? (
            <>
              <div className="p-6 border-b border-base-700 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center">
                    {selectedIncident.attackClass} Intrusion
                    {selectedIncident.severity === 'critical' && <AlertTriangle className="w-5 h-5 ml-3 text-danger-400 animate-pulse" />}
                  </h2>
                  <p className="text-gray-400 font-mono text-sm mt-1">Source: {selectedIncident.sourceIp}</p>
                </div>
                <button
                  onClick={() => handleGenerateReport(selectedIncident._id)}
                  disabled={generatingReport}
                  className="btn-primary flex items-center shadow-lg hover:shadow-xl"
                >
                  {generatingReport ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Log Cluster...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> AI Generate Report</>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-[#0B0F19]/50">
                {!report && !generatingReport && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                     <Sparkles className="w-12 h-12 opacity-20" />
                     <p>Click "AI Generate Report" to synthesize raw logs via Groq LLM</p>
                  </div>
                )}
                
                {report && (
                  <div className="prose prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: report }} />
                  </div>
                )}
              </div>
            </>
          ) : (
             <div className="h-full flex items-center justify-center text-gray-500">
                Select an incident to view details
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
