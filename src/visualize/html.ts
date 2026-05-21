import type { TraceabilityGraph } from "../types.js";
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
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1.5rem;
      align-items: baseline;
    }
    header h1 { margin: 0; font-size: 1.15rem; font-weight: 600; }
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
      padding: 0.6rem 1rem;
      cursor: pointer;
      font-size: 0.9rem;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    nav.tabs button.active {
      color: var(--text);
      border-bottom-color: var(--accent);
    }
    .panel { display: none; padding: 1rem 1.25rem 1.5rem; }
    .panel.active { display: block; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .stat-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
    }
    .stat-card .label { font-size: 0.75rem; color: var(--muted); }
    .stat-card .value { font-size: 1.35rem; font-weight: 600; margin-top: 0.2rem; }
    .graph-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .graph-toolbar label { font-size: 0.85rem; color: var(--muted); display: flex; align-items: center; gap: 0.4rem; }
    .graph-toolbar select, .graph-toolbar input {
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      font-size: 0.85rem;
    }
    #graph-network {
      width: 100%;
      height: min(70vh, 640px);
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #121820;
    }
    #node-detail {
      margin-top: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.85rem;
      min-height: 4rem;
      white-space: pre-wrap;
      font-family: ui-monospace, monospace;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin-top: 0.75rem;
      font-size: 0.75rem;
    }
    .legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
    .legend i {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    table.data th, table.data td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    table.data th { color: var(--muted); font-weight: 500; }
    table.data tr:hover td { background: var(--panel); }
    .empty { color: var(--muted); font-style: italic; padding: 1rem 0; }
    .section-title { font-size: 1rem; margin: 1.25rem 0 0.5rem; color: var(--muted); }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.7rem;
      background: var(--border);
      margin-left: 0.35rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>AI Spector — Graph &amp; Knowledge</h1>
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
          <option value="domain">Domain + documents</option>
          <option value="structure">Documents + sections</option>
          <option value="all">Full graph</option>
        </select>
      </label>
      <label>Search <input type="search" id="filter-search" placeholder="node id or title…" /></label>
      <label><input type="checkbox" id="filter-physics" checked /> Physics</label>
    </div>
    <div id="graph-network"></div>
    <div class="legend" id="legend"></div>
    <div id="node-detail">Click a node to inspect.</div>
  </section>
  <section id="panel-knowledge" class="panel"></section>

  <script type="application/json" id="payload">${embedded}</script>
  <script>
(function () {
  const P = JSON.parse(document.getElementById("payload").textContent);

  const NODE_COLORS = {
    document: "#3b82f6",
    section: "#64748b",
    table: "#475569",
    diagram: "#475569",
    actor: "#a855f7",
    useCase: "#22c55e",
    feature: "#f59e0b",
    requirement: "#ec4899",
    dataEntity: "#06b6d4",
  };

  const STRUCTURE = new Set(["document", "section", "table", "diagram"]);

  document.getElementById("header-meta").textContent =
    P.projectRoot + " · generated " + new Date(P.generatedAt).toLocaleString();

  // Tabs
  document.querySelectorAll("nav.tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "graph" && !window.__network) initGraph();
    });
  });

  // Overview
  const ov = document.getElementById("panel-overview");
  const gs = P.graphStats;
  const ks = P.knowledgeStats;
  ov.innerHTML =
    '<div class="stats-grid">' +
    stat("Graph nodes", gs.nodes) +
    stat("Graph edges", gs.edges) +
    stat("Domain nodes", gs.domainNodes) +
    stat("Structure nodes", gs.structureNodes) +
    (ks.present ? stat("Knowledge use cases", ks.useCases) : stat("Knowledge", "—")) +
    (ks.present ? stat("Knowledge features", ks.features) : "") +
    "</div>" +
    "<p class=\\"section-title\\">Nodes by type</p>" +
    typeBreakdown(gs.byType) +
    (ks.present ? "<p class=\\"section-title\\">Knowledge staging (not merged yet?)</p><p>Compare tables in the <strong>Knowledge</strong> tab with domain nodes in the <strong>Graph</strong> tab.</p>" : "<p class=\\"empty\\">No knowledge.json found — run /analyze in Cursor.</p>");

  function stat(label, value) {
    return '<div class="stat-card"><div class="label">' + label + '</div><div class="value">' + value + "</div></div>";
  }
  function typeBreakdown(byType) {
    return "<table class=data><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>" +
      Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => "<tr><td>" + t + "</td><td>" + n + "</td></tr>").join("") +
      "</tbody></table>";
  }

  // Knowledge panel
  const kn = document.getElementById("panel-knowledge");
  if (!P.knowledge || !ks.present) {
    kn.innerHTML = '<p class="empty">No knowledge.json loaded.</p>';
  } else {
    kn.innerHTML =
      knowledgeTable("Actors", P.knowledge.actors, ["id", "name", "title", "listedInSection"]) +
      knowledgeTable("Use cases", P.knowledge.useCases, ["id", "title", "priority", "listedInSection"]) +
      knowledgeTable("Features", P.knowledge.features, ["id", "title", "satisfies", "listedInSection"]) +
      knowledgeTable("Functional requirements", P.knowledge.functionalRequirements, ["id", "title", "tracesTo", "listedInSection"]) +
      knowledgeTable("NFRs", P.knowledge.nfrs, ["id", "title", "listedInSection"]) +
      knowledgeTable("Entities", P.knowledge.entities, ["id", "name", "listedInSection"]);
  }

  function knowledgeTable(title, rows, cols) {
    if (!rows || !rows.length) return '<p class="section-title">' + title + ' <span class="badge">0</span></p><p class="empty">(empty)</p>';
    const head = cols.map((c) => "<th>" + c + "</th>").join("");
    const body = rows.map((row) =>
      "<tr>" + cols.map((c) => {
        let v = row[c];
        if (Array.isArray(v)) v = v.join(", ");
        if (v === undefined || v === null) v = "";
        return "<td>" + escapeHtml(String(v)) + "</td>";
      }).join("") + "</tr>"
    ).join("");
    return '<p class="section-title">' + title + ' <span class="badge">' + rows.length + "</span></p>" +
      '<table class="data"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Legend
  const legend = document.getElementById("legend");
  legend.innerHTML = Object.entries(NODE_COLORS).map(([t, c]) =>
    '<span><i style="background:' + c + '"></i>' + t + "</span>"
  ).join("");

  let network = null;
  window.__network = null;

  function nodeLabel(n) {
    const t = n.title || n.heading || n.name || n.id;
    return t.length > 42 ? t.slice(0, 40) + "…" : t;
  }

  function filterNodes(viewMode, search) {
    const q = (search || "").trim().toLowerCase();
    return P.graph.nodes.filter((n) => {
      if (viewMode === "domain") {
        if (n.type === "section" && !q) return false;
        if (n.type === "table" || n.type === "diagram") return false;
      } else if (viewMode === "structure") {
        if (!STRUCTURE.has(n.type)) return false;
      }
      if (q) {
        const hay = (n.id + " " + (n.title || "") + " " + (n.heading || "") + " " + (n.name || "")).toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }

  function buildVisData(viewMode, search) {
    const nodes = filterNodes(viewMode, search);
    const ids = new Set(nodes.map((n) => n.id));
    const visNodes = nodes.map((n) => ({
      id: n.id,
      label: nodeLabel(n),
      title: "<pre style=\\"margin:0;font-size:11px\\">" + escapeHtml(JSON.stringify(n, null, 2)) + "</pre>",
      color: NODE_COLORS[n.type] || "#94a3b8",
      font: { color: "#e7ecf3", size: 11 },
      shape: n.type === "document" ? "box" : "dot",
      size: STRUCTURE.has(n.type) ? 12 : 18,
    }));
    const visEdges = P.graph.edges
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e, i) => ({
        id: i,
        from: e.from,
        to: e.to,
        label: e.type,
        font: { size: 9, color: "#8b9cb3", strokeWidth: 0 },
        color: { color: "#4b5563", highlight: "#60a5fa" },
        arrows: "to",
      }));
    return { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) };
  }

  function initGraph() {
    const container = document.getElementById("graph-network");
    const viewMode = document.getElementById("filter-view").value;
    const search = document.getElementById("filter-search").value;
    const data = buildVisData(viewMode, search);
    const physics = document.getElementById("filter-physics").checked;
    const options = {
      physics: { enabled: physics, stabilization: { iterations: 120 } },
      interaction: { hover: true, tooltipDelay: 120 },
      layout: { improvedLayout: true },
      edges: { smooth: { type: "dynamic" } },
    };
    if (network) {
      network.setData(data);
      network.setOptions(options);
    } else {
      network = new vis.Network(container, data, options);
      window.__network = network;
      network.on("click", (params) => {
        const detail = document.getElementById("node-detail");
        if (!params.nodes.length) {
          detail.textContent = "Click a node to inspect.";
          return;
        }
        const id = params.nodes[0];
        const node = P.graph.nodes.find((n) => n.id === id);
        const out = P.graph.edges.filter((e) => e.from === id);
        const inc = P.graph.edges.filter((e) => e.to === id);
        detail.textContent =
          JSON.stringify(node, null, 2) +
          "\\n\\n--- outgoing (" + out.length + ") ---\\n" +
          out.map((e) => e.type + " → " + e.to).join("\\n") +
          "\\n\\n--- incoming (" + inc.length + ") ---\\n" +
          inc.map((e) => e.from + " → " + e.type).join("\\n");
      });
    }
  }

  ["filter-view", "filter-search", "filter-physics"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => initGraph());
    document.getElementById(id).addEventListener("input", () => initGraph());
  });
})();
  </script>
</body>
</html>`;
}
