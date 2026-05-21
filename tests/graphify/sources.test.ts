import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  computeSourceContentHash,
  filterSourcesByHashChange,
  resolveGraphifySources,
} from "../../src/graphify/sources.js";

describe("resolveGraphifySources", () => {
  it("includes default data source and doc sources without duplicates", () => {
    const specs = resolveGraphifySources({
      defaultDataSource: "docs/data-source",
      include: ["docs/data-source"],
      docSources: ["docs/srs", "docs/basic-design"],
    });
    const paths = specs.map((s) => s.path);
    expect(paths).toContain("docs/data-source");
    expect(paths).toContain("docs/srs");
    expect(paths).toContain("docs/basic-design");
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("filterSourcesByHashChange", () => {
  it("runs sources when hash changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-gf-"));
    const srsDir = join(root, "docs/srs");
    await mkdir(srsDir, { recursive: true });
    const file = join(srsDir, "a.md");
    await writeFile(file, "# UC-01\n", "utf8");

    const specs = [{ path: "docs/srs", key: "docs/srs" }];
    const first = await filterSourcesByHashChange(root, specs, {}, false);
    expect(first.toRun).toHaveLength(1);

    await writeFile(file, "# UC-01\n# UC-02\n", "utf8");
    const second = await filterSourcesByHashChange(root, specs, first.hashes, false);
    expect(second.toRun).toHaveLength(1);

    const third = await filterSourcesByHashChange(root, specs, second.hashes, false);
    expect(third.toRun).toHaveLength(0);
  });

  it("force runs all sources", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-gf2-"));
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await writeFile(join(root, "docs/srs", "b.md"), "x", "utf8");

    const specs = [{ path: "docs/srs", key: "docs/srs" }];
    const h = await computeSourceContentHash(root, "docs/srs");
    const { toRun } = await filterSourcesByHashChange(
      root,
      specs,
      { "docs/srs": h! },
      true,
    );
    expect(toRun).toHaveLength(1);
  });
});
