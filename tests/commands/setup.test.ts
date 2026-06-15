import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { auditSetup, runSetup } from "@/core/operations/setup.js";
import { pathExists, writeJson } from "@/core/util/fs.js";
import { withTempDir, withTempProject } from "../helpers/temp-project.js";

const exec = promisify(execFile);

async function gitInit(root: string): Promise<void> {
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
}

describe("setup", () => {
  it("audit reports missing scaffold on empty dir", async () => {
    await withTempDir(async (root) => {
      const audit = await auditSetup(root);
      expect(audit.ready).toBe(false);
      expect(audit.steps.find((s) => s.id === "init")?.status).toBe("missing");
    });
  });

  it("setup --yes scaffolds project and passes audit", async () => {
    await withTempDir(async (root) => {
      await runSetup({ root, yes: true, languages: ["en", "jp"] });
      const audit = await auditSetup(root);
      expect(audit.ready).toBe(true);
      expect(audit.steps.find((s) => s.id === "init")?.status).toBe("ok");
      expect(audit.steps.find((s) => s.id === "cursor-skills")?.status).toBe("ok");
      expect(await pathExists(join(root, "docs/srs/jp"))).toBe(true);
    });
  });

  it("audit detects npm dependency warning", async () => {
    await withTempProject(async (root) => {
      await writeFile(join(root, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
      const audit = await auditSetup(root);
      expect(audit.steps.find((s) => s.id === "npm-dep")?.status).toBe("warning");
    });
  });

  it("audit detects missing screen-map when manifest exists", async () => {
    await withTempProject(async (root) => {
      await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
      await writeJson(join(root, ".ai-spector/.docflow/config/prototype/config.json"), {
        version: 1,
        prototypeDir: "prototype",
      });
      await mkdir(join(root, "prototype"), { recursive: true });
      await writeJson(join(root, "prototype/manifest.json"), {
        schemaVersion: 1,
        themeName: "stripe",
        generatedAt: "2020-01-01T00:00:00.000Z",
        screens: [],
      });

      const audit = await auditSetup(root);
      expect(audit.steps.find((s) => s.id === "prototype-screen-map")?.status).toBe("missing");
    });
  });

  it("setup refreshes existing project", async () => {
    await withTempProject(async (root) => {
      await gitInit(root);
      await writeJson(join(root, ".ai-spector/docflow.config.json"), {
        version: 1,
        languages: [{ code: "en", label: "English" }],
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
          templates: ".ai-spector/templates",
        },
      });
      await mkdir(join(root, ".cursor/skills/ai-spector"), { recursive: true });
      await writeFile(join(root, ".cursor/skills/ai-spector/SKILL.md"), "# core", "utf8");

      await runSetup({ root, yes: true, skipInit: false });
      const audit = await auditSetup(root);
      expect(audit.steps.find((s) => s.id === "init")?.status).toBe("ok");
    });
  });
});
