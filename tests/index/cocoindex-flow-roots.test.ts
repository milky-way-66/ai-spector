import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const FLOW_PY = resolve(__dirname, "../../scaffold/cocoindex/flow.py");

function pythonAvailable(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Regression: docs/data-source listed in index.docs.json AND appended as the
// hardcoded fallback must not be mounted twice — CocoIndex collides on
// filename keys ("Path /@process_file/\"requirements.md\" already exists").
describe("scaffold flow.py _load_doc_roots", () => {
  it.skipIf(!pythonAvailable())(
    "deduplicates docs/data-source between index.docs.json and the fallback",
    () => {
      const flowSource = readFileSync(FLOW_PY, "utf8");
      const match = flowSource.match(/def _load_doc_roots[\s\S]*?\n(?=\n*@coco\.fn)/);
      expect(match, "could not extract _load_doc_roots from flow.py").toBeTruthy();

      const projectRoot = mkdtempSync(join(tmpdir(), "ai-spector-coco-"));
      try {
        mkdirSync(join(projectRoot, "docs/data-source"), { recursive: true });
        mkdirSync(join(projectRoot, "docs/srs"), { recursive: true });
        writeFileSync(join(projectRoot, "docs/data-source/requirements.md"), "# req\n");
        mkdirSync(join(projectRoot, ".ai-spector/.docflow/config"), { recursive: true });
        writeFileSync(
          join(projectRoot, ".ai-spector/.docflow/config/index.docs.json"),
          JSON.stringify({
            version: 1,
            outputs: { srs: "x", basicDesign: "y" },
            sources: {
              srs: { root: "docs/srs" },
              dataSource: { root: "docs/data-source" },
            },
          }),
        );

        const script = [
          "import json, sys",
          "from pathlib import Path",
          "PROJECT_ROOT = Path(sys.argv[1])",
          'INDEX_CONFIG = PROJECT_ROOT / ".ai-spector/.docflow/config/index.docs.json"',
          match![0],
          "for r in _load_doc_roots():",
          "    print(r.resolve())",
        ].join("\n");

        const out = execFileSync("python3", ["-c", script, projectRoot], {
          encoding: "utf8",
        })
          .trim()
          .split("\n")
          .filter(Boolean);

        expect(new Set(out).size).toBe(out.length);
        const dataSourceRoots = out.filter((p) => p.endsWith("docs/data-source"));
        expect(dataSourceRoots).toHaveLength(1);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    },
  );
});
