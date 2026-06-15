import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadCustomChecklistItems,
  matchPathPattern,
} from "@/core/readiness/custom-checklists.js";
import { buildReadinessOutputChecklist } from "@/core/readiness/output-checklist.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";

describe("matchPathPattern", () => {
  it("matches globs", () => {
    expect(matchPathPattern("srs/01-*", "srs/01-overview")).toBe(true);
    expect(matchPathPattern("srs/01-*", "srs/02-scope")).toBe(false);
    expect(matchPathPattern("**/features/**", "docs/srs/en/features/F-01.md")).toBe(true);
  });
});

describe("loadCustomChecklistItems", () => {
  it("loads _all folder items for every document", async () => {
    await withTempProject(async (root) => {
      const dir = join(root, ".ai-spector/.docflow/config/review-checklists/srs/_all");
      await mkdir(dir, { recursive: true });
      await writeJson(join(dir, "team-gates.json"), {
        version: 1,
        title: "Team gates",
        items: [{ id: "TEAM-001", severity: "blocking", question: "Owner named?" }],
      });

      const result = await loadCustomChecklistItems(root, {
        docType: "srs",
        docPath: "docs/srs/01-overview.md",
        logicalPath: "srs/01-overview",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.criterionId).toBe("TEAM-001");
      expect(result.items[0]?.source).toBe("custom");
    });
  });

  it("loads doc-specific file by filename stem only for matching doc", async () => {
    await withTempProject(async (root) => {
      const dir = join(root, ".ai-spector/.docflow/config/review-checklists/srs");
      await mkdir(dir, { recursive: true });
      await writeJson(join(dir, "01-overview.json"), {
        items: [{ id: "OV-001", severity: "blocking", question: "Scope clear?" }],
      });

      const match = await loadCustomChecklistItems(root, {
        docType: "srs",
        docPath: "docs/srs/01-overview.md",
        logicalPath: "srs/01-overview",
      });
      expect(match.items.some((i) => i.criterionId === "OV-001")).toBe(true);

      const other = await loadCustomChecklistItems(root, {
        docType: "srs",
        docPath: "docs/srs/02-scope.md",
        logicalPath: "srs/02-scope",
      });
      expect(other.items.some((i) => i.criterionId === "OV-001")).toBe(false);
    });
  });

  it("respects match patterns on root-level files", async () => {
    await withTempProject(async (root) => {
      const dir = join(root, ".ai-spector/.docflow/config/review-checklists");
      await mkdir(dir, { recursive: true });
      await writeJson(join(dir, "features-only.json"), {
        match: { docPaths: ["**/features/**"] },
        items: [{ id: "FEAT-001", severity: "should-ask", question: "Acceptance criteria?" }],
      });

      const hit = await loadCustomChecklistItems(root, {
        docType: "srs",
        docPath: "docs/srs/en/features/F-01.md",
        logicalPath: "srs/features/F-01",
      });
      expect(hit.items.some((i) => i.criterionId === "FEAT-001")).toBe(true);

      const miss = await loadCustomChecklistItems(root, {
        docType: "srs",
        docPath: "docs/srs/01-overview.md",
        logicalPath: "srs/01-overview",
      });
      expect(miss.items.some((i) => i.criterionId === "FEAT-001")).toBe(false);
    });
  });
});

describe("buildReadinessOutputChecklist custom merge", () => {
  it("merges custom items into checklist result", async () => {
    await withTempProject(async (root) => {
      const dir = join(root, ".ai-spector/.docflow/config/review-checklists/srs/_all");
      await mkdir(dir, { recursive: true });
      await writeJson(join(dir, "extra.json"), {
        items: [{ id: "CUST-1", severity: "blocking", question: "Custom check?" }],
      });

      const bundle = new URL("../../scaffold", import.meta.url).pathname;
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [{ code: "en", label: "English" }],
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
        },
        packs: { srs: "builtin", basicDesign: "builtin" },
      });

      await mkdir(join(root, ".ai-spector/.docflow/config/doc-types/srs"), { recursive: true });
      const { copyFile } = await import("node:fs/promises");
      const src = join(bundle, ".ai-spector/.docflow/config/doc-types/srs");
      for (const f of ["readiness-criteria.json", "dag.json", "completeness-rules.json"]) {
        await copyFile(join(src, f), join(root, ".ai-spector/.docflow/config/doc-types/srs", f));
      }
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await writeFile(join(root, "docs/srs/en/1-introduction.md"), "# Intro\n", "utf8");

      const result = await buildReadinessOutputChecklist({
        root,
        docType: "srs",
        paths: ["docs/srs/en/1-introduction.md"],
        logicalPath: "srs/1-introduction",
      });

      const items = result.checklists[0]?.items ?? [];
      expect(items.some((i) => i.source === "custom" && i.criterionId === "CUST-1")).toBe(true);
      expect(result.customChecklistFiles?.length).toBeGreaterThan(0);
    });
  });
});
