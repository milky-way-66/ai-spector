import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export async function withTempProject(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ai-spector-comments-"));
  try {
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      `${JSON.stringify({ version: 1, paths: {} }, null, 2)}\n`,
    );
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
