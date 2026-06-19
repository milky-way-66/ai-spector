import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { writeJson } from "@/core/util/fs.js";
import { bundledRulesImpactPath } from "@/core/config/load.js";
import {
  enrichReviewJob,
  enrichTranslationJob,
  loadLegacyFingerprintContent,
  resolveDiffFromAnchor,
} from "@/core/sync/enrich.js";
import { saveFingerprints, queuePaths } from "@/core/lang/queue-store.js";
import { writeSnapshot } from "@/core/reviews/storage.js";
import { makeApproval } from "@/core/reviews/storage.js";
import type { DocAnchor } from "@/core/sync/drift-types.js";
import type { TranslationJob } from "@/core/lang/queue-types.js";

const exec = promisify(execFile);

async function initGitRepo(root: string): Promise<void> {
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
}

describe("resolveDiffFromAnchor legacy fallbacks", () => {
  it("uses legacy_content from fingerprint via enrichTranslationJob", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-fp-"));
    const path = "docs/srs/en/01-overview.md";
    await mkdir(join(root, "docs/srs/en"), { recursive: true });
    await writeFile(join(root, path), "# v2\n", "utf8");

    await mkdir(join(root, ".ai-spector/.docflow/translation-queue"), { recursive: true });
    await writeJson(join(root, ".ai-spector/graph/traceability.graph.json"), {
      version: 1,
      nodes: [],
      edges: [],
    });
    const paths = queuePaths(root);
    await saveFingerprints(paths.fingerprints, {
      version: 1,
      files: {
        [path]: {
          hash: "oldhash",
          version: 1,
          scannedAt: new Date().toISOString(),
          content: "# v1\n",
        },
      },
    });

    const job: TranslationJob = {
      id: "job-1",
      docType: "srs",
      relativePath: "01-overview.md",
      direction: "outbound",
      origin: { lang: "en", path, hash: "newhash", changedAt: new Date().toISOString() },
      targets: [{ lang: "jp", path: "docs/srs/jp/01-overview.md", status: "pending" }],
      changes: [
        {
          lang: "en",
          path,
          hash: "newhash",
          previousHash: "oldhash",
          previousVersion: 1,
          version: 2,
          changedAt: new Date().toISOString(),
          mtimeMs: Date.now(),
          sequence: 1,
          anchor: { path, hash: "oldhash", gitRef: null, anchoredAt: "" },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const enrichment = await enrichTranslationJob(root, job, {
      graphPath: join(root, ".ai-spector/graph/traceability.graph.json"),
      rulesPath: bundledRulesImpactPath(),
    });

    expect(enrichment.diffSource).toBe("legacy_content");
    expect(enrichment.diff).toContain("v2");
    expect(enrichment.linesAdded + enrichment.linesRemoved).toBeGreaterThan(0);
  });

  it("uses legacy_snapshot from review snapshot via enrichReviewJob", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-snap-"));
    const docRel = "docs/srs/01-overview.md";
    const lp = "srs/01-overview";
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await mkdir(join(root, ".ai-spector/.docflow/review-queue/snapshots"), { recursive: true });
    await writeJson(join(root, ".ai-spector/graph/traceability.graph.json"), {
      version: 1,
      nodes: [],
      edges: [],
    });
    await writeFile(join(root, docRel), "# Changed\n", "utf8");

    const snapshotContent = "# Approved\n";
    await writeSnapshot(root, lp, snapshotContent);

    const approval = makeApproval(lp, "approvedhash", docRel);
    approval.snapshotRef = `${lp}.md`;

    const enrichment = await enrichReviewJob(root, lp, {
      approval,
      graphPath: join(root, ".ai-spector/graph/traceability.graph.json"),
      rulesPath: bundledRulesImpactPath(),
    });

    expect(enrichment.diffSource).toBe("legacy_snapshot");
    expect(enrichment.diff).toContain("Changed");
    expect(enrichment.linesAdded + enrichment.linesRemoved).toBeGreaterThan(0);
  });

  it("uses inline changes[].diff when no anchor gitRef and no fingerprint", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-inline-"));
    const path = "docs/srs/en/01-overview.md";
    await mkdir(join(root, "docs/srs/en"), { recursive: true });
    await writeFile(join(root, path), "# current\n", "utf8");

    const inlineDiff = "{1} -\n-old line\n{2} +\n+new line\n";
    const anchor: DocAnchor = { path, hash: "x", gitRef: null, anchoredAt: "" };
    const result = await resolveDiffFromAnchor(root, anchor, { inlineDiff });

    expect(result.diffSource).toBe("legacy_content");
    expect(result.diff).toBe(inlineDiff);
    expect(result.linesAdded).toBe(1);
    expect(result.linesRemoved).toBe(1);
  });

  it("backfills gitRef via git log when anchor has gitRef null", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-backfill-"));
    await initGitRepo(root);
    const path = "docs/srs/a.md";
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await writeFile(join(root, path), "# v1\n", "utf8");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "init"], { cwd: root });
    await writeFile(join(root, path), "# v2\n", "utf8");

    const anchor: DocAnchor = { path, hash: "oldhash", gitRef: null, anchoredAt: "" };
    const result = await resolveDiffFromAnchor(root, anchor);

    expect(result.diffSource).toBe("git");
    expect(result.diff).toContain("v2");
  });

  it("falls back to legacy content when git diff is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-empty-git-"));
    await initGitRepo(root);
    const path = "docs/srs/a.md";
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await writeFile(join(root, path), "# same\n", "utf8");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "init"], { cwd: root });
    const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
    const gitRef = stdout.trim();

    const anchor: DocAnchor = { path, hash: "x", gitRef, anchoredAt: "" };
    const result = await resolveDiffFromAnchor(root, anchor, { legacyContent: "# old\n" });

    expect(result.diffSource).toBe("legacy_content");
    expect(result.linesAdded + result.linesRemoved).toBeGreaterThan(0);
  });
});

describe("loadLegacyFingerprintContent", () => {
  it("returns legacyContent when fingerprint stores content", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-load-fp-"));
    const path = "docs/srs/en/doc.md";
    await mkdir(join(root, ".ai-spector/.docflow/translation-queue"), { recursive: true });
    const paths = queuePaths(root);
    await saveFingerprints(paths.fingerprints, {
      version: 1,
      files: {
        [path]: {
          hash: "h1",
          version: 1,
          scannedAt: new Date().toISOString(),
          content: "# stored\n",
        },
      },
    });

    const legacy = await loadLegacyFingerprintContent(root, path);
    expect(legacy?.legacyContent).toBe("# stored\n");
  });
});
