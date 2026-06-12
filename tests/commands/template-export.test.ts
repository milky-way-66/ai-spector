import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "@/core/util/fs.js";
import { readJson } from "@/core/util/fs.js";
import type { PackManifest } from "@/core/config/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "template-export-test-"));
}

/**
 * Creates a minimal project root with:
 *   .ai-spector/docflow.config.json
 *   .ai-spector/packs/<packName>/manifest.json
 *   .ai-spector/packs/<packName>/templates/<files>
 */
async function setupMinimalProject(
  root: string,
  packName: string,
  manifest: PackManifest,
  templates: Record<string, string> = {},
): Promise<void> {
  const aiSpectorDir = join(root, ".ai-spector");
  await mkdir(aiSpectorDir, { recursive: true });

  // Write config
  await writeFile(
    join(aiSpectorDir, "docflow.config.json"),
    JSON.stringify({ version: 1, languages: [{ code: "en", label: "English" }], paths: { graph: ".ai-spector/graph/t.json", registry: ".ai-spector/registry/s.json" }, packs: { active: packName } }),
    "utf8",
  );

  // Write pack
  const packDir = join(aiSpectorDir, "packs", packName);
  const templatesDir = join(packDir, "templates");
  await mkdir(templatesDir, { recursive: true });
  await writeFile(join(packDir, "manifest.json"), JSON.stringify(manifest), "utf8");

  for (const [relPath, content] of Object.entries(templates)) {
    const dest = join(templatesDir, relPath);
    await mkdir(join(dest, ".."), { recursive: true });
    await writeFile(dest, content, "utf8");
  }
}

// ---------------------------------------------------------------------------
// Import runTemplateExport via the registered command for integration-style tests
// We test the command function directly by importing from template.ts
// ---------------------------------------------------------------------------

// We invoke via the internal function — re-export it for testability is not
// required; instead we call through the CLI logic by importing the module and
// calling registerTemplateCommand on a test Program instance.
// For simplicity, we test by calling the exported register function and
// dispatching commands programmatically.

import { Command } from "commander";
import { registerTemplateCommand } from "@/core/operations/template.js";

