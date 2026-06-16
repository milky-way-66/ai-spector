import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdoptScan } from "@/core/adopt/scan.js";
import { recordAdoptAnswer } from "@/core/adopt/setup.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldInit(root: string) {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
    "utf8",
  );
}

describe("runAdoptScan", () => {
  it("inventories flat SRS docs and asks language question", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await mkdir(join(root, "docs/srs"), { recursive: true });
      await writeFile(
        join(root, "docs/srs/1-introduction.md"),
        "# Introduction\n\nProject overview.\n",
        "utf8",
      );
      const result = await runAdoptScan({ root });
      expect(result.inventory.some((i) => i.path === "docs/srs/1-introduction.md")).toBe(true);
      expect(result.classification.languages.strategy).toBe("flat");
      expect(result.questionsForUser.some((q) => q.id.startsWith("lang-"))).toBe(true);
    });
  });

  it("skips lang question when context has lang-primary", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await mkdir(join(root, "docs/srs"), { recursive: true });
      await writeFile(
        join(root, "docs/srs/1-introduction.md"),
        "# Introduction\n\nProject overview.\n",
        "utf8",
      );
      await recordAdoptAnswer(root, "lang-primary", "en");
      const result = await runAdoptScan({ root });
      expect(result.questionsForUser.some((q) => q.id.startsWith("lang-"))).toBe(false);
    });
  });
});
