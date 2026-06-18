import { join } from "node:path";

export function upgradeDir(root: string): string {
  return join(root, ".ai-spector", ".docflow", "upgrade");
}

export function upgradeArtifactPaths(root: string) {
  const dir = upgradeDir(root);
  return {
    dir,
    scanResult: join(dir, "scan-result.json"),
    setup: join(dir, "upgrade-setup.json"),
  };
}
