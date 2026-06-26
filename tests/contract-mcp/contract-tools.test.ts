import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withTempProject } from "../helpers/temp-project.js";
import { writeJson } from "@/core/util/fs.js";
import { CapabilityDisabledError } from "@/core/engine/gate.js";
import { McpPreconditionError } from "@/interfaces/mcp/mcp-precondition.js";
import {
  dispatchContractReview,
  dispatchContractComments,
} from "@/core/operations/contract.js";

async function setupDocopsProject(
  root: string,
  caps: Record<string, boolean> = {},
): Promise<void> {
  await mkdir(join(root, ".docops"), { recursive: true });
  await writeJson(join(root, ".docops/docops.config.json"), {
    schemaVersion: "1.0",
    docsRoot: "docs",
    languages: [{ code: "en", label: "English" }],
    paths: {
      comments: ".docops/comments",
      reviewConfig: ".docops/review.config.json",
      reviewQueue: ".docops/review-queue",
      prototypeConfig: ".docops/prototype/config.json",
      prototypeScreenMap: ".docops/prototype/screen-map.json",
    },
    capabilities: {
      review: false,
      comments: false,
      prototype: false,
      graph: false,
      generate: false,
      translate: false,
      ...caps,
    },
  });
}

async function setupCommentsProject(root: string): Promise<void> {
  await setupDocopsProject(root, { comments: true });
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await writeFile(join(root, "docs/srs/01-overview.md"), "# Overview\n", "utf8");
}

// ── contract_review ────────────────────────────────────────────────────────────

describe("contract_review", () => {
  it("throws CapabilityDisabledError when review capability is disabled", async () => {
    await withTempProject(async (root) => {
      await setupDocopsProject(root, { review: false });

      await expect(
        dispatchContractReview({ root, action: "check" }),
      ).rejects.toBeInstanceOf(CapabilityDisabledError);
    });
  });

  it("throws Error on unknown action", async () => {
    await withTempProject(async (root) => {
      await setupDocopsProject(root, { review: true });
      await mkdir(join(root, ".docops/review-queue"), { recursive: true });

      await expect(
        dispatchContractReview({ root, action: "bogus_action" }),
      ).rejects.toThrow(/unknown action "bogus_action"/);
    });
  });

  it("check action succeeds when review is enabled", async () => {
    await withTempProject(async (root) => {
      await setupDocopsProject(root, { review: true });
      await mkdir(join(root, ".docops/review-queue"), { recursive: true });

      const result = await dispatchContractReview({ root, action: "check" });
      expect(result).toBeDefined();
    });
  });
});

// ── contract_comments ──────────────────────────────────────────────────────────

describe("contract_comments", () => {
  it("throws CapabilityDisabledError when comments capability is disabled", async () => {
    await withTempProject(async (root) => {
      await setupDocopsProject(root, { comments: false });

      await expect(
        dispatchContractComments({ root, action: "list" }),
      ).rejects.toBeInstanceOf(CapabilityDisabledError);
    });
  });

  it("throws Error on unknown action", async () => {
    await withTempProject(async (root) => {
      await setupDocopsProject(root, { comments: true });
      await mkdir(join(root, ".docops/comments"), { recursive: true });

      await expect(
        dispatchContractComments({ root, action: "bogus_action" }),
      ).rejects.toThrow(/unknown action "bogus_action"/);
    });
  });

  it("list action succeeds when comments capability is enabled", async () => {
    await withTempProject(async (root) => {
      await setupCommentsProject(root);
      await mkdir(join(root, ".docops/comments"), { recursive: true });

      const result = await dispatchContractComments({ root, action: "list" });
      expect(result).toBeDefined();
    });
  });
});

// ── McpPreconditionError via assertToolAllowed ─────────────────────────────────

describe("assertToolAllowed gate mapping", () => {
  it("contract_review maps to review capability in gate-mcp", async () => {
    const { gateMcpTool } = await import("@/core/engine/gate-mcp.js");
    const gate = gateMcpTool("contract_review", {
      schemaVersion: "1.0",
      docsRoot: "docs",
      languages: [],
      paths: {
        comments: ".docops/comments",
        reviewConfig: ".docops/review.config.json",
        reviewQueue: ".docops/review-queue",
        prototypeConfig: ".docops/prototype/config.json",
        prototypeScreenMap: ".docops/prototype/screen-map.json",
      },
      capabilities: {
        review: false,
        comments: true,
        prototype: false,
        graph: false,
        generate: false,
        translate: false,
      },
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("review");
  });

  it("contract_comments maps to comments capability in gate-mcp", async () => {
    const { gateMcpTool } = await import("@/core/engine/gate-mcp.js");
    const gate = gateMcpTool("contract_comments", {
      schemaVersion: "1.0",
      docsRoot: "docs",
      languages: [],
      paths: {
        comments: ".docops/comments",
        reviewConfig: ".docops/review.config.json",
        reviewQueue: ".docops/review-queue",
        prototypeConfig: ".docops/prototype/config.json",
        prototypeScreenMap: ".docops/prototype/screen-map.json",
      },
      capabilities: {
        review: true,
        comments: false,
        prototype: false,
        graph: false,
        generate: false,
        translate: false,
      },
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("comments");
  });
});
