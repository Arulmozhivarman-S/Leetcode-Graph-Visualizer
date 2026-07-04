import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

// ---- palette -------------------------------------------------------------
const C = {
  bg: "#0d0f14",
  panel: "#141821",
  panel2: "#1b2130",
  border: "#242c3a",
  text: "#e6e9ef",
  muted: "#8b94a6",
  accent: "#8b7cf6",
  accentDim: "#6d5fd6",
  edge: "#4a5468",
  weight: "#c4b8ff",
  node: "#8b7cf6",
  nodeStroke: "#c4b8ff",
  nodeText: "#0d0f14",
  danger: "#f0736a",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const NODE_R = 18;

// ---- parsing -------------------------------------------------------------
function extractArray(raw) {
  let s = (raw || "").trim();
  const i = s.indexOf("[");
  const j = s.lastIndexOf("]");
  if (i === -1 || j === -1 || j < i)
    throw new Error("Paste a bracketed array, e.g. [[0,1],[1,2]]");
  s = s.slice(i, j + 1);
  // tolerate trailing commas that valid LeetCode copies sometimes carry
  s = s.replace(/,(\s*[\]}])/g, "$1");
  return JSON.parse(s);
}

function parseGraph(raw, type, oneIndexed, directed, nCount) {
  const data = extractArray(raw);
  if (!Array.isArray(data)) throw new Error("Expected an array.");

  const linkMap = new Map();
  const nodeSet = new Set();
  let weighted = false;
  const off = oneIndexed ? 1 : 0;

  const addLink = (u, v, w) => {
    u = Number(u);
    v = Number(v);
    if (!Number.isFinite(u) || !Number.isFinite(v))
      throw new Error("Node ids must be numbers.");
    nodeSet.add(u);
    nodeSet.add(v);
    if (w !== null && w !== undefined && Number.isFinite(Number(w)))
      weighted = true;
    const key = directed
      ? `${u}->${v}`
      : `${Math.min(u, v)}-${Math.max(u, v)}`;
    linkMap.set(key, {
      source: u,
      target: v,
      weight: w === null || w === undefined ? null : Number(w),
    });
  };

  if (type === "edges") {
    data.forEach((e) => {
      if (!Array.isArray(e) || e.length < 2)
        throw new Error("Each edge needs [u, v] (optionally [u, v, w]).");
      addLink(e[0] - off, e[1] - off, e.length >= 3 ? e[2] : null);
    });
  } else if (type === "adjlist") {
    // index = node id; positions are 0-based by construction
    data.forEach((nbrs, i) => {
      nodeSet.add(i);
      if (!Array.isArray(nbrs)) return;
      nbrs.forEach((nb) => {
        if (Array.isArray(nb)) addLink(i, nb[0], nb.length >= 2 ? nb[1] : null);
        else addLink(i, nb, null);
      });
    });
  } else {
    // adjacency matrix: entry != 0 is an edge; all-1s => unweighted
    data.forEach((row, i) => {
      nodeSet.add(i);
      if (!Array.isArray(row)) return;
      row.forEach((val, j) => {
        const num = Number(val);
        if (Number.isFinite(num) && num !== 0)
          addLink(i, j, num === 1 ? null : num);
      });
    });
  }

  const n = parseInt(nCount, 10);
  if (Number.isFinite(n) && n > 0) for (let k = 0; k < n; k++) nodeSet.add(k);

  const nodes = [...nodeSet].sort((a, b) => a - b).map((id) => ({ id }));
  const links = [...linkMap.values()];
  return { nodes, links, weighted };
}

