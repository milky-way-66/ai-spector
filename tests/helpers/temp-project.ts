import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldDocopsMinimal } from "./docops-scaffold.js";

export async function withTempProject(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ai-spector-comments-"));
  try {
    await scaffoldDocopsMinimal(root);
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function withTempDir(fn: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ai-spector-tmp-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
