import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registerAdoptCommand } from "@/core/operations/adopt.js";
import { runAdoptScan } from "@/core/adopt/scan.js";
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

describe("adopt CLI registration", () => {
  it("registerAdoptCommand registers subcommands without throwing", () => {
    const program = new Command();
    expect(() => registerAdoptCommand(program)).not.toThrow();
    const adopt = program.commands.find((c) => c.name() === "adopt");
    expect(adopt).toBeDefined();
    const names = adopt!.commands.map((c) => c.name());
    expect(names).toEqual(
      expect.arrayContaining([
        "scan",
        "plan",
        "apply",
        "bootstrap",
        "validate",
        "setup-mark",
        "context-record",
      ]),
    );
  });
});

describe("adopt scan via core (CLI wiring)", () => {
  it("runAdoptScan returns classification for flat SRS layout", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await mkdir(join(root, "docs/srs"), { recursive: true });
      await writeFile(
        join(root, "docs/srs/1-introduction.md"),
        "# Introduction\n\nOverview.\n",
        "utf8",
      );
      const result = await runAdoptScan({ root });
      expect(result.classification.srs).toBeDefined();
      expect(result.inventory.length).toBeGreaterThan(0);
    });
  });
});