// ---- small UI atoms ------------------------------------------------------
function Toggle({ label, checked, onChange, hint }) {
  return (
    <label
      title={hint}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontSize: 13,
        color: C.text,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: C.accent, width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}

function Chip({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: C.panel2,
        color: C.text,
        border: `1px solid ${C.border}`,
        borderRadius: 7,
        padding: "5px 10px",
        fontSize: 12,
        fontFamily: SANS,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ---- main ----------------------------------------------------------------
export default function GraphVisualizer() {
  const [raw, setRaw] = useState("[[0,1],[0,2],[1,2],[2,3],[3,4],[4,0]]");
  const [type, setType] = useState("edges");
  const [directed, setDirected] = useState(false);
  const [oneIndexed, setOneIndexed] = useState(false);
  const [showWeights, setShowWeights] = useState(true);
  const [nCount, setNCount] = useState("");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [dims, setDims] = useState({ w: 800, h: 560 });

  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const posRef = useRef(new Map());
  const simRef = useRef(null);

  const graph = useMemo(() => {
    try {
      const g = parseGraph(raw, type, oneIndexed, directed, nCount);
      return { ok: true, ...g };
    } catch (e) {
      return { ok: false, error: e.message, nodes: [], links: [] };
    }
  }, [raw, type, oneIndexed, directed, nCount]);

  useEffect(() => {
    setError(graph.ok ? "" : graph.error);
  }, [graph]);

  // container sizing
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setDims({ w: Math.max(320, cr.width), h: Math.max(360, cr.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // render + simulate
  useEffect(() => {
    if (!graph.ok || !svgRef.current) return;
    const { w, h } = dims;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 9)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", C.edge);

    const root = svg.append("g");
    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (ev) => root.attr("transform", ev.transform));
    svg.call(zoom);

    // clone so d3 can mutate; seed positions to keep layout stable on toggles
    const nodes = graph.nodes.map((d) => {
      const p = posRef.current.get(d.id);
      return p ? { ...d, x: p.x, y: p.y } : { ...d };
    });
    const links = graph.links.map((d) => ({ ...d }));
    const showW = showWeights && graph.weighted;

    const linkSel = root
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", C.edge)
      .attr("stroke-width", 1.8)
      .attr("stroke-linecap", "round");
    if (directed) linkSel.attr("marker-end", "url(#arrow)");

    const wLabelSel = root
      .append("g")
      .selectAll("text")
      .data(showW ? links.filter((l) => l.weight != null) : [])
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-3")
      .attr("fill", C.weight)
      .attr("font-size", 12)
      .attr("font-family", MONO)
      .attr("paint-order", "stroke")
      .attr("stroke", C.bg)
      .attr("stroke-width", 3.5)
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none")
      .text((d) => d.weight);

    const nodeSel = root
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "grab");

    nodeSel
      .append("circle")
      .attr("r", NODE_R)
      .attr("fill", C.node)
      .attr("stroke", C.nodeStroke)
      .attr("stroke-width", 1.5);

    nodeSel
      .append("text")
      .text((d) => d.id)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", C.nodeText)
      .attr("font-size", 13)
      .attr("font-weight", 700)
      .attr("font-family", MONO)
      .style("pointer-events", "none");

    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(95)
      )
      .force("charge", d3.forceManyBody().strength(-340))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide(NODE_R + 10))
      .alpha(posRef.current.size ? 0.5 : 1)
      .on("tick", ticked);
    simRef.current = sim;

    function ticked() {
      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => {
          const dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            L = Math.hypot(dx, dy) || 1;
          return d.target.x - (dx / L) * NODE_R;
        })
        .attr("y2", (d) => {
          const dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            L = Math.hypot(dx, dy) || 1;
          return d.target.y - (dy / L) * NODE_R;
        });
      wLabelSel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      nodes.forEach((n) => posRef.current.set(n.id, { x: n.x, y: n.y }));
    }

    const drag = d3
      .drag()
      .on("start", (event, d) => {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeSel.call(drag);

    return () => sim.stop();
  }, [graph, dims, showWeights, nonce]);

  const relayout = () => {
    posRef.current.clear();
    setNonce((n) => n + 1);
  };

  const presets = [
    {
      label: "Unweighted",
      apply: () => {
        setType("edges");
        setDirected(false);
        setRaw("[[0,1],[0,2],[1,2],[2,3],[3,4],[4,0]]");
      },
    },
    {
      label: "Weighted (Dijkstra)",
      apply: () => {
        setType("edges");
        setDirected(true);
        setRaw("[[0,1,4],[0,2,1],[2,1,2],[1,3,1],[2,3,5]]");
      },
    },
    {
      label: "Adjacency list",
      apply: () => {
        setType("adjlist");
        setDirected(false);
        setRaw("[[1,2],[0,2],[0,1,3],[2]]");
      },
    },
    {
      label: "Adjacency matrix",
      apply: () => {
        setType("matrix");
        setDirected(false);
        setRaw("[[0,1,0,1],[1,0,1,0],[0,1,0,1],[1,0,1,0]]");
      },
    },
  ];

  const inputStyle = {
    background: C.panel2,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: SANS,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: SANS,
        borderRadius: 14,
        padding: 18,
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        minHeight: 600,
      }}
    >
      {/* controls */}
      <div
        style={{
          flex: "1 1 300px",
          minWidth: 280,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <div
            style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}
          >
            Graph visualizer
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
            Paste a LeetCode input and see the graph.
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {presets.map((p) => (
            <Chip key={p.label} onClick={p.apply}>
              {p.label}
            </Chip>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>
            Input
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            style={{
              ...inputStyle,
              fontFamily: MONO,
              minHeight: 90,
              resize: "vertical",
              lineHeight: 1.5,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>
              Format
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={inputStyle}
            >
              <option value="edges">Edge list</option>
              <option value="adjlist">Adjacency list</option>
              <option value="matrix">Adjacency matrix</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>
              Nodes (n)
            </div>
            <input
              value={nCount}
              onChange={(e) => setNCount(e.target.value)}
              placeholder="auto"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Toggle
            label="Directed"
            checked={directed}
            onChange={setDirected}
            hint="Draw arrowheads; keep u→v and v→u separate"
          />
          <Toggle
            label="1-indexed input"
            checked={oneIndexed}
            onChange={setOneIndexed}
            hint="Shift edge-list node ids down by 1 (edge list only)"
          />
          <Toggle
            label="Show edge weights"
            checked={showWeights}
            onChange={setShowWeights}
          />
        </div>

        <button
          onClick={relayout}
          style={{
            background: C.accent,
            color: "#0d0f14",
            border: "none",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: SANS,
            cursor: "pointer",
          }}
        >
          Re-layout
        </button>

        {error ? (
          <div
            style={{
              background: "rgba(240,115,106,0.12)",
              border: `1px solid ${C.danger}`,
              color: C.danger,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12.5,
              fontFamily: MONO,
            }}
          >
            {error}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: C.muted }}>
            {graph.nodes.length} nodes · {graph.links.length} edges ·{" "}
            {graph.weighted ? "weighted" : "unweighted"}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6 }}>
          Drag nodes to reposition · scroll to zoom · drag canvas to pan.
        </div>
      </div>

      {/* canvas */}
      <div
        ref={wrapRef}
        style={{
          flex: "2 1 380px",
          minWidth: 320,
          minHeight: 560,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: "block", minHeight: 560 }}
        />
      </div>
    </div>
  );
}
