import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readScaffoldVersion, stampScaffoldVersion } from "@/core/upgrade/stamp.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("scaffoldVersion stamp", () => {
  it("returns 0.0.0 when field missing", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({ version: 1, languages: [{ code: "en", label: "English" }] }),
        "utf8",
      );
      expect(await readScaffoldVersion(root)).toBe("0.0.0");
    });
  });

  it("writes scaffoldVersion on stamp", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({ version: 1, languages: [{ code: "en", label: "English" }] }),
        "utf8",
      );
      await stampScaffoldVersion(root, "0.8.85");
      expect(await readScaffoldVersion(root)).toBe("0.8.85");
    });
  });
});
