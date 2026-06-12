import { describe, expect, it } from "vitest";
import type { PackManifest } from "../../src/core/config/types.js";
import {
  buildPackCompletenessRules,
  buildPackReadinessCriteria,
  buildWorkflowSetupMarkdown,
} from "../../src/core/template/pack-readiness.js";
import type { ScanResult } from "../../src/core/template/scan.js";

const manifest: PackManifest = {
  version: 1,
  name: "test-pack",
  packName: "kaopiz-srs",
  description: "Custom SRS following IEEE 29148",
  purpose: "SRS",
  templatesDir: "templates",
  nodePrefix: "doc.kaopiz.srs",
  documents: [
    {
      documentId: "doc.kaopiz.srs.introduction",
      template: "introduction.md",
      output: "docs/requirements/introduction.md",
    },
    {
      documentId: "doc.kaopiz.srs.use.case.detail",
      template: "use-case-detail.md",
      outputPattern: "docs/requirements/uc-{nn}-{slug}.md",
      perDomain: "useCase",
    },
  ],
};

const scanResult: ScanResult = {
  scannedAt: "2026-06-12T00:00:00.000Z",
  sourceDir: "/tmp/templates",
  files: [
    {
      relativePath: "introduction.md",
      headings: [
        { depth: 2, text: "Purpose", order: 1 },
        { depth: 2, text: "Scope", order: 2 },
      ],
      placeholders: ["{projectName}"],
    },
    {
      relativePath: "use-case-detail.md",
      headings: [
        { depth: 2, text: "Actors", order: 1 },
        { depth: 2, text: "Main Flow", order: 2 },
      ],
      placeholders: ["{name}", "{nn}", "{slug}", "{customField}"],
    },
  ],
};

describe("buildPackReadinessCriteria", () => {
  it("generates global criteria and per-document targets", () => {
    const result = buildPackReadinessCriteria(manifest, scanResult) as {
      packName: string;
      globalCriteria: unknown[];
      targets: { dagNode: string; criteria: unknown[] }[];
    };
    expect(result.packName).toBe("kaopiz-srs");
    expect(result.globalCriteria.length).toBeGreaterThanOrEqual(8);
    expect(result.targets).toHaveLength(2);
    expect(result.targets[0]!.dagNode).toBe("kaopiz-srs.srs-introduction");
    expect(result.targets[1]!.dagNode).toContain("breakout");
    expect(result.targets[1]!.criteria.length).toBeGreaterThan(2);
  });

  it("includes placeholder criteria for unresolved tokens", () => {
    const result = buildPackReadinessCriteria(manifest, scanResult) as {
      targets: { criteria: { placeholder?: string; severity: string }[] }[];
    };
    const breakout = result.targets[1]!;
    const custom = breakout.criteria.find((c) => c.placeholder === "{customField}");
    expect(custom).toBeDefined();
    expect(custom!.severity).toBe("blocking");
  });
});

describe("buildPackCompletenessRules", () => {
  it("derives required headings from scan", () => {
    const rules = buildPackCompletenessRules(manifest, scanResult) as {
      rules: { requiredHeadings: string[] }[];
    };
    expect(rules.rules.length).toBe(1);
    expect(rules.rules[0]!.requiredHeadings).toContain("## Purpose");
  });
});

describe("buildWorkflowSetupMarkdown", () => {
  it("mentions gated workflow and readiness file", () => {
    const md = buildWorkflowSetupMarkdown(manifest);
    expect(md).toContain("readiness-criteria.json");
    expect(md).toContain("CLARIFY");
    expect(md).toContain("task_list");
  });
});
