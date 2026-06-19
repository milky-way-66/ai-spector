import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { loadDocflowConfig } from "@/core/config/load.js";
import {
  loadFingerprints,
  loadPendingQueue,
  moveJobToResolved,
  queuePaths,
  saveFingerprints,
} from "@/core/lang/queue-store.js";
import { reconcileTranslationQueue } from "@/core/lang/queue.js";
import { runLangQueuePending } from "@/core/operations/lang-queue.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";

const exec = promisify(execFile);

async function setupMultiLangProject(
  root: string,
  langs: Array<{ code: string; label: string }>,
): Promise<void> {
  await writeJson(join(root, ".ai-spector/docflow.config.json"), {
    version: 1,
    languages: langs,
    paths: {
      graph: ".ai-spector/graph/traceability.graph.json",
      registry: ".ai-spector/registry/section-registry.json",
      templates: ".ai-spector/templates",
    },
  });
  await mkdir(join(root, ".ai-spector/.docflow/translation-queue"), { recursive: true });
  await writeJson(join(root, ".ai-spector/graph/traceability.graph.json"), {
    version: 1,
    nodes: [],
    edges: [],
  });
  for (const lang of langs) {
    await mkdir(join(root, `docs/srs/${lang.code}`), { recursive: true });
    await mkdir(join(root, `docs/basic-design/${lang.code}`), { recursive: true });
  }
}

async function writeDoc(
  root: string,
  docType: "srs" | "basic-design",
  lang: string,
  name: string,
  content: string,
): Promise<void> {
  const path = join(root, `docs/${docType}/${lang}/${name}`);
  await mkdir(join(root, `docs/${docType}/${lang}`), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function initGitRepo(root: string): Promise<void> {
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
}

const EN_DOC = `## Overview

English overview text.

## Actors

English actors text.
`;

const JP_DOC = `## Overview

日本語の概要です。

## Actors

日本語のアクターです。
`;

describe("translation queue enrich on pending read", () => {
  it("enriches pending jobs with git diff and persists cache", async () => {
    await withTempProject(async (root) => {
      await initGitRepo(root);
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init docs"], { cwd: root });

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);

      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Updated English overview."),
      );

      await reconcileTranslationQueue(root, config);

      const results = await runLangQueuePending({ root });
      expect(results).toHaveLength(1);
      expect(results[0]!.enrichment).toBeDefined();
      expect(results[0]!.enrichment!.diffSource).toBe("git");
      expect(results[0]!.enrichment!.diff).toContain("Updated English overview.");
      expect(results[0]!.enrichment!.impact.intraDocTargets).toContain(
        "docs/srs/jp/01-overview.md",
      );
      expect(results[0]!.enrichment!.anchorHash).toBe(results[0]!.job.origin.hash);

      const paths = queuePaths(root);
      const pending = await loadPendingQueue(paths);
      expect(pending.jobs[0]!.enrichment).toBeDefined();
      expect(pending.jobs[0]!.enrichment!.diffSource).toBe("git");
    });
  });

  it("returns cached enrichment when anchor hash still matches", async () => {
    await withTempProject(async (root) => {
      await initGitRepo(root);
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init docs"], { cwd: root });

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);
      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Updated English overview."),
      );
      await reconcileTranslationQueue(root, config);

      const first = await runLangQueuePending({ root });
      const computedAt = first[0]!.enrichment!.computedAt;

      const second = await runLangQueuePending({ root });
      expect(second[0]!.enrichment!.computedAt).toBe(computedAt);
    });
  });

  it("skips enrichment when enrich is false", async () => {
    await withTempProject(async (root) => {
      await initGitRepo(root);
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init docs"], { cwd: root });

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);
      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Updated English overview."),
      );
      await reconcileTranslationQueue(root, config);

      const results = await runLangQueuePending({ root, enrich: false });
      expect(results).toHaveLength(1);
      expect(results[0]!.enrichment).toBeUndefined();
      expect(results[0]!.job.enrichment).toBeUndefined();
    });
  });
});

describe("translation queue purge on resolve", () => {
  it("purges legacy fingerprint content and clears enrichment", async () => {
    await withTempProject(async (root) => {
      await initGitRepo(root);
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);
      await exec("git", ["add", "."], { cwd: root });
      await exec("git", ["commit", "-m", "init docs"], { cwd: root });

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);
      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Updated English overview."),
      );
      await reconcileTranslationQueue(root, config);

      const paths = queuePaths(root);
      const pending = await loadPendingQueue(paths);
      const job = pending.jobs[0]!;
      const originPath = job.origin.path;
      const targetPath = job.targets[0]!.path;

      const fingerprints = await loadFingerprints(paths.fingerprints);
      fingerprints.files[originPath] = {
        ...fingerprints.files[originPath]!,
        content: EN_DOC,
      };
      fingerprints.files[targetPath] = {
        hash: fingerprints.files[targetPath]?.hash ?? "legacy",
        scannedAt: new Date().toISOString(),
        version: 1,
        content: JP_DOC,
      };
      await saveFingerprints(paths.fingerprints, fingerprints);

      const enriched = await runLangQueuePending({ root });
      const enrichedJob = enriched[0]!.job;
      enrichedJob.targets[0]!.status = "synced";
      enrichedJob.targets[0]!.hash = enrichedJob.targets[0]!.baselineHash;
      enrichedJob.targets[0]!.syncedAt = new Date().toISOString();

      await moveJobToResolved(paths, enrichedJob);

      const fpAfter = await loadFingerprints(paths.fingerprints);
      expect(fpAfter.files[originPath]?.content).toBeUndefined();
      expect(fpAfter.files[targetPath]?.content).toBeUndefined();

      const pendingAfter = await loadPendingQueue(paths);
      expect(pendingAfter.jobs).toHaveLength(0);
    });
  });
});
