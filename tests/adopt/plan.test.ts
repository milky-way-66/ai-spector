import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { approveAdoptPlan, runAdoptPlan } from "@/core/adopt/plan.js";
import { adoptArtifactPaths } from "@/core/adopt/paths.js";
import { writeJson } from "@/core/util/fs.js";
import type { AdoptPlan, AdoptScanResult } from "@/core/adopt/types.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldInit(root: string) {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
    "utf8",
  );
}

async function writeFlatSrsScanFixture(root: string) {
  const paths = adoptArtifactPaths(root);
  const scanResult: AdoptScanResult = {
    scannedAt: new Date().toISOString(),
    classification: {
      srs: "builtin-aligned",
      basicDesign: "missing",
      prototype: "missing",
      languages: { detected: [], strategy: "flat" },
      dataSource: "absent",
      activePack: "builtin",
    },
    inventory: [
      {
        path: "docs/srs/1-introduction.md",
        layer: "srs",
        signals: {
          headings: [{ depth: 1, text: "Introduction" }],
          ids: [],
        },
      },
    ],
    questionsForUser: [],
  };
  await writeJson(paths.scanResult, scanResult);
  await writeJson(paths.context, { "lang-primary": "en" });
}

describe("runAdoptPlan", () => {
  it("maps flat SRS files into primary language folder", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await writeFlatSrsScanFixture(root);

      const plan = await runAdoptPlan({ root });
      const move = plan.moves.find((m) => m.from === "docs/srs/1-introduction.md");

      expect(move?.to).toBe("docs/srs/en/1-introduction.md");
      expect(move?.confidence).toBe("high");
      expect(plan.status).toBe("draft");
    });
  });
});

describe("approveAdoptPlan", () => {
  it("sets status approved", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await writeFlatSrsScanFixture(root);
      await runAdoptPlan({ root });

      const approved = await approveAdoptPlan({ root, by: "tester@example.com" });

      expect(approved.status).toBe("approved");
      expect(approved.approvedAt).toBeTruthy();
      expect(approved.approvedBy).toBe("tester@example.com");
    });
  });

  it("rejects if blockingIssues non-empty", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      const paths = adoptArtifactPaths(root);
      const draftPlan: AdoptPlan = {
        version: 1,
        status: "draft",
        approvedAt: null,
        approvedBy: null,
        moves: [],
        configPatches: [],
        prototypeActions: [],
        warnings: [],
        blockingIssues: ["Unresolved language confirmation"],
      };
      await writeJson(paths.plan, draftPlan);

      await expect(approveAdoptPlan({ root })).rejects.toThrow(/blocking/i);
    });
  });
});
