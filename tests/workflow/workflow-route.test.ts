import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { runWorkflowRoute } from "@/core/operations/workflow-route.js";
import { saveReviewSession } from "@/core/reviews/session.js";
import type { ReviewSessionFile } from "@/core/reviews/types.js";

describe("runWorkflowRoute", () => {
  it("uses persisted review session for continue", async () => {
    await withTempProject(async (root) => {
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [{ code: "en", label: "English" }],
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
          templates: ".ai-spector/templates",
        },
      });
      await mkdir(join(root, ".ai-spector/.docflow/review-queue"), { recursive: true });

      const session: ReviewSessionFile = {
        version: 1,
        startedAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z",
        phase: "reviewing",
        activeLogicalPath: "srs/01-overview",
        reviewStatusAt: "2026-06-15T00:00:00.000Z",
        reviewWrittenAt: null,
        contentHashAtReview: null,
      };
      await saveReviewSession(root, session);

      const result = await runWorkflowRoute({ root, message: "continue" });
      expect(result.skill).toBe("ai-spector-review");
      expect(result.context?.reviewSessionPhase).toBe("reviewing");
    });
  });
});
