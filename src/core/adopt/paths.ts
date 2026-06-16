import { join } from "node:path";

export function adoptDir(root: string): string {
  return join(root, ".ai-spector", ".docflow", "adopt");
}

export function adoptArtifactPaths(root: string) {
  const dir = adoptDir(root);
  return {
    dir,
    scanResult: join(dir, "scan-result.json"),
    plan: join(dir, "plan.json"),
    setup: join(dir, "adopt-setup.json"),
    context: join(dir, "context.json"),
    history: join(dir, "history.jsonl"),
  };
}
