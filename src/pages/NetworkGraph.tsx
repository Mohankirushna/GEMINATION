import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { fetchGraphData } from "../services/api";
import { generateMockGraphData } from "../services/mockData";
import { GraphNode, GraphEdge, GraphData } from "../types";
import GlassCard from "../components/GlassCard";
import { Network, ZoomIn, ZoomOut, RotateCcw, Info } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  kingpin: "#ef4444",
  mule: "#f59e0b",
  victim: "#10b981",
  suspect: "#f97316",
  clean: "#06b6d4",
  device: "#8b5cf6",
};

const GLOW_COLORS: Record<string, string> = {
  kingpin: "rgba(239,68,68,0.6)",
  mule: "rgba(245,158,11,0.5)",
  victim: "rgba(16,185,129,0.4)",
  suspect: "rgba(249,115,22,0.5)",
  clean: "rgba(6,182,212,0.3)",
  device: "rgba(139,92,246,0.4)",
};

function nodeColor(n: GraphNode) {
  const label = (n.node_label ?? n.label ?? "").toLowerCase();
  if (label.includes("kingpin")) return NODE_COLORS.kingpin;
  if (label.includes("mule")) return NODE_COLORS.mule;
  if (label.includes("victim")) return NODE_COLORS.victim;
  if (label.includes("suspect")) return NODE_COLORS.suspect;
  if (n.type === "device") return NODE_COLORS.device;
  if ((n.risk_score ?? n.riskScore) > 0.7) return NODE_COLORS.kingpin;
  if ((n.risk_score ?? n.riskScore) > 0.4) return NODE_COLORS.mule;
  return NODE_COLORS.clean;
}

function nodeGlow(n: GraphNode) {
  const label = (n.node_label ?? n.label ?? "").toLowerCase();
  if (label.includes("kingpin")) return GLOW_COLORS.kingpin;
  if (label.includes("mule")) return GLOW_COLORS.mule;
  if (label.includes("victim")) return GLOW_COLORS.victim;
  if (n.type === "device") return GLOW_COLORS.device;
  return GLOW_COLORS.clean;
}

