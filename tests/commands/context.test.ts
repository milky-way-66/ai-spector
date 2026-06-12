import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runContextList,
  runContextRecord,
  runContextResolve,
} from "../../src/core/operations/context.js";
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

describe("context store", () => {
  it("records an open question with a sequential id", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const first = await runContextRecord({
        root,
        docType: "srs",
        question: "Which auth providers must login support?",
        scope: "srs.use-cases",
      });
      expect(first.entry.id).toBe("Q-001");
      expect(first.entry.status).toBe("open");

      const second = await runContextRecord({
        root,
        docType: "srs",
        question: "Is guest checkout required?",
      });
      expect(second.entry.id).toBe("Q-002");

      const store = await readJson<ContextStore>(first.storePath);
      expect(store.entries).toHaveLength(2);
      expect(store.docType).toBe("srs");
    });
  });

  it("records an answered clarification in one step", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const result = await runContextRecord({
        root,
        docType: "srs",
        question: "Which auth providers?",
        answer: "Google + email/password.",
        answeredBy: "khang",
        sourceRefs: ["docs/data-source/auth-notes.md"],
      });
      expect(result.entry.status).toBe("answered");
      expect(result.entry.answer).toBe("Google + email/password.");
      expect(result.entry.answeredBy).toBe("khang");
      expect(result.entry.answeredAt).toBeDefined();
    });
  });

  it("resolves an open entry by id", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await runContextRecord({ root, docType: "srs", question: "Guest checkout?" });
      const resolved = await runContextResolve({
        root,
        docType: "srs",
        id: "Q-001",
        answer: "Yes, guests can check out without an account.",
      });
      expect(resolved.entry.status).toBe("answered");
      expect(resolved.entry.answer).toContain("guests");
    });
  });

  it("throws on resolving an unknown id", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await expect(
        runContextResolve({ root, docType: "srs", id: "Q-999", answer: "x" }),
      ).rejects.toThrow(/Q-999/);
    });
  });

  it("lists across doc types and filters by status", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      await runContextRecord({ root, docType: "srs", question: "open one" });
      await runContextRecord({ root, docType: "srs", question: "done one", answer: "yes" });
      await runContextRecord({ root, docType: "basic-design", question: "screens?" });

      const all = await runContextList({ root });
      expect(all.total).toBe(3);
      expect(all.stores.map((s) => s.docType).sort()).toEqual(["basic-design", "srs"]);

      const open = await runContextList({ root, status: "open" });
      expect(open.total).toBe(2);

      const srsAnswered = await runContextList({ root, docType: "srs", status: "answered" });
      expect(srsAnswered.total).toBe(1);
      expect(srsAnswered.stores[0]?.entries[0]?.question).toBe("done one");
    });
  });

  it("returns an empty result when nothing recorded", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const result = await runContextList({ root });
      expect(result.total).toBe(0);
      expect(result.stores).toHaveLength(0);
    });
  });
});
