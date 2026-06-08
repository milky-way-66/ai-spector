import { describe, expect, it } from "vitest";
import {
  computeTranslationQueueStats,
  jobsForProjectionPath,
  linkStaleTranslationsToQueue,
  parsePendingQueue,
  parseTranslationQueueBundle,
  type TranslationJob,
} from "../../src/core/graph/translation-queue.js";

const sampleJob: TranslationJob = {
  id: "job-1",
  docType: "srs",
  relativePath: "01-overview.md",
  direction: "outbound",
  origin: {
    lang: "en",
    path: "docs/srs/en/01-overview.md",
    hash: "abc",
    changedAt: "2026-01-01T00:00:00Z",
  },
  targets: [
    { lang: "jp", path: "docs/srs/jp/01-overview.md", status: "pending" },
    { lang: "vi", path: "docs/srs/vi/01-overview.md", status: "synced" },
  ],
  changes: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("translation-queue", () => {
  it("parsePendingQueue reads jobs array", () => {
    const q = parsePendingQueue({ version: 1, jobs: [sampleJob] });
    expect(q.jobs).toHaveLength(1);
  });

  it("computeTranslationQueueStats counts pending targets by lang", () => {
    const data = parseTranslationQueueBundle({
      pending: { version: 1, jobs: [sampleJob] },
      failed: [{ ...sampleJob, failedAt: "t", reason: "conflict", message: "x" }],
    });
    const stats = computeTranslationQueueStats(data);
    expect(stats.pending).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.pendingTargetsByLang.jp).toBe(1);
    expect(stats.pendingTargetsByLang.vi).toBeUndefined();
  });

  it("jobsForProjectionPath matches doc type and relative path", () => {
    const jobs = jobsForProjectionPath(
      [sampleJob],
      "docs/srs/en/01-overview.md",
    );
    expect(jobs).toHaveLength(1);
    expect(jobsForProjectionPath([sampleJob], "docs/basic-design/en/x.md")).toHaveLength(0);
  });

  it("linkStaleTranslationsToQueue connects impact entries to jobs", () => {
    const links = linkStaleTranslationsToQueue(
      {
        staleTranslations: [
          {
            id: "doc.srs.jp.01",
            type: "document",
            reason: "translationOf doc.srs.en.01",
            projectionPath: "docs/srs/jp/01-overview.md",
          },
        ],
      },
      [sampleJob],
    );
    expect(links).toHaveLength(1);
    expect(links[0].jobs).toHaveLength(1);
  });
});
