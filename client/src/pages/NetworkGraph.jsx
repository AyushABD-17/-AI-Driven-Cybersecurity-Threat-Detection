import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Activity, X } from 'lucide-react';
import useAlertStore from '../stores/alertStore';

export default function NetworkGraph() {
  const svgRef = useRef(null);
  const { alerts } = useAlertStore();
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // 1. Process alerts into Nodes and Links
    const nodesMap = new Map();
    const linksMap = new Map();

    // Central core node
    nodesMap.set('10.0.0.1', { id: '10.0.0.1', group: 'core', radius: 24, label: 'Enterprise Core' });

    alerts.forEach(alert => {
      // Add Source
      if (!nodesMap.has(alert.src_ip)) {
        nodesMap.set(alert.src_ip, { id: alert.src_ip, group: 'external', radius: 12 });
      }
      
      // Add Destination (might be internal)
      if (!nodesMap.has(alert.dst_ip)) {
        nodesMap.set(alert.dst_ip, { id: alert.dst_ip, group: 'internal', radius: 16 });
      }

      // Add Link
      const linkId = `${alert.src_ip}-${alert.dst_ip}`;
      if (linksMap.has(linkId)) {
        linksMap.get(linkId).value += 1;
        linksMap.get(linkId).alerts.push(alert);
      } else {
        linksMap.set(linkId, {
          source: alert.src_ip,
          target: alert.dst_ip,
          value: 1,
          isAnomaly: alert.is_anomaly,
          alerts: [alert]
        });
      }
    });

    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linksMap.values());

    // 2. D3 Setup
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    d3.select(svgRef.current).selectAll('*').remove(); // Clear previous rendering
    
    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height])
      .call(d3.zoom().on('zoom', (event) => g.attr('transform', event.transform)));

    const g = svg.append('g');

    // 3. Force Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(d => d.radius + 10));

    // 4. Render Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.isAnomaly ? '#EF4444' : '#374151')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.value) * 1.5);

    // 5. Render Nodes
    const getColor = (group) => {
      if (group === 'core') return '#3B82F6';
      if (group === 'internal') return '#10B981';
      return '#8B5CF6';
    };

    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => getColor(d.group))
      .attr('stroke', '#0B0F19')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(drag(simulation));

    // Interactivity
    node.on('click', (event, d) => {
      setSelectedNode(d);
    });

    // Tooltips
    node.append('title').text(d => d.id);

    // Node Labels implementation for specific nodes
    g.append('g')
      .selectAll('text')
      .data(nodes.filter(d => d.group === 'core' || d.group === 'internal'))
      .join('text')
      .text(d => d.label || d.id)
      .attr('font-size', '10px')
      .attr('fill', '#9CA3AF')
      .attr('dx', 15)
      .attr('dy', 4);

    // 6. Simulation ticks
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
        
      g.selectAll('text')
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // 7. Drag interactions map
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [alerts]);

  return (
    <div className="p-8 h-full min-h-screen flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Network Topology</h1>
          <p className="text-gray-400 mt-1">D3.js visualization mapping real-time attack path clusters</p>
        </div>
        <div className="flex space-x-4 text-xs font-medium bg-base-800 px-4 py-2 flex-wrap rounded-lg">
          <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-primary-500 mr-2"></div>Core</span>
          <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-success-500 mr-2"></div>Internal</span>
          <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-accent-500 mr-2"></div>External</span>
          <span className="flex items-center"><div className="w-full h-1 w-6 bg-danger-500 mr-2"></div>Attack Vector</span>
        </div>
      </div>

      <div className="flex-1 relative flex gap-6">
        {/* Main D3 Container */}
        <div className="flex-1 glass-card h-[700px] overflow-hidden relative">
          <svg className="w-full h-full cursor-grab active:cursor-grabbing" ref={svgRef}></svg>
          
          {alerts.length === 0 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-base-900/50 backdrop-blur-sm">
                <Activity className="w-12 h-12 mb-4 animate-pulse opacity-50" />
                <p>Waiting for network logs to construct topology...</p>
             </div>
          )}
        </div>

        {/* Node Inspector Panel */}
        {selectedNode && (
          <div className="w-80 glass-card p-6 h-[700px] overflow-y-auto animate-fade-in relative">
            <button 
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 p-1 hover:bg-base-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-1 mt-2 tracking-wide font-mono">
              {selectedNode.id}
            </h3>
            <span className="text-xs uppercase bg-base-700 px-2 py-1 rounded text-gray-300">
               {selectedNode.group} Node
            </span>

            <div className="mt-8 space-y-6">
              <div>
                <p className="text-sm text-gray-400">Total Activity</p>
                <div className="text-2xl font-bold text-white">
                   {alerts.filter(a => a.src_ip === selectedNode.id || a.dst_ip === selectedNode.id).length} events
                </div>
              </div>

               <div>
                <p className="text-sm text-gray-400 mb-3">Recent Logs for IP</p>
                <div className="space-y-3">
                   {alerts
                     .filter(a => a.src_ip === selectedNode.id || a.dst_ip === selectedNode.id)
                     .slice(0, 5)
                     .map((a, i) => (
                       <div key={i} className="bg-base-900 p-3 rounded border border-base-700 text-xs">
                          <div className={`font-medium ${a.is_anomaly ? 'text-danger-400' : 'text-gray-300'}`}>
                            {a.protocol} {a.is_anomaly ? `(${a.attack_type})` : ''}
                          </div>
                          <div className="text-gray-500 mt-1 flex justify-between">
                            <span>{new Date(a.timestamp).toLocaleTimeString()}</span>
                            <span>Score: {a.anomaly_score.toFixed(2)}</span>
                          </div>
                       </div>
                     ))
                   }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