export default function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchGraphData();
        setGraphData(data);
      } catch {
        setGraphData(generateMockGraphData());
      }
    })();
  }, []);

  // Render graph
  useEffect(() => {
    if (!svgRef.current || !graphData) return;

    const width = 900;
    const height = 620;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("border-radius", "16px");

    svg.selectAll("*").remove();

    // Defs: arrow markers + glow filter
    const defs = svg.append("defs");

    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 24)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M 0,-4 L 8,0 L 0,4")
      .attr("fill", "rgba(255,255,255,0.15)");

    const glowFilter = defs.append("filter").attr("id", "node-glow");
    glowFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "blur");
    glowFilter
      .append("feMerge")
      .selectAll("feMergeNode")
      .data(["blur", "SourceGraphic"])
      .join("feMergeNode")
      .attr("in", (d) => d);

    const g = svg.append("g");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    // Deep clone data to avoid mutation issues
    const nodes = graphData.nodes.map((n) => ({ ...n }));
    const edges = graphData.edges.map((e) => ({ ...e }));

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(edges)
          .id((d: any) => d.id)
          .distance(120),
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Edges
    const link = g
      .append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", "rgba(255,255,255,0.08)")
      .attr("stroke-width", (d) => Math.max(1, Math.sqrt(d.weight) / 30 + 0.8))
      .attr("marker-end", "url(#arrow)");

    // Edge labels (amounts)
    const edgeLabel = g
      .append("g")
      .selectAll("text")
      .data(edges.filter((e) => e.type === "transaction" && e.weight > 1000))
      .join("text")
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.2)")
      .attr("font-size", "8px")
      .attr("font-family", "var(--font-mono)")
      .text((d) => `₹${(d.weight / 1000).toFixed(0)}K`);

    // Nodes (outer glow + inner circle)
    const nodeGroup = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, any>()
          .on("start", (event) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on("drag", (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on("end", (event) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          }),
      );

    // Glow circle
    nodeGroup
      .append("circle")
      .attr("r", 18)
      .attr("fill", (d: any) => nodeGlow(d))
      .attr("opacity", 0.4)
      .attr("filter", "url(#node-glow)");

    // Inner circle
    nodeGroup
      .append("circle")
      .attr("r", (d: any) => (d.type === "device" ? 8 : 11))
      .attr("fill", (d: any) => nodeColor(d))
      .attr("stroke", "rgba(255,255,255,0.2)")
      .attr("stroke-width", 1.5);

    // Labels
    nodeGroup
      .append("text")
      .text((d: any) => d.label || d.node_label || d.id)
      .attr("dx", 16)
      .attr("dy", 4)
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", "10px")
      .attr("font-family", "var(--font-sans)");

    // Click to select
    nodeGroup.on("click", (_event, d: any) => {
      setSelected(d);
      // Highlight connected
      const connected = new Set<string>();
      edges.forEach((e: any) => {
        const sid = typeof e.source === "object" ? e.source.id : e.source;
        const tid = typeof e.target === "object" ? e.target.id : e.target;
        if (sid === d.id) connected.add(tid);
        if (tid === d.id) connected.add(sid);
      });
      connected.add(d.id);

      nodeGroup
        .select("circle:nth-child(2)")
        .attr("opacity", (n: any) => (connected.has(n.id) ? 1 : 0.2));
      link.attr("stroke-opacity", (e: any) => {
        const sid = typeof e.source === "object" ? e.source.id : e.source;
        const tid = typeof e.target === "object" ? e.target.id : e.target;
        return sid === d.id || tid === d.id ? 0.8 : 0.05;
      });
    });

    // Reset on background click
    svg.on("click", (event) => {
      if (event.target === svgRef.current) {
        setSelected(null);
        nodeGroup.select("circle:nth-child(2)").attr("opacity", 1);
        link.attr("stroke-opacity", 1);
      }
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      edgeLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 6);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  const handleZoom = (dir: "in" | "out" | "reset") => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    if (dir === "reset") {
      svg
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    } else {
      svg
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, dir === "in" ? 1.4 : 0.7);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Network className="h-6 w-6 text-cyan-400" />
            Network Intelligence Graph
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visualizing transaction flows and device connections to identify
            mule rings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Graph Canvas */}
        <div className="lg:col-span-3">
          <div className="graph-container relative overflow-hidden">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5">
              <button
                onClick={() => handleZoom("in")}
                className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleZoom("out")}
                className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleZoom("reset")}
                className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            <svg ref={svgRef} className="w-full h-[620px]" />

            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-3">
              {[
                { label: "Kingpin", color: NODE_COLORS.kingpin },
                { label: "Mule", color: NODE_COLORS.mule },
                { label: "Victim", color: NODE_COLORS.victim },
                { label: "Clean", color: NODE_COLORS.clean },
                { label: "Device", color: NODE_COLORS.device },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: l.color,
                      boxShadow: `0 0 6px ${l.color}`,
                    }}
                  />
                  <span className="text-[10px] text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="lg:col-span-1">
          <GlassCard hover={false} className="p-5 sticky top-24">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {selected.label || selected.node_label || selected.id}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    {selected.id}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Type</span>
                    <span className="text-white capitalize">
                      {selected.type}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Risk Score</span>
                    <span
                      className="font-mono font-bold"
                      style={{ color: nodeColor(selected) }}
                    >
                      {(
                        (selected.risk_score ?? selected.riskScore) * 100
                      ).toFixed(0)}
                    </span>
                  </div>
                  {selected.degree_centrality != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Degree</span>
                      <span className="text-slate-300 font-mono">
                        {selected.degree_centrality.toFixed(3)}
                      </span>
                    </div>
                  )}
                  {selected.betweenness_centrality != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Betweenness</span>
                      <span className="text-slate-300 font-mono">
                        {selected.betweenness_centrality.toFixed(3)}
                      </span>
                    </div>
                  )}
                  {selected.pagerank != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">PageRank</span>
                      <span className="text-slate-300 font-mono">
                        {selected.pagerank.toFixed(4)}
                      </span>
                    </div>
                  )}
                  {selected.community != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Cluster</span>
                      <span className="text-slate-300 font-mono">
                        #{selected.community}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Info className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                <p className="text-xs text-slate-500">
                  Click a node to inspect its risk metrics, centrality scores,
                  and cluster membership.
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
