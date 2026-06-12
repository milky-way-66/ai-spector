import { join } from "node:path";
import type { DocflowConfig } from "../config/types.js";
import { pathExists } from "../util/fs.js";

export async function resolveCriteriaFilePath(
  root: string,
  config: DocflowConfig,
  docType?: string,
): Promise<{ path: string; docType: string; packName: string | null }> {
  const configDir = join(root, ".ai-spector/.docflow/config");
  const srsPack = config.packs.srs;
  const effectiveDocType = docType ?? "srs";

  if (effectiveDocType === "srs" && srsPack === "builtin") {
    return {
      path: join(configDir, "readiness-criteria.srs.json"),
      docType: "srs",
      packName: null,
    };
  }

  const packName =
    effectiveDocType !== "srs" && effectiveDocType !== "basic-design"
      ? effectiveDocType
      : srsPack !== "builtin"
        ? srsPack
        : null;

  if (packName) {
    const configCopy = join(configDir, `readiness-criteria.${packName}.json`);
    if (await pathExists(configCopy)) {
      return { path: configCopy, docType: effectiveDocType, packName };
    }
    const packCopy = join(root, ".ai-spector", "packs", packName, "readiness-criteria.json");
    if (await pathExists(packCopy)) {
      return { path: packCopy, docType: effectiveDocType, packName };
    }
  }

  return {
    path: join(configDir, "readiness-criteria.srs.json"),
    docType: effectiveDocType === "srs" ? "srs" : effectiveDocType,
    packName,
  };
}
