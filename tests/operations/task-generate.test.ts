import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildGeneratePlan,
  recordGenerateWaveProgress,
  runTaskApprovePlan,
  runTaskCreate,
  runTaskGet,
  runTaskUpdate,
} from "../../src/core/operations/task.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffold(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({
      languages: [{ code: "en", label: "English" }],
      paths: { graph: ".ai-spector/graph/traceability.json" },
    }),
    "utf8",
  );
  await mkdir(join(root, "docs/data-source"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
}

describe("generate task workflow", () => {
  it("expands wave steps on plan approval and advances through waves", async () => {
    await withTempDir(async (root) => {
      await scaffold(root);
      const { task } = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate SRS",
        docType: "srs",
      });

      const plan = buildGeneratePlan({
        docType: "srs",
        language: "en",
        scope: "all",
        briefing: [{ target: "docs/srs/en/03-use-cases.md" }],
        rows: [
          {
            output: "docs/srs/en/03-use-cases.md",
            dagNode: "srs.use-cases",
            sources: ["auth-notes.md"],
            keyPoints: ["login"],
          },
        ],
        waves: [
          { wave: 1, nodeIds: ["srs.introduction"] },
          { wave: 2, nodeIds: ["srs.use-cases"] },
        ],
      });

      await runTaskUpdate({
        root,
        taskId: task.id,
        patch: { plan: { kind: "generate", plan } },
      });

      const approved = await runTaskApprovePlan({ root, taskId: task.id });
      expect(approved.task.currentStepId).toBe("wave-1");
      expect(approved.task.steps.some((s) => s.id === "generate-waves")).toBe(false);
      expect(approved.task.steps.filter((s) => s.id.startsWith("wave-"))).toHaveLength(2);
      expect(approved.task.contextRefs.extractedFile).toBe("extracted/srs.json");

      const afterWave1 = await recordGenerateWaveProgress({
        root,
        taskId: task.id,
        waveId: "wave-1",
        status: "done",
        artifacts: ["docs/srs/en/01-introduction.md"],
      });
      expect(afterWave1.task.currentStepId).toBe("wave-2");

      const docPath = "docs/srs/en/03-use-cases.md";
      await mkdir(join(root, "docs/srs/en"), { recursive: true });
      await writeFile(join(root, docPath), "# Use cases\n", "utf8");

      const afterWave2 = await recordGenerateWaveProgress({
        root,
        taskId: task.id,
        waveId: "wave-2",
        status: "done",
        artifacts: [docPath],
      });
      expect(afterWave2.task.currentStepId).toBe("extract");
      expect(afterWave2.task.snapshot.artifactHashes?.[docPath]).toMatch(/^sha256:/);

      const loaded = await runTaskGet({ root, taskId: task.id });
      expect(loaded.task.steps.find((s) => s.id === "wave-2")?.status).toBe("done");
    });
  });
});
