import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { packageBundleRoot } from "@/core/config/load.js";

interface TemplateStandardsMap {
  version: number;
  docTypes: Record<
    string,
    {
      templates: Record<string, { output: string; clauses: string[]; sections: unknown[] }>;
    }
  >;
}

describe("template-standards-map.json", () => {
  it("covers all builtin doc types and DAG templates", async () => {
    const root = packageBundleRoot();
    const mapPath = join(
      root,
      "scaffold/.ai-spector/.docflow/config/template-standards-map.json",
    );
    const raw = await readFile(mapPath, "utf8");
    const map = JSON.parse(raw) as TemplateStandardsMap;

    expect(map.version).toBe(1);
    expect(map.docTypes.srs?.templates["srs/1-introduction.md"]).toBeTruthy();
    expect(map.docTypes["basic-design"]?.templates["basic_design/db-design-template.md"]).toBeTruthy();
    expect(
      map.docTypes["detail-design"]?.templates[
        "detail_design/feature-detail-design-template.md"
      ],
    ).toBeTruthy();

    for (const docType of ["srs", "basic-design", "detail-design"] as const) {
      const dagPath = join(
        root,
        `scaffold/.ai-spector/.docflow/config/doc-types/${docType}/dag.json`,
      );
      const dag = JSON.parse(await readFile(dagPath, "utf8")) as {
        nodes: Array<{ template: string }>;
      };
      const templates = map.docTypes[docType]?.templates ?? {};
      for (const node of dag.nodes) {
        expect(templates[node.template], `${docType} missing map for ${node.template}`).toBeTruthy();
      }
    }
  });
});
