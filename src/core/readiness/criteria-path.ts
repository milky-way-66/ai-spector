import { join } from "node:path";
import type { DocflowConfig } from "../config/types.js";
import {
  docTypeReadinessCriteriaPath,
} from "../config/docflow-paths.js";
import { pathExists } from "../util/fs.js";

export async function resolveCriteriaFilePath(
  root: string,
  config: DocflowConfig,
  docType?: string,
): Promise<{ path: string; docType: string; packName: string | null }> {
  const srsPack = config.packs.srs;
  const effectiveDocType = docType ?? "srs";

  if (effectiveDocType === "srs" && srsPack === "builtin") {
    return {
      path: docTypeReadinessCriteriaPath(root, "srs"),
      docType: "srs",
      packName: null,
    };
  }

  if (effectiveDocType === "detail-design") {
    return {
      path: docTypeReadinessCriteriaPath(root, "detail-design"),
      docType: "detail-design",
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
    const configCopy = docTypeReadinessCriteriaPath(root, packName);
    if (await pathExists(configCopy)) {
      return { path: configCopy, docType: effectiveDocType, packName };
    }
    const packCopy = join(root, ".ai-spector", "packs", packName, "readiness-criteria.json");
    if (await pathExists(packCopy)) {
      return { path: packCopy, docType: effectiveDocType, packName };
    }
  }

  return {
    path: docTypeReadinessCriteriaPath(root, "srs"),
    docType: effectiveDocType === "srs" ? "srs" : effectiveDocType,
    packName,
  };
}
