import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copyFile } from "node:fs/promises";
import { packageBundleRoot } from "../../src/core/config/load.js";
import {
  isReadinessExplicitlyConfigured,
  resolveProfileForDocType,
  resolveReadinessConfigStatus,
} from "../../src/core/readiness/config.js";
import type { DocflowConfig } from "../../src/core/config/types.js";

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

describe("readiness config", () => {
  it("detects explicit configuration", () => {
    expect(isReadinessExplicitlyConfigured({} as DocflowConfig)).toBe(false);
    expect(
      isReadinessExplicitlyConfigured({
        readiness: { profile: "regulated" },
      } as DocflowConfig),
    ).toBe(true);
  });

  it("resolves per-doc-type profile override", () => {
    const config = {
      readiness: {
        profile: "general",
        docTypes: { srs: { profile: "regulated" } },
      },
    } as DocflowConfig;
    expect(resolveProfileForDocType(config, null, "srs").profile).toBe("regulated");
    expect(resolveProfileForDocType(config, null, "srs").profileSource).toBe("config.docTypes");
    expect(resolveProfileForDocType(config, null, "basic-design").profile).toBe("general");
  });

  it("detects profile drift", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-rcfg-"));
    await mkdir(join(root, ".ai-spector/.docflow/config/doc-types/srs"), { recursive: true });
    const srcCriteria = join(
      packageBundleRoot(),
      "scaffold/.ai-spector/.docflow/config/doc-types/srs/readiness-criteria.json",
    );
    await copyFile(
      srcCriteria,
      join(root, ".ai-spector/.docflow/config/doc-types/srs/readiness-criteria.json"),
    );
    await writeJson(join(root, ".ai-spector/docflow.config.json"), {
      version: 1,
      languages: [{ code: "en", label: "English" }],
      readiness: {
        profile: "regulated",
        lastScan: { profile: "general", docType: "srs", scannedAt: "2026-01-01T00:00:00Z" },
      },
      paths: {
        graph: ".ai-spector/graph/traceability.graph.json",
        registry: ".ai-spector/registry/section-registry.json",
      },
      packs: { srs: "builtin", basicDesign: "builtin" },
    });

    const status = await resolveReadinessConfigStatus({ root });
    expect(status.configured).toBe(true);
    expect(status.profileDrift.detected).toBe(true);
    expect(status.docTypes.find((d) => d.docType === "srs")?.profile).toBe("regulated");
  });
});
