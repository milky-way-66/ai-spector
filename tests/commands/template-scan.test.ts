import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanTemplateFolder } from "../../src/template/scan.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "scan-test-"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scanTemplateFolder", () => {
  let tempDir: string;
  let stagingDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    stagingDir = await createTempDir();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    await rm(stagingDir, { recursive: true, force: true });
  });

  it("returns the correct file count", async () => {
    await writeFile(join(tempDir, "intro.md"), "# Introduction\n\nSome text.");
    await writeFile(join(tempDir, "uc.md"), "# Use Case: {name}\n\n## Actors\n\n{actor}");
    await writeFile(join(tempDir, "readme.txt"), "not markdown");

    const result = await scanTemplateFolder(tempDir, stagingDir);

    expect(result.files).toHaveLength(2);
  });

  it("extracts headings with correct depth, text, and 1-indexed order", async () => {
    await writeFile(
      join(tempDir, "doc.md"),
      "# Title\n\n## Section One\n\n### Subsection\n\n## Section Two\n",
    );

    const result = await scanTemplateFolder(tempDir, stagingDir);
    const file = result.files[0]!;

    expect(file.headings).toEqual([
      { depth: 1, text: "Title", order: 1 },
      { depth: 2, text: "Section One", order: 2 },
      { depth: 3, text: "Subsection", order: 3 },
      { depth: 2, text: "Section Two", order: 4 },
    ]);
  });

  it("extracts placeholders from headings and body text", async () => {
    const content = [
      "# Use Case: {name}",
      "",
      "Actor: {actor}",
      "",
      "See `{slug}` for details.",
      "",
      "```",
      "id: {nn}",
      "```",
    ].join("\n");

    await writeFile(join(tempDir, "uc.md"), content);

    const result = await scanTemplateFolder(tempDir, stagingDir);
    const file = result.files[0]!;

    expect(file.placeholders).toContain("{name}");
    expect(file.placeholders).toContain("{actor}");
    expect(file.placeholders).toContain("{slug}");
    expect(file.placeholders).toContain("{nn}");
  });

  it("deduplicates placeholders and sorts them", async () => {
    const content = "# {name}\n\nHello {name}, your slug is {slug} and name is {name}.";
    await writeFile(join(tempDir, "dup.md"), content);

    const result = await scanTemplateFolder(tempDir, stagingDir);
    const file = result.files[0]!;

    // No duplicates
    const unique = [...new Set(file.placeholders)];
    expect(file.placeholders).toEqual(unique);

    // Sorted
    expect(file.placeholders).toEqual([...file.placeholders].sort());

    // {name} appears only once
    expect(file.placeholders.filter((p) => p === "{name}")).toHaveLength(1);
  });

  it("scannedAt is a valid ISO timestamp", async () => {
    await writeFile(join(tempDir, "a.md"), "# A");

    const result = await scanTemplateFolder(tempDir, stagingDir);

    expect(result.scannedAt).toBeTruthy();
    const parsed = new Date(result.scannedAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    // Should be close to now (within 10 seconds)
    expect(Math.abs(Date.now() - parsed.getTime())).toBeLessThan(10_000);
  });

  it("returns absolute sourceDir", async () => {
    await writeFile(join(tempDir, "a.md"), "# A");
    const result = await scanTemplateFolder(tempDir, stagingDir);
    expect(result.sourceDir).toBe(tempDir);
  });

  it("skips dotfiles and dotfolders", async () => {
    await writeFile(join(tempDir, ".hidden.md"), "# Hidden");
    await mkdir(join(tempDir, ".dotdir"));
    await writeFile(join(tempDir, ".dotdir", "inside.md"), "# Inside dot dir");
    await writeFile(join(tempDir, "visible.md"), "# Visible");

    const result = await scanTemplateFolder(tempDir, stagingDir);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.relativePath).toBe("visible.md");
  });

  it("walks subdirectories recursively", async () => {
    await mkdir(join(tempDir, "subdir"));
    await writeFile(join(tempDir, "root.md"), "# Root");
    await writeFile(join(tempDir, "subdir", "nested.md"), "# Nested");

    const result = await scanTemplateFolder(tempDir, stagingDir);
    expect(result.files).toHaveLength(2);

    const paths = result.files.map((f) => f.relativePath);
    expect(paths).toContain("root.md");
    expect(paths).toContain(join("subdir", "nested.md"));
  });
});
