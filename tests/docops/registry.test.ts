import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathExists } from "@/core/util/fs.js";
import { discoverDocumentsFromTree } from "@/core/docops/registry/discover.js";
import {
  loadRegistryIndex,
  normalizeLogicalKey,
  resolveScreenDocument,
} from "@/core/docops/registry/load.js";
import { documentEntityRel, screenEntityRel } from "@/core/docops/registry/paths.js";
import { syncDocopsRegistry } from "@/core/docops/registry/sync.js";
import type { DocopsConfig } from "@/core/docops/types.js";
import { DEFAULT_DOCOPS_PATHS } from "@/core/docops/paths.js";

function baseConfig(): DocopsConfig {
  return {
    schemaVersion: "1.0",
    docsRoot: "docs",
    languages: [
      { code: "en", label: "English" },
      { code: "vi", label: "Vietnamese" },
    ],
    primaryLanguage: "en",
    paths: { ...DEFAULT_DOCOPS_PATHS },
    capabilities: {
      review: true,
      comments: true,
      prototype: true,
      graph: false,
      generate: false,
      translate: false,
    },
    docTypes: {
      srs: { enabled: true, path: "docs/srs", label: "SRS" },
      basicDesign: { enabled: true, path: "docs/basic-design", label: "Basic Design" },
    },
  };
}

async function writeProject(
  root: string,
  config: DocopsConfig,
  extras?: { screenMap?: unknown },
): Promise<void> {
  await mkdir(join(root, ".docops"), { recursive: true });
  await writeFile(
    join(root, ".docops/docops.config.json"),
    JSON.stringify(config, null, 2),
    "utf8",
  );
  if (extras?.screenMap) {
    await mkdir(join(root, ".docops/prototype"), { recursive: true });
    await writeFile(
      join(root, ".docops/prototype/screen-map.json"),
      JSON.stringify(extras.screenMap, null, 2),
      "utf8",
    );
  }
}

describe("discoverDocumentsFromTree", () => {
  it("groups multi-language files under one logical path", async () => {
    const root = await mkdtemp(join(tmpdir(), "registry-disc-"));
    const config = baseConfig();
    await writeProject(root, config);
    await mkdir(join(root, "docs/srs/en"), { recursive: true });
    await mkdir(join(root, "docs/srs/vi"), { recursive: true });
    await writeFile(join(root, "docs/srs/en/01-overview.md"), "# EN\n", "utf8");
    await writeFile(join(root, "docs/srs/vi/01-overview.md"), "# VI\n", "utf8");

    const discovered = await discoverDocumentsFromTree(root, config);
    expect(discovered).toHaveLength(1);
    expect(discovered[0]!.logicalPath).toBe(normalizeLogicalKey("srs/01-overview.md"));
    expect(discovered[0]!.repoDocs.en).toBe("docs/srs/en/01-overview.md");
    expect(discovered[0]!.repoDocs.vi).toBe("docs/srs/vi/01-overview.md");
    expect(discovered[0]!.docType).toBe("SRS");
  });
});

describe("syncDocopsRegistry", () => {
  it("creates document entities and links screens by documentEntityId", async () => {
    const root = await mkdtemp(join(tmpdir(), "registry-sync-"));
    const config = baseConfig();

    await writeProject(root, config, {
      screenMap: {
        schemaVersion: 1,
        buildMode: "static",
        defaultScreenId: "SCR-001",
        screens: [
          {
            screenId: "SCR-001",
            displayName: "Login",
            screenDocPath: "basic-design/screens/login.md",
            screenDocs: {
              en: "docs/basic-design/en/screens/login.md",
            },
            prototypePath: "src/login.html",
            route_exists: true,
          },
        ],
      },
    });

    await mkdir(join(root, "docs/basic-design/en/screens"), { recursive: true });
    await writeFile(join(root, "docs/basic-design/en/screens/login.md"), "# Login\n", "utf8");

    const first = await syncDocopsRegistry({ projectRoot: root });
    expect(first.documentsCreated).toBe(1);
    expect(first.screensCreated).toBe(1);
    expect(first.manifestWritten).toBe(true);

    const index = await loadRegistryIndex(root, config);
    expect(index.documents).toHaveLength(1);
    const doc = index.documents[0]!;
    expect(doc.logicalPath).toBe("basic-design/screens/login.md");

    const screen = index.screensById.get("SCR-001");
    expect(screen?.documentEntityId).toBe(doc.entityId);
    expect(screen?.prototypePath).toBe("src/login.html");
    expect(resolveScreenDocument(index, screen!)?.entityId).toBe(doc.entityId);

    const second = await syncDocopsRegistry({ projectRoot: root });
    expect(second.documentsCreated).toBe(0);
    expect(second.documentsUpdated).toBe(0);
    expect(second.screensCreated).toBe(0);
    expect(first.screenMapRemoved).toBe(true);
    expect(await pathExists(join(root, ".docops/prototype/screen-map.json"))).toBe(false);
  });

  it("preserves entityId when logical path unchanged on resync", async () => {
    const root = await mkdtemp(join(tmpdir(), "registry-stable-"));
    const config = baseConfig();
    await writeProject(root, config);
    await mkdir(join(root, "docs/srs/en"), { recursive: true });
    await writeFile(join(root, "docs/srs/en/01-overview.md"), "# A\n", "utf8");

    await syncDocopsRegistry({ projectRoot: root });
    const index1 = await loadRegistryIndex(root, config);
    const id1 = index1.documents[0]!.entityId;

    await syncDocopsRegistry({ projectRoot: root });
    const index2 = await loadRegistryIndex(root, config);
    expect(index2.documents[0]!.entityId).toBe(id1);
    expect(documentEntityRel(config, id1)).toContain(id1);
  });

  it("dry-run does not write entity files", async () => {
    const root = await mkdtemp(join(tmpdir(), "registry-dry-"));
    const config = baseConfig();
    await writeProject(root, config);
    await mkdir(join(root, "docs/srs"), { recursive: true });
    await writeFile(join(root, "docs/srs/intro.md"), "# Intro\n", "utf8");

    const result = await syncDocopsRegistry({ projectRoot: root, dryRun: true });
    expect(result.documentsCreated).toBe(1);
    expect(result.actions.some((a) => a.includes("create document"))).toBe(true);

    const index = await loadRegistryIndex(root, config);
    expect(index.documents).toHaveLength(0);
  });
});

describe("registry paths", () => {
  it("builds stable rel paths", () => {
    const config = baseConfig();
    expect(documentEntityRel(config, "uuid")).toBe(".docops/registry/documents/uuid.json");
    expect(screenEntityRel(config, "SCR-001")).toBe(".docops/registry/screens/SCR-001.json");
  });
});
