# Browser integration guide

How to integrate `ai-spector/graph` into a Vue, React, or Next.js frontend that receives traceability data from a backend API.

---

## Architecture

```
Git repo
  └── .ai-spector/
        ├── graph/traceability.graph.json
        ├── registry/section-registry.json
        └── .docflow/
              ├── knowledge.json
              └── state.json

        ↓  your backend reads & serves

Backend API  (FastAPI / Express / Next API route / …)
  └── GET /api/bundle  →  ProjectBundle JSON

        ↓  frontend fetches

Browser app  (Vue 3 + Vite / React / Next.js)
  └── createProjectSession(bundle)
        ├── session.query(seedId)
        ├── session.impactFromNode(id)
        ├── session.knowledgeCoverage()
        └── session.healthSummary()
```

No filesystem access happens in the browser. The backend fetches the JSON files; the frontend runs pure algorithms on the resulting bundle.

---

## Install

```bash
npm install ai-spector
```

`ai-spector/graph` is a subpath of the same package — one install, two entry points.

---

## Vite / webpack config

After the P0 browser-safety fix (`ai-spector` ≥ 0.8.20), `ai-spector/graph` contains **zero Node built-ins**. No custom plugin, no `optimizeDeps.exclude`, no shims needed:

```ts
// vite.config.ts — no ai-spector config required
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
});
```

If you are on an older version, upgrade first:

```bash
npm install ai-spector@latest
```

---

## Backend contract

Your backend serves a single JSON endpoint whose shape is the `ProjectBundle` type.

```ts
// Shared type — import anywhere, including the backend
import type { ProjectBundle } from "ai-spector/types";
```

**Minimal bundle (graph only):**

```json
{
  "graph": { /* traceability.graph.json contents */ }
}
```

**Full bundle:**

```json
{
  "graph":     { /* .ai-spector/graph/traceability.graph.json */ },
  "registry":  { /* .ai-spector/registry/section-registry.json — enables sectionLabel() */ },
  "knowledge": { /* .ai-spector/.docflow/knowledge.json — enables knowledgeCoverage() */ },
  "state":     { /* .ai-spector/.docflow/state.json — enables lastIndexRunAt() etc. */ },
  "impactRules": { /* schemas/rules.impact.json — omit to use built-in defaults */ }
}
```

**Example FastAPI handler:**

```python
import json
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()
ROOT = Path("/path/to/project")

def read_json(path: Path):
    return json.loads(path.read_text()) if path.exists() else None

@app.get("/api/bundle")
def get_bundle():
    return JSONResponse({
        "graph":     read_json(ROOT / ".ai-spector/graph/traceability.graph.json"),
        "registry":  read_json(ROOT / ".ai-spector/registry/section-registry.json"),
        "knowledge": read_json(ROOT / ".ai-spector/.docflow/knowledge.json"),
        "state":     read_json(ROOT / ".ai-spector/.docflow/state.json"),
    })
```

---

## Frontend quick start (15 lines)

```ts
import { createProjectSession } from "ai-spector/graph";
import type { ProjectBundle } from "ai-spector/types";

// 1. Fetch the bundle from your backend
const bundle: ProjectBundle = await fetch("/api/bundle").then((r) => r.json());

// 2. Create an in-memory session
const project = createProjectSession(bundle);

// 3. Query
const subgraph = project.query("UC-01", { direction: "both", depth: 2 });

// 4. Impact
const impact = project.impactFromNode("UC-01", { change: "requirement updated" });

// 5. Coverage / health
const coverage = project.knowledgeCoverage();
const health   = project.healthSummary();
```

---

## Vue 3 + Vite example

### Composable

```ts
// composables/useProject.ts
import { ref, shallowRef } from "vue";
import { createProjectSession } from "ai-spector/graph";
import type { ProjectSession } from "ai-spector/graph";
import type { ProjectBundle } from "ai-spector/types";

export function useProject() {
  const session  = shallowRef<ProjectSession | null>(null);
  const loading  = ref(false);
  const error    = ref<string | null>(null);

  async function load(url = "/api/bundle") {
    loading.value = true;
    error.value   = null;
    try {
      const bundle: ProjectBundle = await fetch(url).then((r) => r.json());
      session.value = createProjectSession(bundle);
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
  }

  return { session, loading, error, load };
}
```

### Impact modal

