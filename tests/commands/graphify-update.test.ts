import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runGraphifyUpdate } from "../../src/commands/graphify-update.js";

async function createProjectRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, ".ai-spector", ".docflow", "config"), { recursive: true });
  await mkdir(join(root, ".ai-spector", ".docflow", "graph", "graphify-out"), {
    recursive: true,
  });
  await mkdir(join(root, "docs", "data-source"), { recursive: true });
  await mkdir(join(root, "docs", "srs"), { recursive: true });
  await mkdir(join(root, "docs", "basic-design"), { recursive: true });

  await writeFile(
    join(root, ".ai-spector", "docflow.config.json"),
    JSON.stringify({ version: 1, paths: {} }, null, 2),
    "utf8",
  );
  await writeFile(
    join(root, ".ai-spector", ".docflow", "config", "analyze.graphify.json"),
    JSON.stringify(
      {
        version: 1,
        graphify: {
          defaultDataSource: "docs/data-source",
          include: ["docs/data-source"],
          docSources: ["docs/srs", "docs/basic-design"],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(root, ".ai-spector", ".docflow", "state.json"),
    JSON.stringify({ version: 1, graphify: {} }, null, 2),
    "utf8",
  );

  return root;
}

describe("runGraphifyUpdate", () => {
  it("succeeds when all configured sources are markdown-only or empty", async () => {
    const root = await createProjectRoot("ai-spector-graphify-md-only-");
    await writeFile(join(root, "docs", "data-source", "notes.md"), "# brief\n", "utf8");
    await writeFile(join(root, "docs", "srs", "uc-01.md"), "# UC-01\n", "utf8");

    await expect(runGraphifyUpdate({ root })).resolves.toMatchObject({
      sourcesRun: [],
      sourcesNoCodeSkipped: expect.arrayContaining(["docs/data-source", "docs/srs"]),
      sourcesEmptySkipped: ["docs/basic-design"],
    });
  });
});
