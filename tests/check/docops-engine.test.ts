import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "@/core/operations/check.js";
import { DOCOPS_CONFIG_REL, LEGACY_DOCFLOW_CONFIG_REL } from "@/core/docops/paths.js";
import { ENGINE_CONFIG_REL } from "@/core/engine/paths.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

const FIXTURE = join(process.cwd(), "tests/fixtures/docflow-legacy");

const MIN_DOCOPS = {
  schemaVersion: "1.0",
  languages: [{ code: "en", label: "English" }],
  capabilities: {
    review: true,
    comments: true,
    prototype: true,
    graph: true,
    generate: true,
    translate: false,
  },
  docTypes: {
    srs: {
      enabled: true,
      path: "srs",
      label: "SRS",
      templatesPath: ".docops/templates/srs",
    },
  },
};

describe("runCheck docops + engine rules", () => {
  it("STRUCT-002 errors when docops.config.json is missing", async () => {
    await withTempDir(async (root) => {
      const result = await runCheck({ root });
      const struct002 = result.findings.filter((f) => f.ruleId === "STRUCT-002");
      expect(struct002.some((f) => f.severity === "error")).toBe(true);
      expect(struct002.some((f) => f.path === DOCOPS_CONFIG_REL)).toBe(true);
      expect(result.ok).toBe(false);
    });
  });

  it("warns to migrate when only legacy docflow.config.json exists", async () => {
    await withTempDir(async (root) => {
      await cp(FIXTURE, root, { recursive: true });
      const result = await runCheck({ root });
      const warnings = result.findings.filter(
        (f) => f.ruleId === "STRUCT-002" && f.severity === "warning",
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]?.path).toBe(LEGACY_DOCFLOW_CONFIG_REL);
      expect(warnings[0]?.fix).toBe("npx ai-spector docops migrate --from-docflow");
      expect(
        result.findings.some(
          (f) =>
            f.ruleId === "STRUCT-002" &&
            f.severity === "error" &&
            f.fix === "npx ai-spector docops migrate --from-docflow",
        ),
      ).toBe(true);
    });
  });

  it("ENGINE-001 errors when engine.json is unparseable", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".docops"), { recursive: true });
      await writeFile(join(root, DOCOPS_CONFIG_REL), JSON.stringify(MIN_DOCOPS), "utf8");
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(join(root, ENGINE_CONFIG_REL), "{ not json", "utf8");
      const result = await runCheck({ root });
      const engine001 = result.findings.find((f) => f.ruleId === "ENGINE-001");
      expect(engine001?.severity).toBe("error");
      expect(engine001?.path).toBe(ENGINE_CONFIG_REL);
      expect(result.ok).toBe(false);
    });
  });

  it("skips GRAPH-001 when capabilities.graph is false", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".docops"), { recursive: true });
      await writeFile(
        join(root, DOCOPS_CONFIG_REL),
        JSON.stringify({
          ...MIN_DOCOPS,
          capabilities: { ...MIN_DOCOPS.capabilities, graph: false },
        }),
        "utf8",
      );
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeJson(join(root, ENGINE_CONFIG_REL), {
        schemaVersion: 1,
        artifacts: { graph: ".ai-spector/graph/bad.json" },
        readiness: { profile: "general" },
      });
      await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
      await writeFile(join(root, ".ai-spector/graph/bad.json"), "{ bad", "utf8");
      const result = await runCheck({ root });
      expect(result.findings.some((f) => f.ruleId === "GRAPH-001")).toBe(false);
    });
  });

  it("TMPL-001 checks templatesPath per enabled docTypes", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".docops"), { recursive: true });
      await writeFile(join(root, DOCOPS_CONFIG_REL), JSON.stringify(MIN_DOCOPS), "utf8");
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeJson(join(root, ENGINE_CONFIG_REL), {
        schemaVersion: 1,
        artifacts: { graph: ".ai-spector/graph/traceability.graph.json" },
        readiness: { profile: "general" },
      });
      const result = await runCheck({ root });
      const tmpl = result.findings.find((f) => f.ruleId === "TMPL-001");
      expect(tmpl?.severity).toBe("warning");
      expect(tmpl?.path).toBe(".docops/templates/srs");
    });
  });

  it("READY-001 reads readiness from engine.json", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".docops"), { recursive: true });
      await writeFile(join(root, DOCOPS_CONFIG_REL), JSON.stringify(MIN_DOCOPS), "utf8");
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeJson(join(root, ENGINE_CONFIG_REL), {
        schemaVersion: 1,
        artifacts: { graph: ".ai-spector/graph/traceability.graph.json" },
        readiness: {},
      });
      const result = await runCheck({ root });
      const ready = result.findings.find((f) => f.ruleId === "READY-001");
      expect(ready?.severity).toBe("warning");
      expect(ready?.path).toBe(ENGINE_CONFIG_REL);
      expect(ready?.message).toContain("engine.json");
    });
  });

  it("CFG-001 reads languages from docops.config.json only", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".docops"), { recursive: true });
      await writeFile(
        join(root, DOCOPS_CONFIG_REL),
        JSON.stringify({ ...MIN_DOCOPS, languages: [] }),
        "utf8",
      );
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(
        join(root, LEGACY_DOCFLOW_CONFIG_REL),
        JSON.stringify({
          version: 1,
          languages: [{ code: "en", label: "English" }],
          paths: {},
        }),
        "utf8",
      );
      const result = await runCheck({ root });
      const cfg = result.findings.find((f) => f.ruleId === "CFG-001");
      expect(cfg?.severity).toBe("error");
      expect(cfg?.path).toBe(DOCOPS_CONFIG_REL);
    });
  });
});
