import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const NetworkVisualizer = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    // Clear previous SVG content
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 500;

    // Setup simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Create container for zoom
    const g = svg.append("g");

    // Add zoom behavior
    svg.call(d3.zoom().on("zoom", (event) => {
      g.attr("transform", event.transform);
    }));

    // Draw links
    const link = g.append("g")
      .attr("stroke", "#1E293B")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", d => d.type === 'SENT_TO' ? 2 : 1)
      .attr("marker-end", "url(#arrowhead)");

    // Add arrowheads for SENT_TO links
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#3B82F6")
      .style("stroke", "none");

    // Draw nodes
    const node = g.append("g")
      .attr("stroke", "#0F172A")
      .attr("stroke-width", 2)
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", d => d.type === 'Account' ? 10 : 7)
      .attr("fill", d => {
        if (d.type === 'Account') return "#3B82F6"; // Blue
        if (d.type === 'Device') return "#F43F5E";  // Rose
        if (d.type === 'IP') return "#10B981";      // Emerald
        return "#64748B";
      })
      .call(drag(simulation));

    // Add labels
    const label = g.append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .text(d => d.id.length > 10 ? d.id.substring(0, 8) + '...' : d.id)
      .attr("font-size", "10px")
      .attr("fill", "#94A3B8")
      .attr("dx", 12)
      .attr("dy", 4);

    // Node tooltips (using native title for simplicity)
    node.append("title").text(d => `${d.type}: ${d.id}`);

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
      
      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

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
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

  }, [data]);

  return (
    <div className="w-full h-[500px] bg-[#060B14] rounded-2xl border border-[#1E293B] overflow-hidden relative">
      <svg ref={svgRef} width="100%" height="100%" className="cursor-move"></svg>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-[#0B1324]/80 backdrop-blur-md p-3 rounded-xl border border-[#1E293B] space-y-2 text-[10px] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3B82F6]"></div>
          <span className="text-slate-400">Account</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#F43F5E]"></div>
          <span className="text-slate-400">Device</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
          <span className="text-slate-400">IP</span>
        </div>
      </div>
    </div>
  );
};

export default NetworkVisualizer;
