import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdoptPlan } from "@/core/adopt/plan.js";
import { runAdoptScan } from "@/core/adopt/scan.js";
import { recordAdoptAnswer } from "@/core/adopt/setup.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldInit(root: string) {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
    "utf8",
  );
}

describe("detail-design adopt", () => {
  it("inventories docs/dd legacy alias", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await mkdir(join(root, "docs/dd/features"), { recursive: true });
      await writeFile(
        join(root, "docs/dd/features/checkout.md"),
        "# Checkout Feature\n\nF-01 details.\n",
        "utf8",
      );
      const result = await runAdoptScan({ root });
      expect(
        result.inventory.some(
          (i) => i.layer === "detail-design" && i.path.includes("docs/dd/"),
        ),
      ).toBe(true);
      expect(result.classification.detailDesign).not.toBe("missing");
    });
  });

  it("plans move from docs/dd to canonical detail-design path", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await mkdir(join(root, "docs/dd/features"), { recursive: true });
      await writeFile(
        join(root, "docs/dd/features/checkout.md"),
        "# Checkout Feature\n\nF-01 details.\n",
        "utf8",
      );
      await recordAdoptAnswer(root, "lang-primary", "en");
      await runAdoptScan({ root });
      const plan = await runAdoptPlan({ root });
      const move = plan.moves.find((m) => m.layer === "detail-design");
      expect(move?.to).toMatch(/^docs\/detail-design\/en\//);
    });
  });
});
