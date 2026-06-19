import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  resolveDiffFromAnchor,
  invalidateEnrichmentIfStale,
  linkLayerDrift,
} from "@/core/sync/enrich.js";
import type { DocAnchor, EnrichmentCache } from "@/core/sync/drift-types.js";

const exec = promisify(execFile);

describe("resolveDiffFromAnchor", () => {
  it("returns git diff when anchor has gitRef", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-"));
    await exec("git", ["init"], { cwd: root });
    await exec("git", ["config", "user.email", "t@t.com"], { cwd: root });
    await exec("git", ["config", "user.name", "T"], { cwd: root });
    await mkdir(join(root, "docs/srs"), { recursive: true });
    const path = "docs/srs/a.md";
    await writeFile(join(root, path), "# v1\n");
    await exec("git", ["add", "."], { cwd: root });
    await exec("git", ["commit", "-m", "init"], { cwd: root });
    const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
    const gitRef = stdout.trim();
    await writeFile(join(root, path), "# v2\n");
    const anchor: DocAnchor = {
      path,
      hash: "oldhash",
      gitRef,
      anchoredAt: new Date().toISOString(),
    };
    const result = await resolveDiffFromAnchor(root, anchor);
    expect(result.diffSource).toBe("git");
    expect(result.diff).toContain("v2");
  });

  it("falls back to legacy content", async () => {
    const root = await mkdtemp(join(tmpdir(), "drift-legacy-"));
    const path = "docs/srs/a.md";
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await writeFile(join(root, path), "# v2\n");
    const anchor: DocAnchor = { path, hash: "x", gitRef: null, anchoredAt: "" };
    const result = await resolveDiffFromAnchor(root, anchor, {
      legacyContent: "# v1\n",
    });
    expect(result.diffSource).toBe("legacy_content");
    expect(result.linesAdded + result.linesRemoved).toBeGreaterThan(0);
  });
});

describe("invalidateEnrichmentIfStale", () => {
  it("returns null when anchorHash mismatches", () => {
    const cache: EnrichmentCache = {
      diff: "",
      linesAdded: 0,
      linesRemoved: 0,
      diffSource: "git",
      impact: { regenerate: [], syncUpstream: [], review: [] },
      computedAt: "",
      anchorHash: "aaa",
    };
    expect(invalidateEnrichmentIfStale(cache, "bbb")).toBeNull();
    expect(invalidateEnrichmentIfStale(cache, "aaa")).toBe(cache);
  });
});
