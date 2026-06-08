import type { TraceabilityGraph } from "../../types.js";
import type { AnalysisKnowledge } from "../graph/knowledge.js";
import type { GraphStats, KnowledgeStats } from "./stats.js";

export interface VisualizePayload {
  generatedAt: string;
  projectRoot: string;
  graph: TraceabilityGraph;
  knowledge: AnalysisKnowledge | null;
  graphStats: GraphStats;
  knowledgeStats: KnowledgeStats;
}

function escapeJsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildVisualizationHtml(payload: VisualizePayload): string {
  const embedded = escapeJsonForScript(payload);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Spector — Graph &amp; Knowledge</title>
  <script src="https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a2332;
      --border: #2d3a4d;
      --text: #e7ecf3;
      --muted: #8b9cb3;
      --accent: #3b82f6;
      --green: #22c55e;
      --red: #f87171;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "SF Pro Text", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      align-items: baseline;
    }
    header h1 { margin: 0; font-size: 1.05rem; font-weight: 600; }
    header .meta { color: var(--muted); font-size: 0.8rem; }
    nav.tabs {
      display: flex;
      gap: 0.25rem;
      padding: 0.5rem 1.25rem 0;
      border-bottom: 1px solid var(--border);
    }
    nav.tabs button {
      background: transparent;
      border: none;
      color: var(--muted);
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.875rem;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    nav.tabs button.active { color: var(--text); border-bottom-color: var(--accent); }
    .panel { display: none; padding: 1rem 1.25rem 1.5rem; }
    .panel.active { display: block; }

    /* Overview */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 0.6rem;
      margin-bottom: 1rem;
    }
    .stat-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.65rem 0.9rem;
    }
    .stat-card .label { font-size: 0.72rem; color: var(--muted); }
    .stat-card .value { font-size: 1.3rem; font-weight: 600; margin-top: 0.15rem; }
    .section-title { font-size: 0.9rem; margin: 1.1rem 0 0.45rem; color: var(--muted); font-weight: 500; }

    /* Graph panel */
    .graph-layout {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 0.75rem;
      align-items: start;
    }
    @media (max-width: 900px) { .graph-layout { grid-template-columns: 1fr; } }
    .graph-main {}
    .graph-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 0.75rem;
      align-items: center;
      margin-bottom: 0.6rem;
    }
    .graph-toolbar label { font-size: 0.82rem; color: var(--muted); display: flex; align-items: center; gap: 0.35rem; }
    .graph-toolbar select, .graph-toolbar input[type=search], .graph-toolbar input[type=text] {
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.3rem 0.55rem;
      border-radius: 6px;
      font-size: 0.82rem;
    }
    .toolbar-btn {
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      font-size: 0.82rem;
      cursor: pointer;
    }
    .toolbar-btn:hover { border-color: var(--accent); }
    .toolbar-btn.active { border-color: var(--accent); color: var(--accent); }
    #graph-network {
      width: 100%;
      height: min(68vh, 620px);
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #121820;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 0.9rem;
      margin-top: 0.5rem;
      font-size: 0.72rem;
      color: var(--muted);
    }
    .legend span { display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer; }
    .legend span:hover { color: var(--text); }
    .legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

    /* Side panel / node detail */
    .side-panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 0.82rem;
      min-height: 200px;
      max-height: min(68vh, 620px);
      overflow-y: auto;
    }
    .side-panel .node-id { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.3rem; font-family: ui-monospace, monospace; word-break: break-all; }
    .side-panel .node-title { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.5rem; }
    .side-panel .node-type { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; margin-bottom: 0.6rem; }
    .side-panel .edge-section { margin-top: 0.6rem; }
    .side-panel .edge-section-title { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.3rem; }
    .side-panel .edge-group { margin-bottom: 0.4rem; }
    .side-panel .edge-type-label { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.15rem; }
    .side-panel .edge-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0;
      cursor: pointer;
      border-radius: 4px;
    }
    .side-panel .edge-item:hover { background: rgba(59,130,246,0.1); }
    .side-panel .edge-item .ei-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .side-panel .edge-item .ei-label { font-size: 0.78rem; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .side-panel .edge-item .ei-type { font-size: 0.68rem; color: var(--muted); flex-shrink: 0; }
    .side-panel .props { margin-top: 0.5rem; }
    .side-panel .prop-row { display: flex; gap: 0.5rem; padding: 0.15rem 0; border-bottom: 1px solid var(--border); font-size: 0.78rem; }
    .side-panel .prop-key { color: var(--muted); flex-shrink: 0; min-width: 80px; }
    .side-panel .prop-val { color: var(--text); word-break: break-word; }
    .side-panel .hint { color: var(--muted); font-style: italic; }
    #focus-btn { display: none; }

    /* Edge filter */
    .edge-filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 0.5rem;
      margin-bottom: 0.6rem;
    }
    .ef-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.18rem 0.5rem;
      border-radius: 20px;
      font-size: 0.72rem;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--muted);
      transition: all 0.1s;
    }
    .ef-chip.on { background: var(--panel); color: var(--text); border-color: var(--accent); }
    .ef-chip i { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block; }

    /* Tables */
    table.data { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    table.data th, table.data td { text-align: left; padding: 0.45rem 0.65rem; border-bottom: 1px solid var(--border); }
    table.data th { color: var(--muted); font-weight: 500; }
    table.data tr:hover td { background: var(--panel); }
    .empty { color: var(--muted); font-style: italic; padding: 0.75rem 0; }
    .badge { display: inline-block; padding: 0.12rem 0.4rem; border-radius: 4px; font-size: 0.68rem; background: var(--border); margin-left: 0.3rem; }
    .status-ok { color: var(--green); }
    .status-miss { color: var(--red); }
  </style>
</head>
<body>
  <header>
    <h1>AI Spector — Traceability Graph</h1>
    <span class="meta" id="header-meta"></span>
  </header>
  <nav class="tabs" role="tablist">
    <button type="button" class="active" data-tab="overview">Overview</button>
    <button type="button" data-tab="graph">Graph</button>
    <button type="button" data-tab="knowledge">Knowledge</button>
  </nav>

  <section id="panel-overview" class="panel active"></section>

  <section id="panel-graph" class="panel">
    <div class="graph-toolbar">
      <label>View
        <select id="filter-view">
          <option value="all">Full graph</option>
          <option value="domain">Domain + documents</option>
          <option value="structure">Documents + sections</option>
        </select>
      </label>
      <label>Search <input type="search" id="filter-search" placeholder="id or title…" style="width:160px" /></label>
      <label>Layout
        <select id="filter-layout">
          <option value="physics">Force</option>
          <option value="hierarchical">Hierarchical</option>
        </select>
      </label>
      <button class="toolbar-btn" id="focus-btn" title="Show only selected node and neighbors">Focus</button>
      <button class="toolbar-btn" id="reset-btn">Reset view</button>
    </div>
    <div class="edge-filter-bar" id="edge-filter-bar"></div>
    <div class="graph-layout">
      <div class="graph-main">
        <div id="graph-network"></div>
        <div class="legend" id="legend"></div>
      </div>
      <div class="side-panel" id="node-detail">
        <div class="hint">Click a node to inspect its properties and connections.</div>
      </div>
    </div>
  </section>

  <section id="panel-knowledge" class="panel"></section>

  <script type="application/json" id="payload">${embedded}</script>
  <script>
(function () {
  const P = JSON.parse(document.getElementById("payload").textContent);

  const NODE_COLORS = {
    document: "#3b82f6",
    file: "#38bdf8",
    source: "#14b8a6",
    section: "#64748b",
    table: "#475569",
    diagram: "#475569",
    actor: "#a855f7",
    useCase: "#22c55e",
    feature: "#f59e0b",
    requirement: "#ec4899",
    nfr: "#f97316",
    dataEntity: "#06b6d4",
  };

  const STRUCTURE = new Set(["document", "section", "table", "diagram"]);
  const DOMAIN_TYPES = new Set(["actor", "useCase", "feature", "requirement", "nfr", "dataEntity"]);

  // All edge types in graph
  const allEdgeTypes = [...new Set(P.graph.edges.map((e) => e.type))].sort();
  // Which edge types are shown (default: all on)
  const edgeTypeOn = new Set(allEdgeTypes);

  // ---- TABS ----
  document.querySelectorAll("nav.tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
      // Defer initGraph so the browser can reflow the panel (display:none → block)
      // before vis-network measures the container dimensions.
      if (btn.dataset.tab === "graph" && !window.__network) {
        requestAnimationFrame(() => initGraph());
      } else if (btn.dataset.tab === "graph") {
        requestAnimationFrame(() => window.__network && window.__network.redraw());
      }
    });
  });

  document.getElementById("header-meta").textContent =
    P.projectRoot + " · " + new Date(P.generatedAt).toLocaleString();

  const EDGE_MEANINGS = {
    partOf: "section belongs to document",
    contains: "document/section contains another",
    follows: "section ordering",
    references: "cross-reference",
    listedIn: "domain node listed in section",
    definedIn: "domain node detailed in section",
    describedIn: "domain node described by section",
    satisfies: "feature satisfies use case",
    dependsOn: "document depends on another document",
    requires: "domain node requires another",
    tracesTo: "requirement traces to document",
    derivedFrom: "node derived from source file",
    rendersTo: "graph node renders to markdown path",
    relatesTo: "semantic link (evidence)",
  };

  // ---- OVERVIEW ----
  const ov = document.getElementById("panel-overview");
  const gs = P.graphStats;
  const ks = P.knowledgeStats;
  ov.innerHTML =
    '<div class="stats-grid">' +
    stat("Graph nodes", gs.nodes) +
    stat("Graph edges", gs.edges) +
    stat("Domain nodes", gs.domainNodes) +
    stat("Structure nodes", gs.structureNodes) +
    (ks.present ? stat("Knowledge UCs", ks.useCases) : "") +
    (ks.present ? stat("Knowledge features", ks.features) : stat("Knowledge", "—")) +
    "</div>" +
    '<p class="section-title">Nodes by type</p>' +
    typeTable(gs.byType) +
    '<p class="section-title">Edge types</p>' +
    edgeTypeTable();

  function stat(label, value) {
    return '<div class="stat-card"><div class="label">' + label + '</div><div class="value">' + value + "</div></div>";
  }
  function typeTable(byType) {
    return '<table class="data"><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>' +
      Object.entries(byType).sort((a, b) => b[1] - a[1])
        .map(([t, n]) => '<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (NODE_COLORS[t] || "#94a3b8") + ';margin-right:6px"></span>' + t + '</td><td>' + n + '</td></tr>').join("") +
      '</tbody></table>';
  }
  function edgeTypeTable() {
    const counts = {};
    for (const e of P.graph.edges) counts[e.type] = (counts[e.type] || 0) + 1;
    return '<table class="data"><thead><tr><th>Edge type</th><th>Count</th><th>Meaning</th></tr></thead><tbody>' +
      Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => '<tr><td>' + t + '</td><td>' + n + '</td><td style="color:var(--muted);font-size:0.78rem">' + EDGE_MEANINGS[t] + "</td></tr>").join("") +
      '</tbody></table>';
  }

  // ---- EDGE FILTER CHIPS ----
  const efBar = document.getElementById("edge-filter-bar");
  for (const et of allEdgeTypes) {
    const chip = document.createElement("span");
    chip.className = "ef-chip on";
    chip.dataset.et = et;
    chip.innerHTML = '<i></i>' + et;
    chip.title = EDGE_MEANINGS[et] || et;
    chip.addEventListener("click", () => {
      if (edgeTypeOn.has(et)) { edgeTypeOn.delete(et); chip.classList.remove("on"); }
      else { edgeTypeOn.add(et); chip.classList.add("on"); }
      rebuildGraph();
    });
    efBar.appendChild(chip);
  }

  // ---- KNOWLEDGE PANEL ----
  const kn = document.getElementById("panel-knowledge");
  if (!P.knowledge || !ks.present) {
    kn.innerHTML = '<p class="empty">No knowledge.json loaded — run /analyze in Cursor.</p>';
  } else {
    const graphIds = new Set(P.graph.nodes.map((n) => n.id));
    kn.innerHTML =
      knowledgeTable("Actors", P.knowledge.actors, ["id", "name", "title"], graphIds) +
      knowledgeTable("Use cases", P.knowledge.useCases, ["id", "title", "priority"], graphIds) +
      knowledgeTable("Features", P.knowledge.features, ["id", "title", "satisfies"], graphIds) +
      knowledgeTable("Functional requirements", P.knowledge.functionalRequirements, ["id", "title", "tracesTo"], graphIds) +
      knowledgeTable("NFRs", P.knowledge.nfrs, ["id", "title"], graphIds) +
      knowledgeTable("Data entities", P.knowledge.entities, ["id", "name"], graphIds);
  }

  function knowledgeTable(title, rows, cols, graphIds) {
    if (!rows || !rows.length) return '<p class="section-title">' + title + ' <span class="badge">0</span></p><p class="empty">(empty)</p>';
    const inGraph = rows.filter((r) => graphIds.has(r.id)).length;
    const head = "<th>In graph</th>" + cols.map((c) => "<th>" + c + "</th>").join("");
    const body = rows.map((row) => {
      const merged = graphIds.has(row.id);
      const statusCell = '<td class="' + (merged ? "status-ok" : "status-miss") + '">' + (merged ? "✓" : "✗") + "</td>";
      const dataCells = cols.map((c) => {
        let v = row[c];
        if (Array.isArray(v)) v = v.join(", ");
        if (v === undefined || v === null) v = "";
        return "<td>" + escapeHtml(String(v)) + "</td>";
      }).join("");
      return "<tr>" + statusCell + dataCells + "</tr>";
    }).join("");
    return '<p class="section-title">' + title +
      ' <span class="badge">' + rows.length + "</span>" +
      ' <span class="badge status-ok">' + inGraph + " in graph</span>" +
      (inGraph < rows.length ? ' <span class="badge status-miss">' + (rows.length - inGraph) + " missing</span>" : "") +
      "</p>" +
      '<table class="data"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---- LEGEND ----
  const legend = document.getElementById("legend");
  legend.innerHTML = Object.entries(NODE_COLORS).map(([t, c]) =>
    '<span title="Click to highlight" data-ntype="' + t + '"><i style="background:' + c + '"></i>' + t + "</span>"
  ).join("");
  legend.querySelectorAll("span").forEach((span) => {
    span.addEventListener("click", () => {
      const t = span.dataset.ntype;
      if (window.__network) {
        const ids = P.graph.nodes.filter((n) => n.type === t).map((n) => n.id);
        window.__network.selectNodes(ids);
        if (ids.length) window.__network.focus(ids[0], { scale: 1.2, animation: true });
      }
    });
  });

  // ---- GRAPH ----
  let network = null;
  let focusedNodeId = null;
  window.__network = null;

  function fileNodeId(path) { return "file:" + path; }
  function sourceNodeId(path) { return "source:" + path; }

  function nodeLabel(n) {
    const t = n.title || n.heading || n.name || n.id;
    return t.length > 36 ? t.slice(0, 34) + "…" : t;
  }

  function domainLinkedStructureIds(domainIds) {
    const linked = new Set();
    for (const e of P.graph.edges) {
      if (!["listedIn", "definedIn", "describedIn"].includes(e.type)) continue;
      if (!domainIds.has(e.from)) continue;
      const target = P.graph.nodes.find((n) => n.id === e.to);
      if (target && (STRUCTURE.has(target.type) || target.type === "document")) linked.add(e.to);
    }
    return linked;
  }

  function domainLinkedSourceIds(domainIds) {
    const linked = new Set();
    for (const e of P.graph.edges) {
      if (e.type !== "derivedFrom" || !domainIds.has(e.from)) continue;
      linked.add(sourceNodeId(e.to));
    }
    return linked;
  }

  function filterNodes(viewMode, search, focusId) {
    const q = (search || "").trim().toLowerCase();
    let nodes = P.graph.nodes.filter((n) => {
      if (viewMode === "structure") return STRUCTURE.has(n.type);
      if (viewMode === "domain") return n.type !== "table" && n.type !== "diagram";
      return true;
    });

    if (q) {
      nodes = nodes.filter((n) => {
        const hay = (n.id + " " + (n.title || "") + " " + (n.heading || "") + " " + (n.name || "")).toLowerCase();
        return hay.includes(q);
      });
      return nodes;
    }

    if (focusId) {
      const neighbors = new Set([focusId]);
      for (const e of P.graph.edges) {
        if (!edgeTypeOn.has(e.type)) continue;
        if (e.from === focusId) neighbors.add(e.to);
        if (e.to === focusId) neighbors.add(e.from);
      }
      return nodes.filter((n) => neighbors.has(n.id));
    }

    if (viewMode === "domain") {
      const domainIds = new Set(nodes.filter((n) => DOMAIN_TYPES.has(n.type)).map((n) => n.id));
      const linked = domainLinkedStructureIds(domainIds);
      const srcLinked = domainLinkedSourceIds(domainIds);
      return nodes.filter((n) => DOMAIN_TYPES.has(n.type) || linked.has(n.id) || srcLinked.has(n.id));
    }
    return nodes;
  }

  function buildVisData(viewMode, search, focusId) {
    const nodes = filterNodes(viewMode, search, focusId);
    const ids = new Set(nodes.map((n) => n.id));
    const pathsWithDocument = new Set(
      P.graph.nodes.filter((n) => n.type === "document" && typeof n.output === "string").map((n) => n.output)
    );
    const fileNodes = new Map();
    const sourceNodes = new Map();
    for (const e of P.graph.edges) {
      if (!edgeTypeOn.has(e.type)) continue;
      if (e.type === "derivedFrom" && ids.has(e.from)) {
        const sid = sourceNodeId(e.to);
        if (!sourceNodes.has(sid)) {
          const base = e.to.split("/").pop() || e.to;
          sourceNodes.set(sid, { id: sid, type: "source", title: base, output: e.to });
        }
        continue;
      }
      if (e.type !== "rendersTo" || !ids.has(e.from) || ids.has(e.to) || pathsWithDocument.has(e.to)) continue;
      const fid = fileNodeId(e.to);
      if (!fileNodes.has(fid)) {
        const base = e.to.split("/").pop() || e.to;
        fileNodes.set(fid, { id: fid, type: "file", title: base, output: e.to });
      }
    }
    const pathToDocId = new Map();
    for (const n of P.graph.nodes) {
      if (n.type === "document" && typeof n.output === "string") pathToDocId.set(n.output, n.id);
    }
    const allNodes = nodes.concat([...fileNodes.values()], [...sourceNodes.values()]);
    const allIds = new Set(allNodes.map((n) => n.id));
    function resolveTarget(to) {
      if (allIds.has(to)) return to;
      const d = pathToDocId.get(to);
      if (d && allIds.has(d)) return d;
      if (fileNodes.has(fileNodeId(to))) return fileNodeId(to);
      if (sourceNodes.has(sourceNodeId(to))) return sourceNodeId(to);
      return null;
    }
    const visNodes = allNodes.map((n) => {
      const isFocused = n.id === focusId;
      const isNeighbor = focusId && n.id !== focusId;
      return {
        id: n.id,
        label: nodeLabel(n),
        title: buildTooltip(n),
        color: {
          background: isFocused ? "#facc15" : (NODE_COLORS[n.type] || "#94a3b8"),
          border: isFocused ? "#f59e0b" : (NODE_COLORS[n.type] || "#94a3b8"),
          highlight: { background: "#facc15", border: "#f59e0b" },
        },
        opacity: focusId && !isFocused ? 0.4 : 1,
        font: { color: "#e7ecf3", size: 11 },
        shape: STRUCTURE.has(n.type) || n.type === "file" || n.type === "source" ? "box" : "dot",
        size: n.type === "section" ? 10 : STRUCTURE.has(n.type) ? 12 : n.type === "file" || n.type === "source" ? 13 : 18,
        borderWidth: isFocused ? 3 : 1,
      };
    });
    const visEdges = P.graph.edges
      .filter((e) => edgeTypeOn.has(e.type))
      .map((e) => ({ e, to: resolveTarget(e.to) }))
      .filter(({ e, to }) => to !== null && allIds.has(e.from))
      .map(({ e, to }, i) => ({
        id: i,
        from: e.from,
        to,
        label: e.type,
        font: { size: 9, color: "#8b9cb3", strokeWidth: 0 },
        color: { color: "#3a4a5e", highlight: "#60a5fa" },
        arrows: "to",
        smooth: { type: "dynamic" },
      }));
    return { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) };
  }

  function buildTooltip(n) {
    const props = Object.entries(n)
      .filter(([k]) => !["id", "type"].includes(k))
      .map(([k, v]) => k + ": " + (typeof v === "object" ? JSON.stringify(v) : v))
      .join("\\n");
    return "<pre style=\\"margin:0;font-size:11px;max-width:320px;white-space:pre-wrap\\">" + escapeHtml((n.id || "") + " [" + n.type + "]\\n" + props) + "</pre>";
  }

  function graphEmptyMsg() {
    const container = document.getElementById("graph-network");
    if (P.graph.nodes.length === 0) {
      container.innerHTML = '<div style="color:#8b9cb3;padding:2rem;text-align:center">Graph is empty — run <code>npx ai-spector analyze</code> then <code>npx ai-spector graph merge</code></div>';
      return true;
    }
    return false;
  }

  function rebuildGraph() {
    if (!window.__network) return;
    const viewMode = document.getElementById("filter-view").value;
    const search = document.getElementById("filter-search").value;
    const data = buildVisData(viewMode, search, focusedNodeId);
    window.__network.setData(data);
    applyLayout();
  }

  function applyLayout() {
    if (!window.__network) return;
    const layout = document.getElementById("filter-layout").value;
    if (layout === "hierarchical") {
      window.__network.setOptions({
        layout: { hierarchical: { enabled: true, direction: "UD", sortMethod: "hubsize", nodeSpacing: 120 } },
        physics: { enabled: false },
      });
    } else {
      window.__network.setOptions({
        layout: { hierarchical: { enabled: false } },
        physics: { enabled: true, stabilization: { iterations: 100 } },
      });
    }
  }

  function initGraph() {
    if (graphEmptyMsg()) return;
    const container = document.getElementById("graph-network");
    const viewMode = document.getElementById("filter-view").value;
    const search = document.getElementById("filter-search").value;
    const data = buildVisData(viewMode, search, null);
    network = new vis.Network(container, data, {
      physics: { enabled: true, stabilization: { iterations: 100 } },
      interaction: { hover: true, tooltipDelay: 100, multiselect: false },
      layout: { improvedLayout: true },
    });
    window.__network = network;

    network.on("click", (params) => {
      if (!params.nodes.length) {
        renderDetail(null);
        return;
      }
      const id = params.nodes[0];
      renderDetail(id);
      document.getElementById("focus-btn").style.display = "inline-block";
    });

    network.on("doubleClick", (params) => {
      if (!params.nodes.length) return;
      toggleFocus(params.nodes[0]);
    });
  }

  function toggleFocus(id) {
    if (focusedNodeId === id) {
      focusedNodeId = null;
      document.getElementById("focus-btn").classList.remove("active");
    } else {
      focusedNodeId = id;
      document.getElementById("focus-btn").classList.add("active");
    }
    rebuildGraph();
  }

  document.getElementById("focus-btn").addEventListener("click", () => {
    if (focusedNodeId) toggleFocus(focusedNodeId);
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    focusedNodeId = null;
    document.getElementById("focus-btn").classList.remove("active");
    document.getElementById("filter-search").value = "";
    rebuildGraph();
    if (window.__network) window.__network.fit({ animation: true });
  });

  ["filter-view", "filter-search", "filter-layout"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
      focusedNodeId = null;
      rebuildGraph();
      if (id === "filter-layout") applyLayout();
    });
    el.addEventListener("input", () => rebuildGraph());
  });

  // ---- NODE DETAIL PANEL ----
  function renderDetail(id) {
    const detail = document.getElementById("node-detail");
    if (!id) {
      detail.innerHTML = '<div class="hint">Click a node to inspect. Double-click to focus its neighborhood.</div>';
      return;
    }
    const node = P.graph.nodes.find((n) => n.id === id);
    if (!node) {
      detail.innerHTML = '<div class="hint">Node not in base graph (file/source node).</div>';
      return;
    }

    // Partition edges
    const outEdges = P.graph.edges.filter((e) => e.from === id);
    const inEdges = P.graph.edges.filter((e) => e.to === id);

    function groupByType(edges, dir) {
      const groups = {};
      for (const e of edges) {
        const key = e.type;
        if (!groups[key]) groups[key] = [];
        const otherId = dir === "out" ? e.to : e.from;
        const otherNode = P.graph.nodes.find((n) => n.id === otherId);
        const label = otherNode ? (otherNode.title || otherNode.heading || otherNode.name || otherId) : otherId;
        const type = otherNode ? otherNode.type : "?";
        groups[key].push({ id: otherId, label, type });
      }
      return groups;
    }

    function renderEdgeGroups(groups, dir) {
      const entries = Object.entries(groups);
      if (!entries.length) return '<div class="hint" style="font-size:0.75rem">none</div>';
      return entries.map(([et, items]) =>
        '<div class="edge-group">' +
        '<div class="edge-type-label">' + et + ' (' + items.length + ')</div>' +
        items.slice(0, 12).map((item) =>
          '<div class="edge-item" data-target="' + escapeHtml(item.id) + '">' +
          '<span class="ei-dot" style="background:' + (NODE_COLORS[item.type] || "#94a3b8") + '"></span>' +
          '<span class="ei-label" title="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</span>' +
          '<span class="ei-type">' + item.type + '</span>' +
          '</div>'
        ).join("") +
        (items.length > 12 ? '<div style="font-size:0.72rem;color:var(--muted);padding:0.1rem 0">+' + (items.length - 12) + ' more…</div>' : "") +
        "</div>"
      ).join("");
    }

    // Render props (exclude standard fields)
    const skipKeys = new Set(["id", "type", "title", "heading", "name"]);
    const propRows = Object.entries(node)
      .filter(([k]) => !skipKeys.has(k))
      .map(([k, v]) => {
        const val = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
        return '<div class="prop-row"><span class="prop-key">' + escapeHtml(k) + '</span><span class="prop-val">' + escapeHtml(val) + '</span></div>';
      }).join("");

    const outGroups = groupByType(outEdges, "out");
    const inGroups = groupByType(inEdges, "in");

    detail.innerHTML =
      '<div class="node-id">' + escapeHtml(node.id) + '</div>' +
      '<div class="node-title">' + escapeHtml(node.title || node.heading || node.name || node.id) + '</div>' +
      '<div><span class="node-type" style="background:' + (NODE_COLORS[node.type] || "#64748b") + '33;color:' + (NODE_COLORS[node.type] || "#94a3b8") + '">' + node.type + '</span></div>' +
      (propRows ? '<div class="props">' + propRows + '</div>' : '') +
      '<div class="edge-section">' +
      '<div class="edge-section-title">Outgoing (' + outEdges.length + ')</div>' +
      renderEdgeGroups(outGroups, "out") +
      '</div>' +
      '<div class="edge-section">' +
      '<div class="edge-section-title">Incoming (' + inEdges.length + ')</div>' +
      renderEdgeGroups(inGroups, "in") +
      '</div>';

    // Make edge items clickable → select node in graph
    detail.querySelectorAll(".edge-item").forEach((item) => {
      item.addEventListener("click", () => {
        const targetId = item.dataset.target;
        if (!window.__network) return;
        renderDetail(targetId);
        const allVis = window.__network.body.data.nodes.getIds();
        if (allVis.includes(targetId)) {
          window.__network.selectNodes([targetId]);
          window.__network.focus(targetId, { scale: 1.3, animation: { duration: 300 } });
        }
      });
    });
  }
})();
  </script>
</body>
</html>`;
}
