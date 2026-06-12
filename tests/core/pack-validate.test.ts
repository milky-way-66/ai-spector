import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateCustomPack } from "../../src/core/template/pack-validate.js";

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

describe("validateCustomPack", () => {
  it("reports missing pack", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-"));
    const result = await validateCustomPack({ root, packName: "missing" });
    expect(result.ready).toBe(false);
    expect(result.gaps.some((g) => g.id === "pack.missing")).toBe(true);
  });

  it("flags context-map TODOs with questions", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-"));
    const packDir = join(root, ".ai-spector", "packs", "test-pack");
    await mkdir(packDir, { recursive: true });
    await writeJson(join(packDir, "manifest.json"), {
      version: 1,
      name: "test",
      packName: "test-pack",
      purpose: "SRS",
      standards: ["ISO-29148"],
      docType: "test-pack",
      templatesDir: "templates",
      documents: [{ documentId: "doc.test.intro", template: "intro.md", output: "docs/out.md" }],
    });
    for (const f of [
      "generate-hints.md",
      "readiness-criteria.json",
      "completeness-rules.json",
      "workflow-setup.md",
      "pack-setup.json",
      "install-checklist.md",
      "gen-status.json",
    ]) {
      await writeFile(join(packDir, f), "{}", "utf8");
    }
    await writeJson(join(packDir, "context-map.json"), {
      placeholders: { "{customField}": { source: "TODO" } },
    });
    await writeJson(join(packDir, "pack-setup.json"), {
      version: 1,
      packName: "test-pack",
      status: "incomplete",
      items: [],
    });

    const result = await validateCustomPack({ root, packName: "test-pack" });
    expect(result.ready).toBe(false);
    expect(result.contextMapTodos).toHaveLength(1);
    expect(result.questionsForUser.some((q) => q.includes("{customField}"))).toBe(true);
  });
});
