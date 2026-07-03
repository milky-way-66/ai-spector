import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { syncDocopsLanguages } from "../helpers/docops-scaffold.js";
import { loadDocflowConfig, primaryLanguage } from "@/core/config/load.js";
import {
  loadChangeHistory,
  loadFailedQueue,
  loadFileChangesDocument,
  loadFingerprints,
  loadPendingQueue,
  loadResolvedQueue,
  queuePaths,
} from "@/core/lang/queue-store.js";
import { pathExists, readJson, writeJson } from "@/core/util/fs.js";
import { reconcileTranslationQueue } from "@/core/lang/queue.js";

async function setupMultiLangProject(
  root: string,
  langs: Array<{ code: string; label: string }>,
): Promise<void> {
  await syncDocopsLanguages(root, langs);
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

describe("translation queue (file-level)", () => {
  it("is no-op for single-language projects", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [{ code: "en", label: "English" }]);
      const { config } = await loadDocflowConfig(root);
      const result = await reconcileTranslationQueue(root, config);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("single language");
    });
  });

  it("establishes baseline on first scan without enqueueing", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);

      const { config } = await loadDocflowConfig(root);
      const first = await reconcileTranslationQueue(root, config);
      const paths = queuePaths(root);
      const pending = await loadPendingQueue(paths);
      expect(first.enqueued).toBe(0);
      expect(pending.jobs).toHaveLength(0);
    });
  });

  it("enqueues outbound job when primary file changes", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);

      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Updated English overview."),
      );

      const second = await reconcileTranslationQueue(root, config);
      const paths = queuePaths(root);
      const pending = await loadPendingQueue(paths);

      expect(second.enqueued).toBe(1);
      expect(pending.jobs).toHaveLength(1);
      expect(pending.jobs[0]!.direction).toBe("outbound");
      expect(pending.jobs[0]!.origin.lang).toBe("en");
      expect(pending.jobs[0]!.targets.some((t) => t.lang === "jp")).toBe(true);
    });
  });

  it("enqueues inbound job when secondary file changes", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);

      await writeDoc(
        root,
        "srs",
        "jp",
        "01-overview.md",
        JP_DOC.replace("日本語の概要です。", "更新された日本語の概要。"),
      );

      await reconcileTranslationQueue(root, config);
      const paths = queuePaths(root);
      const pending = await loadPendingQueue(paths);

      expect(pending.jobs.some((j) => j.direction === "inbound" && j.origin.lang === "jp")).toBe(
        true,
      );
    });
  });

  it("merges multi-lang changes on same file into one job (latest wins)", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);

      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Updated EN overview."),
      );
      await writeDoc(
        root,
        "srs",
        "jp",
        "01-overview.md",
        JP_DOC.replace("日本語の概要です。", "更新された JP 概要。"),
      );

      await reconcileTranslationQueue(root, config);
      const paths = queuePaths(root);
      const pending = await loadPendingQueue(paths);
      const failed = await loadFailedQueue(paths.failed);

      expect(pending.jobs).toHaveLength(1);
      expect(failed.jobs).toHaveLength(0);
      expect(pending.jobs[0]!.origin.mergedLangs).toEqual(
        expect.arrayContaining(["en", "jp"]),
      );
      expect(pending.jobs[0]!.changes).toHaveLength(2);
      expect(pending.jobs[0]!.changes.map((c) => c.lang).sort()).toEqual(["en", "jp"]);
      for (const change of pending.jobs[0]!.changes) {
        expect(change.version).toBe(change.previousVersion + 1);
        expect(change.previousHash).not.toBe(change.hash);
        expect(change.anchor).toBeDefined();
        expect(change.anchor!.hash).toBeTruthy();
        expect(change.sequence).toBeGreaterThan(0);
        expect(change.mtimeMs).toBeGreaterThan(0);
      }
      expect(pending.jobs[0]!.changes.map((c) => c.sequence).sort()).toEqual([1, 2]);

      const history = await loadChangeHistory(paths.changeHistory);
      expect(history.entries.length).toBeGreaterThanOrEqual(2);

      const fileDoc = await loadFileChangesDocument(paths, "srs", "01-overview.md");
      expect(fileDoc?.changes).toHaveLength(2);
      const rawPending = await readJson<{ jobs: Array<{ changes?: unknown }> }>(paths.pending);
      expect(rawPending.jobs[0]?.changes).toBeUndefined();
    });
  });

  it("stores per-document changes under changes/", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);

      const { config } = await loadDocflowConfig(root);
      const paths = queuePaths(root);
      await reconcileTranslationQueue(root, config);
      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Updated English overview."),
      );
      await reconcileTranslationQueue(root, config);

      const fileDoc = await loadFileChangesDocument(paths, "srs", "01-overview.md");
      expect(fileDoc).not.toBeNull();
      expect(fileDoc!.jobId).toBeTruthy();
      expect(fileDoc!.changes).toHaveLength(1);
      expect(fileDoc!.changes[0]!.anchor).toBeDefined();
      expect(fileDoc!.changes[0]!.anchor!.hash).toBeTruthy();
      expect(fileDoc!.changes[0]!.diff).toBeUndefined();
    });
  });

  it("increments file version on each change", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);

      const { config } = await loadDocflowConfig(root);
      const queueDir = queuePaths(root);
      const fingerprintPath = queueDir.fingerprints;

      await reconcileTranslationQueue(root, config);
      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Edit 1."),
      );
      await reconcileTranslationQueue(root, config);

      let fp = await loadFingerprints(fingerprintPath);
      const v1 = fp.files["docs/srs/en/01-overview.md"]!.version;
      expect(v1).toBe(2);

      await writeDoc(
        root,
        "srs",
        "en",
        "01-overview.md",
        EN_DOC.replace("English overview text.", "Edit 2."),
      );
      await reconcileTranslationQueue(root, config);

      fp = await loadFingerprints(fingerprintPath);
      expect(fp.files["docs/srs/en/01-overview.md"]!.version).toBe(3);
    });
  });

  it("resolves job when target file is updated", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      await writeDoc(root, "srs", "en", "01-overview.md", EN_DOC);
      await writeDoc(root, "srs", "jp", "01-overview.md", JP_DOC);

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

      const primary = primaryLanguage(config);
      const paths = queuePaths(root);
      const pendingBefore = await loadPendingQueue(paths);
      const outbound = pendingBefore.jobs.find(
        (j) => j.direction === "outbound" && j.origin.lang === primary.code,
      );
      expect(outbound).toBeDefined();

      await writeDoc(root, "srs", "jp", "01-overview.md", EN_DOC.replace("Updated English overview.", "同期された全文。"));
      const result = await reconcileTranslationQueue(root, config);

      const resolved = await loadResolvedQueue(paths.resolved);
      const pendingAfter = await loadPendingQueue(paths);

      expect(result.resolved).toBe(1);
      expect(resolved.jobs).toHaveLength(1);
      expect(pendingAfter.jobs).toHaveLength(0);

      const dateDirs = await readdir(paths.resolved);
      expect(dateDirs.length).toBeGreaterThan(0);
      const dayDir = join(paths.resolved, dateDirs[0]!);
      const archiveFiles = (await readdir(dayDir)).filter((f) => f.endsWith(".json"));
      expect(archiveFiles).toHaveLength(1);
    });
  });

  it("migrates legacy monolithic queue files into date folders", async () => {
    await withTempProject(async (root) => {
      await setupMultiLangProject(root, [
        { code: "en", label: "English" },
        { code: "jp", label: "Japanese" },
      ]);
      const paths = queuePaths(root);
      const legacyJob = {
        id: "legacy-job-id",
        docType: "srs" as const,
        relativePath: "01-overview.md",
        direction: "outbound" as const,
        origin: {
          lang: "en",
          path: "docs/srs/en/01-overview.md",
          hash: "abc",
          changedAt: "2026-06-01T10:00:00.000Z",
        },
        targets: [],
        changes: [],
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        resolvedAt: "2026-06-01T12:00:00.000Z",
        syncedLangs: ["jp"],
      };
      await writeJson(join(paths.dir, "resolved.json"), { version: 1, jobs: [legacyJob] });

      const { config } = await loadDocflowConfig(root);
      await reconcileTranslationQueue(root, config);

      const resolved = await loadResolvedQueue(paths.resolved);
      expect(resolved.jobs).toHaveLength(1);
      expect(resolved.jobs[0]!.id).toBe("legacy-job-id");
      expect(await pathExists(join(paths.dir, "resolved.json"))).toBe(false);
      expect(await pathExists(join(paths.dir, "resolved.json.migrated"))).toBe(true);
    });
  });
});
