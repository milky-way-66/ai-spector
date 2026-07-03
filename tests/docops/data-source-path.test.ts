import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrateRootDataSourceToCanonical } from "@/core/docops/data-source-path.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("migrateRootDataSourceToCanonical", () => {
  it("moves root data-source files into docs/data-source", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, "data-source"), { recursive: true });
      await writeFile(join(root, "data-source", "brief.md"), "# Brief\n", "utf8");

      const result = await migrateRootDataSourceToCanonical(root);
      expect(result.migrated.length).toBe(1);
      expect(result.migrated[0]).toContain("docs/data-source/brief.md");

      const canonical = await import("node:fs/promises").then((fs) =>
        fs.readFile(join(root, "docs/data-source/brief.md"), "utf8"),
      );
      expect(canonical).toContain("# Brief");
    });
  });
});