```vue
<!-- components/ImpactModal.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { ProjectSession } from "ai-spector/graph";

const props = defineProps<{ session: ProjectSession; nodeId: string }>();

const impact = computed(() =>
  props.session.impactFromNode(props.nodeId, { change: "edited" })
);
</script>

<template>
  <div class="impact-modal">
    <section>
      <h3>Regenerate ({{ impact.regenerate.length }})</h3>
      <ul>
        <li v-for="e in impact.regenerate" :key="e.id">
          {{ e.id }} — {{ e.projectionPath }}
        </li>
      </ul>
    </section>
    <section>
      <h3>Review ({{ impact.review.length }})</h3>
      <ul>
        <li v-for="e in impact.review" :key="e.id">{{ e.id }}</li>
      </ul>
    </section>
  </div>
</template>
```

---

## Graph visualization

Use `nodesForVisualization` + `expandPathTargetNodes` to prepare data for any canvas library (Vue Flow, React Flow, D3, Cytoscape, etc.).

```ts
import {
  createProjectSession,
  nodesForVisualization,
  expandPathTargetNodes,
} from "ai-spector/graph";

const project = createProjectSession(bundle);

// 1. Get a subgraph rooted at your seed
const subgraph = project.query("UC-01", { direction: "both", depth: 3 });

// 2. Expand path/file synthetic nodes
const expanded = expandPathTargetNodes(subgraph, { includeFiles: true });

// 3. Get a flat node list ready for a renderer
const vizNodes = nodesForVisualization(expanded);

// vizNodes: Array<{ id, type, label, projectionPath?, synthetic? }>
// Map to your canvas library's node format from here.
```

---

## Editor / file-path integration

Map a file path (or heading anchor) to its impact origin:

```ts
import { resolveImpactOrigins, pickPrimaryImpactOrigin } from "ai-spector/graph";

// The user's editor has a file open — find the corresponding graph node
const origins = resolveImpactOrigins(project.graph.g, {
  file: "docs/use-cases/UC-01.md",
  heading: "Scope",
});

const primary = pickPrimaryImpactOrigin(origins);
if (primary) {
  const impact = project.impactFromNode(primary.id, { change: "heading edited" });
}
```

---

## Impact from pre-computed git diff (no git in browser)

Run `git diff` server-side, pass the changed file list to the frontend, and call `impactFromChangedFiles` on the session:

```ts
// Backend: compute changed files (Node / Python / shell)
// GET /api/git-diff → string[]   e.g. ["docs/req/REQ-01.md", "docs/uc/UC-02.md"]

// Frontend:
const changedFiles: string[] = await fetch("/api/git-diff").then((r) => r.json());

const impacts = changedFiles.flatMap((filePath) => {
  const origins = resolveImpactOrigins(project.graph.g, { file: filePath });
  return origins.map((o) =>
    project.impactFromNode(o.id, { change: "git change" })
  );
});

import { mergeImpactResults } from "ai-spector/graph";
const merged = mergeImpactResults(impacts);
```

---

## Testing

Use `createProjectSession` with a fixture JSON in Vitest — no filesystem mocking needed:

```ts
// tests/impact.spec.ts
import { describe, it, expect } from "vitest";
import { createProjectSession } from "ai-spector/graph";
import fixtureGraph from "./fixtures/traceability.graph.json";

describe("impact", () => {
  it("UC-01 change regenerates related documents", () => {
    const project = createProjectSession({ graph: fixtureGraph });
    const impact  = project.impactFromNode("UC-01", { change: "test" });
    expect(impact.regenerate.some((e) => e.type === "document")).toBe(true);
  });
});
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Module "node:fs" has been externalized` | Importing `ai-spector` (Node entry) in a browser bundle | Switch to `import … from "ai-spector/graph"` |
| `Cannot find module 'ai-spector/types'` | Old TypeScript / wrong moduleResolution | Set `"moduleResolution": "bundler"` or `"node16"` in tsconfig |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Deep import like `ai-spector/dist/…` | Use the public subpaths only: `.`, `/graph`, `/types` |
| Empty subgraph (`nodes: []`) | `seedId` not found in graph | Check the id against `project.graph.g.nodesById` |
| `sectionLabel()` returns raw id | `registry` not included in bundle | Add `registry` to your bundle endpoint |

---

## Related docs

| Doc | Audience |
|-----|----------|
| [SDK reference](sdk.md) | Full API — Node operations + browser sessions |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Contributor architecture reference |
