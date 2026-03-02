import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { fetchGraphData } from "../services/api";
import { generateMockGraphData } from "../services/mockData";
import { GraphNode, GraphEdge, GraphData } from "../types";
import GlassCard from "../components/GlassCard";
import { Network, ZoomIn, ZoomOut, RotateCcw, Info, Play, Pause, RefreshCw } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  kingpin: "#ef4444",      // red — mule ring leader
  mule: "#f59e0b",         // amber — mule (rule-based)
  ml_kingpin: "#dc2626",   // bright red — ML-detected kingpin
  ml_mule: "#3b82f6",      // blue — ML-detected mule
  victim: "#10b981",
  suspect: "#f97316",
  clean: "#06b6d4",
  device: "#8b5cf6",
};

const GLOW_COLORS: Record<string, string> = {
  kingpin: "rgba(239,68,68,0.6)",
  mule: "rgba(245,158,11,0.5)",
  ml_kingpin: "rgba(220,38,38,0.7)",
  ml_mule: "rgba(59,130,246,0.6)",
  victim: "rgba(16,185,129,0.4)",
  suspect: "rgba(249,115,22,0.5)",
  clean: "rgba(6,182,212,0.3)",
  device: "rgba(139,92,246,0.4)",
};

function nodeColor(n: GraphNode) {
  const label = (n.node_label ?? n.label ?? "").toLowerCase();
  const mlDetected = (n as any).ml_detected;
  
  if (label.includes("kingpin")) return mlDetected ? NODE_COLORS.ml_kingpin : NODE_COLORS.kingpin;
  if (label.includes("mule")) return mlDetected ? NODE_COLORS.ml_mule : NODE_COLORS.mule;
  if (label.includes("victim")) return NODE_COLORS.victim;
  if (label.includes("suspect")) return NODE_COLORS.suspect;
  if (n.type === "device") return NODE_COLORS.device;
  if ((n.risk_score ?? n.riskScore) > 0.7) return NODE_COLORS.kingpin;
  if ((n.risk_score ?? n.riskScore) > 0.4) return NODE_COLORS.mule;
  return NODE_COLORS.clean;
}

function nodeGlow(n: GraphNode) {
  const label = (n.node_label ?? n.label ?? "").toLowerCase();
  const mlDetected = (n as any).ml_detected;
  
  if (label.includes("kingpin")) return mlDetected ? GLOW_COLORS.ml_kingpin : GLOW_COLORS.kingpin;
  if (label.includes("mule")) return mlDetected ? GLOW_COLORS.ml_mule : GLOW_COLORS.mule;
  if (label.includes("victim")) return GLOW_COLORS.victim;
  if (n.type === "device") return GLOW_COLORS.device;
  return GLOW_COLORS.clean;
}

export default function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadGraph = useCallback(async () => {
    try {
      const data = await fetchGraphData();
      setGraphData(data);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch {
      setGraphData(generateMockGraphData());
      setLastUpdate(new Date().toLocaleTimeString() + " (mock)");
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Polling for dynamic updates
  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(loadGraph, 10000); // 10s polling
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive, loadGraph]);

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
    const edges: Array<GraphEdge & { source: any; target: any }> = graphData.edges.map((e) => ({ ...e } as any));

    // ── Adaptive force parameters based on node count ──
    const nodeCount = nodes.length;
    const linkDist = nodeCount > 30 ? 280 : nodeCount > 15 ? 200 : 140;
    const chargeStr = nodeCount > 30 ? -1800 : nodeCount > 15 ? -1100 : -600;
    const collideR = nodeCount > 30 ? 65 : nodeCount > 15 ? 48 : 32;

    // ── Pre-position nodes in a spiral/community layout to reduce chaos ──
    const communityMap = new Map<number, number>();
    let cIdx = 0;
    nodes.forEach((n: any) => {
      const comm = n.community ?? 0;
      if (!communityMap.has(comm)) communityMap.set(comm, cIdx++);
    });
    const totalCommunities = communityMap.size || 1;

    nodes.forEach((n: any, i: number) => {
      const comm = communityMap.get(n.community ?? 0) ?? 0;
      // Place each community in a different sector around the center
      const sectorAngle = (comm / totalCommunities) * 2 * Math.PI;
      const jitter = (i / nodeCount) * Math.PI * 0.6; // spread within sector
      const baseRadius = Math.min(width, height) * 0.28;
      const radius = baseRadius + (i % 5) * 25;
      n.x = width / 2 + radius * Math.cos(sectorAngle + jitter);
      n.y = height / 2 + radius * Math.sin(sectorAngle + jitter);
    });

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(edges)
          .id((d: any) => d.id)
          .distance(linkDist),
      )
      .force("charge", d3.forceManyBody().strength(chargeStr))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(collideR))
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .alphaDecay(0.02);

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
      .attr("r", nodeCount > 25 ? 14 : 18)
      .attr("fill", (d: any) => nodeGlow(d))
      .attr("opacity", 0.4)
      .attr("filter", "url(#node-glow)");

    // Inner circle
    nodeGroup
      .append("circle")
      .attr("r", (d: any) => {
        const base = d.type === "device" ? 8 : 11;
        return nodeCount > 25 ? base * 0.75 : base;
      })
      .attr("fill", (d: any) => nodeColor(d))
      .attr("stroke", "rgba(255,255,255,0.2)")
      .attr("stroke-width", 1.5);

    // Labels
    nodeGroup
      .append("text")
      .text((d: any) => d.label || d.node_label || d.id)
      .attr("dx", nodeCount > 25 ? 12 : 16)
      .attr("dy", 4)
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", nodeCount > 25 ? "8px" : "10px")
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
            {isLive && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
            Visualizing transaction flows and device connections to identify
            mule rings.
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">
              🤖 Powered by PageRank · Louvain · Temporal GNN
            </span>
            {lastUpdate && <span className="ml-2 text-slate-600">Last update: {lastUpdate}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isLive
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-white/[0.08] bg-white/[0.04] text-slate-400"
            }`}
          >
            {isLive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isLive ? "Pause" : "Resume"}
          </button>
          <button
            onClick={loadGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
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
                { label: "ML Kingpin", color: NODE_COLORS.ml_kingpin },
                { label: "ML Mule", color: NODE_COLORS.ml_mule },
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

                {/* ── ML / AI Detection Badges ── */}
                <div className="space-y-2 pt-3 border-t border-white/5">
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">AI / ML Analysis</p>

                  {(selected as any).ml_detected ? (
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        🤖 ML Classified
                      </span>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">ML Label</span>
                        <span className="capitalize font-semibold" style={{ color: nodeColor(selected) }}>
                          {selected.node_label || selected.label || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Model</span>
                        <span className="text-purple-300 text-[10px]">Temporal GNN</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        Rule-based
                      </span>
                    </div>
                  )}

                  {/* Graph intelligence metrics */}
                  {(selected.pagerank != null || selected.betweenness_centrality != null) && (
                    <div className="mt-2 p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                      <p className="text-[9px] text-cyan-400 font-semibold mb-1">Graph Intelligence (NetworkX)</p>
                      <p className="text-[9px] text-slate-500">
                        PageRank + Betweenness + Louvain Community Detection
                      </p>
                    </div>
                  )}

                  {/* Risk scoring breakdown */}
                  <div className="mt-2 p-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                    <p className="text-[9px] text-violet-400 font-semibold mb-1">Unified Risk Score</p>
                    <p className="text-[9px] text-slate-500">
                      Cyber(30%) + Financial(25%) + Graph(20%) + ML(25%)
                    </p>
                  </div>
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
