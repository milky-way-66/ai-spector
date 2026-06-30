import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildInitialLifecycle,
  lifecycleSummary,
  LIFECYCLE_PATH,
  readLifecycle,
  reconcileLifecycle,
  writeLifecycle,
} from "@/core/docops/lifecycle.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("buildInitialLifecycle", () => {
  it("greenfield steps exclude legacy-aligned", () => {
    const lc = buildInitialLifecycle({
      intent: "greenfield",
      adapter: "ai-spector",
      updatedBy: "ai-spector",
    });
    const ids = lc.steps.map((s) => s.id);
    expect(ids).not.toContain("legacy-aligned");
    expect(ids[0]).toBe("project-created");
    expect(lc.intent).toBe("greenfield");
  });

  it("migrate includes legacy-aligned", () => {
    const lc = buildInitialLifecycle({
      intent: "migrate",
      adapter: "ai-spector",
      updatedBy: "ai-spector",
    });
    const ids = lc.steps.map((s) => s.id);
    expect(ids).toContain("legacy-aligned");
  });
});

describe("reconcileLifecycle", () => {
  it("marks docops-init done when writerReady", () => {
    const lc = buildInitialLifecycle({
      intent: "greenfield",
      adapter: "ai-spector",
      updatedBy: "test",
    });
    const out = reconcileLifecycle({
      lifecycle: lc,
      probes: {
        writer_ready: true,
        has_docops_config: true,
        has_data_source_files: false,
        has_generated_docs: false,
        layout: "docops",
        has_ai_spector_engine: false,
      },
    });
    const byId = Object.fromEntries(out.steps.map((s) => [s.id, s.status]));
    expect(byId["docops-init"]).toBe("done");
  });

  it("keeps docops-init pending when config exists but not writerReady", () => {
    const lc = buildInitialLifecycle({
      intent: "greenfield",
      adapter: "ai-spector",
      updatedBy: "test",
    });
    const out = reconcileLifecycle({
      lifecycle: lc,
      probes: {
        writer_ready: false,
        has_docops_config: true,
        layout: "docops",
      },
    });
    const byId = Object.fromEntries(out.steps.map((s) => [s.id, s.status]));
    expect(byId["docops-init"]).toBe("pending");
  });

  it("does not downgrade blocked steps", () => {
    const lc = buildInitialLifecycle({
      intent: "migrate",
      adapter: "ai-spector",
      updatedBy: "test",
    });
    for (const s of lc.steps) {
      if (s.id === "legacy-aligned") {
        s.status = "blocked";
        s.blockedReason = "adopt failed";
      }
    }
    const out = reconcileLifecycle({
      lifecycle: lc,
      probes: {
        has_docops_config: true,
        layout: "docops",
        has_generated_docs: true,
      },
    });
    const legacy = out.steps.find((s) => s.id === "legacy-aligned");
    expect(legacy?.status).toBe("blocked");
  });
});

describe("lifecycleSummary", () => {
  it("computes percentComplete and nextStepId", () => {
    const lc = buildInitialLifecycle({
      intent: "greenfield",
      adapter: "ai-spector",
      updatedBy: "test",
    });
    const summary = lifecycleSummary(lc);
    expect(summary.present).toBe(true);
    expect(summary.percentComplete).toBe(Math.round(100 / lc.steps.length));
    expect(summary.nextStepId).toBe("git-connected");
  });

  it("integrates reconcile for migrate legacy probes", () => {
    const probes = {
      git_connected: true,
      has_docops_config: true,
      has_data_source_files: true,
      has_generated_docs: true,
      layout: "legacy",
      has_ai_spector_engine: true,
      writer_synced: true,
    };
    const reconciled = reconcileLifecycle({ lifecycle: null, probes });
    const summary = lifecycleSummary(reconciled, { present: false });
    expect(summary.present).toBe(false);
    expect(summary.intent).toBe("migrate");
    expect(summary.percentComplete).toBe(Math.round((100 * 6) / reconciled.steps.length));
    expect(summary.nextStepId).toBe("legacy-aligned");
    const byId = Object.fromEntries(summary.steps.map((s) => [s.id, s.status]));
    expect(byId["legacy-aligned"]).toBe("pending");
    expect(byId).not.toHaveProperty("data-source-added");
  });
});

describe("readLifecycle / writeLifecycle", () => {
  it("round-trips lifecycle.json on disk", async () => {
    await withTempDir(async (root) => {
      const lc = buildInitialLifecycle({
        intent: "greenfield",
        adapter: "ai-spector",
        updatedBy: "test",
      });
      const written = await writeLifecycle(root, lc);
      expect(written).toBe(join(root, LIFECYCLE_PATH));
      const loaded = await readLifecycle(root);
      expect(loaded?.intent).toBe("greenfield");
      expect(loaded?.steps.length).toBe(lc.steps.length);
    });
  });
});
