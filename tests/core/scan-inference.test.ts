import { describe, expect, it } from "vitest";
import { isAspectCoverageComplete, isImportClarifyComplete } from "../../src/core/template/import-aspects.js";
import { buildScanInference } from "../../src/core/template/scan-inference.js";
import type { ScanResult } from "../../src/core/template/scan.js";

const srsScan: ScanResult = {
  scannedAt: "2026-06-18T00:00:00.000Z",
  sourceDir: "/tmp/acme-srs-templates",
  files: [
    {
      relativePath: "srs/introduction.md",
      headings: [
        { depth: 1, text: "Introduction", order: 1 },
        { depth: 2, text: "Purpose", order: 2 },
      ],
      placeholders: ["{projectName}"],
    },
    {
      relativePath: "srs/use-cases.md",
      headings: [{ depth: 1, text: "Use Cases", order: 1 }],
      placeholders: [],
    },
    {
      relativePath: "srs/use-case-detail.md",
      headings: [
        { depth: 1, text: "Use Case: {name}", order: 1 },
        { depth: 2, text: "Actors", order: 2 },
      ],
      placeholders: ["{nn}", "{slug}", "{name}"],
    },
  ],
};

describe("buildScanInference", () => {
  it("detects repeating use-case file and vocabulary from scan", () => {
    const result = buildScanInference(srsScan);
    expect(result.repeatingCandidates).toHaveLength(1);
    expect(result.repeatingCandidates[0]?.path).toBe("srs/use-case-detail.md");
    expect(result.repeatingCandidates[0]?.perDomainHint).toBe("useCase");

    const shape = result.aspectCoverage.find((a) => a.aspectId === "doc-shape");
    expect(shape?.status).toBe("inferred");
    expect(shape?.confidence).toBe("high");

    const vocab = result.aspectCoverage.find((a) => a.aspectId === "domain-vocabulary");
    expect(vocab?.proposal).toBe("useCase");

    const graph = result.aspectCoverage.find((a) => a.aspectId === "graph-seeds");
    expect(graph?.proposal).toEqual(["useCase"]);
    expect(graph?.status).toBe("inferred");
  });

  it("resolves graph-seeds when no repeating files", () => {
    const scan: ScanResult = {
      ...srsScan,
      files: [srsScan.files[0]!],
    };
    const result = buildScanInference(scan);
    const graph = result.aspectCoverage.find((a) => a.aspectId === "graph-seeds");
    expect(graph?.status).toBe("resolved");
    const vocab = result.aspectCoverage.find((a) => a.aspectId === "domain-vocabulary");
    expect(vocab?.status).toBe("resolved");
  });

  it("flags ambiguous pack identity from spaced folder name", () => {
    const scan = { ...srsScan, sourceDir: "/tmp/My SRS Templates" };
    const result = buildScanInference(scan);
    const pack = result.aspectCoverage.find((a) => a.aspectId === "pack-identity");
    expect(pack?.proposal).toBe("my-srs-templates");
    expect(pack?.status).toBe("ambiguous");
  });

  it("pairs list and detail files when names match", () => {
    const result = buildScanInference(srsScan);
    const pairs = result.aspectCoverage.find((a) => a.aspectId === "list-detail-pairs");
    expect(pairs?.status).toBe("inferred");
    expect(pairs?.proposal).toEqual({ useCase: "srs/use-cases.md" });
  });

  it("infers detail-design filled example as ambiguous per-feature shape", () => {
    const scan: ScanResult = {
      scannedAt: "2026-06-18T00:00:00.000Z",
      sourceDir: "/tmp/user-templates/detailed-design",
      files: [
        {
          relativePath: "detailed-design.md",
          headings: [
            { depth: 1, text: "車種マスタ詳細設計書", order: 1 },
            { depth: 2, text: "機能別アーキテクチャ検討", order: 2 },
            { depth: 2, text: "モジュール詳細設計", order: 3 },
            { depth: 2, text: "データベース設計", order: 4 },
          ],
          placeholders: ["{id}", "{keyword}", "{operation}", "{resource}"],
        },
      ],
    };
    const result = buildScanInference(scan);
    const purpose = result.aspectCoverage.find((a) => a.aspectId === "doc-purpose");
    expect(purpose?.proposal).toBe("detail-design");
    expect(purpose?.confidence).toBe("high");

    const shape = result.aspectCoverage.find((a) => a.aspectId === "doc-shape");
    expect(shape?.status).toBe("ambiguous");
    expect(shape?.scanSignals).toContain("shape:filled-example-per-feature");

    const vocab = result.aspectCoverage.find((a) => a.aspectId === "domain-vocabulary");
    expect(vocab?.proposal).toBe("feature");

    expect(
      result.supplementalQuestions.some((q) => q.id.startsWith("scan:placeholder:")),
    ).toBe(false);
  });

  it("detects supplemental questions for multi-root templates", () => {
    const scan: ScanResult = {
      ...srsScan,
      files: [
        ...srsScan.files,
        {
          relativePath: "bd/screens.md",
          headings: [{ depth: 1, text: "Screens", order: 1 }],
          placeholders: [],
        },
      ],
    };
    const result = buildScanInference(scan);
    expect(result.supplementalQuestions.some((q) => q.id === "scan:multi-root-folders")).toBe(
      true,
    );
  });
});

describe("isImportClarifyComplete", () => {
  it("is false when supplemental questions remain open", () => {
    const result = buildScanInference(srsScan);
    const confirmed = result.aspectCoverage.map((a) =>
      a.status === "resolved" ? a : { ...a, confirmedAt: new Date().toISOString() },
    );
    expect(
      isImportClarifyComplete({
        aspectCoverage: confirmed,
        supplementalQuestions: result.supplementalQuestions,
      }),
    ).toBe(result.supplementalQuestions.every((q) => q.status === "resolved"));
  });
});

describe("isAspectCoverageComplete", () => {
  it("is false when non-resolved aspects lack confirmation", () => {
    const result = buildScanInference(srsScan);
    expect(isAspectCoverageComplete(result.aspectCoverage)).toBe(false);
  });

  it("is true when all non-resolved aspects are confirmed", () => {
    const result = buildScanInference(srsScan);
    const confirmed = result.aspectCoverage.map((a) =>
      a.status === "resolved" ? a : { ...a, confirmedAt: new Date().toISOString() },
    );
    expect(isAspectCoverageComplete(confirmed)).toBe(true);
  });
});
