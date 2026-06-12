import { mkdir, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runContextList,
  runContextRecord,
  runContextResolve,
  runContextStaleScan,
  contextStorePath,
} from "../../src/core/operations/context.js";
import { runCheck } from "../../src/core/operations/check.js";
import { readJson } from "../../src/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";
import type { ContextStore } from "../../src/core/operations/context.js";

async function scaffold(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
    "utf8",
  );
}

/**
 * Rewind the source file's mtime so it predates the recorded answer; a later
 * writeFile then bumps mtime past answeredAt. Avoids same-millisecond races
 * between fs timestamps and Date.now().
 */
async function backdateFile(root: string, ref: string): Promise<void> {
  const past = new Date(Date.now() - 60_000);
  await utimes(join(root, ref), past, past);
}

describe("context staleness", () => {
  it("flips answered entries to stale when a sourceRef changed after the answer", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await mkdir(join(root, "docs/data-source"), { recursive: true });
      const ref = "docs/data-source/auth-notes.md";
      await writeFile(join(root, ref), "v1", "utf8");
      await backdateFile(root, ref);

      await runContextRecord({
        root,
        docType: "srs",
        question: "Which auth providers?",
        answer: "Google only.",
        sourceRefs: [ref],
      });

      // Untouched source — entry stays answered.
      let scan = await runContextStaleScan({ root });
      expect(scan.checked).toBe(1);
      expect(scan.markedStale).toBe(0);

      // Source edited after the answer — entry goes stale.
      await writeFile(join(root, ref), "v2: added GitHub login", "utf8");
      scan = await runContextStaleScan({ root });
      expect(scan.markedStale).toBe(1);
      expect(scan.staleTotal).toBe(1);

      const stale = await runContextList({ root, docType: "srs", status: "stale" });
      expect(stale.total).toBe(1);
      expect(stale.stores[0]?.entries[0]?.id).toBe("Q-001");
    });
  });

  it("treats a deleted sourceRef as stale and leaves other entries alone", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await runContextRecord({
        root,
        docType: "srs",
        question: "Grounded in a missing file",
        answer: "yes",
        sourceRefs: ["docs/data-source/gone.md"],
      });
      await runContextRecord({ root, docType: "srs", question: "Still open" });
      await runContextRecord({ root, docType: "srs", question: "No refs", answer: "fine" });

      const scan = await runContextStaleScan({ root });
      // Only the entry with sourceRefs is checked; refless answers never go stale.
      expect(scan.checked).toBe(1);
      expect(scan.markedStale).toBe(1);

      const store = await readJson<ContextStore>(contextStorePath(root, "srs"));
      expect(store.entries.map((e) => e.status)).toEqual(["stale", "open", "answered"]);
    });
  });

  it("re-resolving a stale entry makes it answered again and current", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await mkdir(join(root, "docs/data-source"), { recursive: true });
      const ref = "docs/data-source/payments.md";
      await writeFile(join(root, ref), "v1", "utf8");
      await backdateFile(root, ref);
      await runContextRecord({
        root,
        docType: "srs",
        question: "Retry policy?",
        answer: "3 times",
        sourceRefs: [ref],
      });
      await writeFile(join(root, ref), "v2", "utf8");
      await runContextStaleScan({ root });
      await backdateFile(root, ref); // re-answer must postdate the edit

      await runContextResolve({ root, docType: "srs", id: "Q-001", answer: "5 times now" });
      const scan = await runContextStaleScan({ root });
      expect(scan.markedStale).toBe(0);
      expect(scan.staleTotal).toBe(0);

      const answered = await runContextList({ root, docType: "srs", status: "answered" });
      expect(answered.stores[0]?.entries[0]?.answer).toBe("5 times now");
    });
  });

  it("check CTX-001 surfaces stale entries as warnings", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await mkdir(join(root, "docs/data-source"), { recursive: true });
      await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
      await mkdir(join(root, ".ai-spector/templates"), { recursive: true });
      await mkdir(join(root, "docs/srs/en"), { recursive: true });

      const ref = "docs/data-source/notes.md";
      await writeFile(join(root, ref), "v1", "utf8");
      await backdateFile(root, ref);
      await runContextRecord({
        root,
        docType: "srs",
        question: "q",
        answer: "a",
        sourceRefs: [ref],
      });
      await writeFile(join(root, ref), "v2", "utf8");
      await runContextStaleScan({ root });

      const result = await runCheck({ root });
      const ctx = result.findings.filter((f) => f.ruleId === "CTX-001");
      expect(ctx).toHaveLength(1);
      expect(ctx[0]?.severity).toBe("warning");
      expect(ctx[0]?.message).toContain("Q-001");
      expect(result.ok).toBe(true); // warnings don't fail the check
    });
  });

  it("scan with no stores is a no-op", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const scan = await runContextStaleScan({ root });
      expect(scan.docTypes).toHaveLength(0);
      expect(scan.checked).toBe(0);
      expect(scan.markedStale).toBe(0);
    });
  });
});