async function runExport(
  root: string,
  outputPath: string,
  opts: { pack?: string; overwrite?: boolean } = {},
): Promise<void> {
  const program = new Command();
  program.exitOverride(); // prevent process.exit
  registerTemplateCommand(program);

  const args = ["template", "export", outputPath, "-C", root];
  if (opts.pack) args.push("--pack", opts.pack);
  if (opts.overwrite) args.push("--overwrite");

  await program.parseAsync(args, { from: "user" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("template export", () => {
  let root: string;
  let outputDir: string;

  beforeEach(async () => {
    root = await createTempDir();
    outputDir = join(await createTempDir(), "exported-pack");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    // outputDir's parent is a tmpdir
    try { await rm(join(outputDir, ".."), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("exports a custom pack to the output dir", async () => {
    const manifest: PackManifest = {
      version: 1,
      name: "My Test Pack",
      packName: "test-pack",
      templatesDir: "templates",
      documents: [
        { documentId: "doc.test.intro", template: "intro.md", output: "docs/intro.md" },
        { documentId: "doc.test.overview", template: "overview.md", output: "docs/overview.md" },
      ],
    };

    await setupMinimalProject(root, "test-pack", manifest, {
      "intro.md": "# Introduction\n\nHello {project}.",
      "overview.md": "# Overview\n\nSection {num}.",
    });

    await runExport(root, outputDir, { pack: "test-pack" });

    // Output dir should exist
    expect(await pathExists(outputDir)).toBe(true);

    // manifest.json should be present and valid
    expect(await pathExists(join(outputDir, "manifest.json"))).toBe(true);
    const exportedManifest = await readJson<PackManifest>(join(outputDir, "manifest.json"));
    expect(exportedManifest.packName).toBe("test-pack");
    expect(exportedManifest.templatesDir).toBe("templates");

    // Template files should be present
    expect(await pathExists(join(outputDir, "templates", "intro.md"))).toBe(true);
    expect(await pathExists(join(outputDir, "templates", "overview.md"))).toBe(true);
  });

  it("exports the active pack when --pack is not specified", async () => {
    const manifest: PackManifest = {
      version: 1,
      name: "Active Pack",
      packName: "active-pack",
      templatesDir: "templates",
      documents: [
        { documentId: "doc.active.readme", template: "readme.md", output: "docs/readme.md" },
      ],
    };

    await setupMinimalProject(root, "active-pack", manifest, {
      "readme.md": "# Readme",
    });

    await runExport(root, outputDir);

    expect(await pathExists(join(outputDir, "manifest.json"))).toBe(true);
    const exportedManifest = await readJson<PackManifest>(join(outputDir, "manifest.json"));
    expect(exportedManifest.packName).toBe("active-pack");
  });

  it("errors when output dir already exists and --overwrite is not set", async () => {
    const manifest: PackManifest = {
      version: 1,
      name: "Pack",
      packName: "my-pack",
      templatesDir: "templates",
      documents: [],
    };
    await setupMinimalProject(root, "my-pack", manifest);

    // Pre-create the output directory
    await mkdir(outputDir, { recursive: true });

    // Capture process.exitCode by saving and restoring
    const prevExitCode = process.exitCode;
    process.exitCode = undefined as unknown as number;

    await runExport(root, outputDir, { pack: "my-pack" });

    const capturedExitCode = process.exitCode;
    process.exitCode = prevExitCode;

    expect(capturedExitCode).toBe(1);
    // The existing output dir should be untouched (manifest.json not written)
    expect(await pathExists(join(outputDir, "manifest.json"))).toBe(false);
  });

  it("replaces existing output dir when --overwrite is set", async () => {
    const manifest: PackManifest = {
      version: 1,
      name: "Pack",
      packName: "my-pack",
      templatesDir: "templates",
      documents: [
        { documentId: "doc.my.tpl", template: "tpl.md", output: "docs/tpl.md" },
      ],
    };
    await setupMinimalProject(root, "my-pack", manifest, { "tpl.md": "# Template" });

    // Pre-create output dir with a stale file
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "stale.txt"), "old content", "utf8");

    await runExport(root, outputDir, { pack: "my-pack", overwrite: true });

    // Stale file should be gone
    expect(await pathExists(join(outputDir, "stale.txt"))).toBe(false);
    // New manifest should be present
    expect(await pathExists(join(outputDir, "manifest.json"))).toBe(true);
    const exportedManifest = await readJson<PackManifest>(join(outputDir, "manifest.json"));
    expect(exportedManifest.packName).toBe("my-pack");
  });

  it("copies skill-hints.md if present in the pack folder", async () => {
    const manifest: PackManifest = {
      version: 1,
      name: "Pack With Hints",
      packName: "hints-pack",
      templatesDir: "templates",
      documents: [],
    };
    await setupMinimalProject(root, "hints-pack", manifest);

    // Add skill-hints.md manually
    const packDir = join(root, ".ai-spector", "packs", "hints-pack");
    await writeFile(join(packDir, "skill-hints.md"), "## Hints\n\nUse {{project}}.", "utf8");

    await runExport(root, outputDir, { pack: "hints-pack" });

    expect(await pathExists(join(outputDir, "skill-hints.md"))).toBe(true);
    const hints = await readFile(join(outputDir, "skill-hints.md"), "utf8");
    expect(hints).toContain("Use {{project}}.");
  });

  it("exported manifest.json is valid JSON with correct packName", async () => {
    const manifest: PackManifest = {
      version: 1,
      name: "JSON Check Pack",
      packName: "json-check",
      templatesDir: "templates",
      documents: [
        { documentId: "doc.j.a", template: "a.md" },
        { documentId: "doc.j.b", template: "b.md" },
      ],
    };
    await setupMinimalProject(root, "json-check", manifest, {
      "a.md": "# A",
      "b.md": "# B",
    });

    await runExport(root, outputDir, { pack: "json-check" });

    const raw = await readFile(join(outputDir, "manifest.json"), "utf8");
    // Must be valid JSON
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw) as PackManifest;
    expect(parsed.packName).toBe("json-check");
    expect(Array.isArray(parsed.documents)).toBe(true);
    expect(parsed.documents).toHaveLength(2);
  });
});
