import { describe, expect, it } from "vitest";
import type { PackManifest } from "../../src/core/config/types.js";
import {
  buildPackSetupState,
  isPackSetupReady,
  buildInstallChecklistMarkdown,
} from "../../src/core/template/pack-setup.js";

const manifest: PackManifest = {
  version: 1,
  name: "test",
  packName: "my-pack",
  purpose: "SRS",
  standards: ["ISO-29148"],
  docType: "my-pack",
  templatesDir: "templates",
  documents: [{ documentId: "doc.my.pack.intro", template: "intro.md", output: "docs/out/intro.md" }],
};

describe("buildPackSetupState", () => {
  it("starts incomplete when context-map has TODOs", () => {
    const state = buildPackSetupState(
      manifest,
      undefined,
      { placeholders: { "{foo}": { source: "TODO" } } },
      { skillIncludesGatedFlow: true },
    );
    expect(state.status).toBe("incomplete");
    expect(isPackSetupReady(state)).toBe(false);
    const todoItem = state.items.find((i) => i.id === "context-map.resolved");
    expect(todoItem?.done).toBe(false);
  });

  it("checklist mentions install phases", () => {
    const state = buildPackSetupState(manifest, undefined, { placeholders: {} });
    const md = buildInstallChecklistMarkdown(manifest, state, 0);
    expect(md).toContain("Post-install");
    expect(md).toContain("my-pack");
  });
});
