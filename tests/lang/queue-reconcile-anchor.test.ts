import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { loadDocflowConfig } from "@/core/config/load.js";
import {
  loadFingerprints,
  loadPendingQueue,
  queuePaths,
} from "@/core/lang/queue-store.js";
import { reconcileTranslationQueue } from "@/core/lang/queue.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempProject } from "../helpers/temp-project.js";
import { syncDocopsLanguages } from "../helpers/docops-scaffold.js";

const exec = promisify(execFile);

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

describe("translation queue reconcile anchors", () => {
  it("stores anchor with gitRef and no fingerprint content after changed file", async () => {
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
      const fp = await loadFingerprints(paths.fingerprints);

      const filePath = "docs/srs/en/01-overview.md";
      expect(fp.files[filePath]?.content).toBeUndefined();
      expect(pending.jobs).toHaveLength(1);

      const change = pending.jobs[0]!.changes[0]!;
      expect(change.diff).toBeUndefined();
      expect(change.linesAdded).toBeUndefined();
      expect(change.linesRemoved).toBeUndefined();
      expect(change.anchor).toBeDefined();
      expect(change.anchor!.path).toBe(filePath);
      expect(change.anchor!.hash).toBeTruthy();
      expect(change.anchor!.gitRef).toBeTruthy();
      expect(change.anchor!.anchoredAt).toBeTruthy();
    });
  });
});
