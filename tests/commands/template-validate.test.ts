import { describe, it, expect } from "vitest";
import { validatePackManifest } from "@/core/template/validate.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validManifest() {
  return {
    packName: "my-pack",
    templatesDir: "templates",
    documents: [
      {
        documentId: "doc.my.intro",
        template: "introduction.md",
        output: "docs/introduction.md",
      },
      {
        documentId: "doc.my.uc-detail",
        template: "uc-detail.md",
        outputPattern: "docs/use-cases/uc-{nn}-{slug}.md",
        perDomain: "useCase",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validatePackManifest", () => {
  it("passes a valid manifest", () => {
    const { valid, errors } = validatePackManifest(validManifest());
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it("fails when manifest is not an object", () => {
    expect(validatePackManifest(null).valid).toBe(false);
    expect(validatePackManifest("string").valid).toBe(false);
    expect(validatePackManifest(42).valid).toBe(false);
  });

  it("fails when packName is missing", () => {
    const m = validManifest() as Record<string, unknown>;
    delete m["packName"];
    const { valid, errors } = validatePackManifest(m);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("packName"))).toBe(true);
  });

  it("fails when packName has uppercase letters", () => {
    const { valid, errors } = validatePackManifest({ ...validManifest(), packName: "MyPack" });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("packName"))).toBe(true);
  });

  it("fails when packName starts with a hyphen", () => {
    const { valid, errors } = validatePackManifest({ ...validManifest(), packName: "-bad" });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("packName"))).toBe(true);
  });

  it("accepts a single-segment packName", () => {
    const { valid } = validatePackManifest({ ...validManifest(), packName: "mypack" });
    expect(valid).toBe(true);
  });

  it("fails when documents is empty", () => {
    const { valid, errors } = validatePackManifest({ ...validManifest(), documents: [] });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("documents"))).toBe(true);
  });

  it("fails when documents is missing", () => {
    const m = validManifest() as Record<string, unknown>;
    delete m["documents"];
    const { valid, errors } = validatePackManifest(m);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("documents"))).toBe(true);
  });

  it("fails when a document is missing template", () => {
    const m = validManifest();
    const doc = m.documents[0] as Record<string, unknown>;
    delete doc["template"];
    const { valid, errors } = validatePackManifest(m);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("template"))).toBe(true);
  });

  it("fails when a document has both output and outputPattern", () => {
    const m = validManifest();
    const doc = m.documents[0] as Record<string, unknown>;
    doc["output"] = "docs/intro.md";
    doc["outputPattern"] = "docs/{slug}.md";
    const { valid, errors } = validatePackManifest(m);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("output") && e.includes("outputPattern"))).toBe(true);
  });

  it("fails when a document has neither output nor outputPattern", () => {
    const m = validManifest();
    const doc = m.documents[0] as Record<string, unknown>;
    delete doc["output"];
    const { valid, errors } = validatePackManifest(m);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("output") || e.includes("outputPattern"))).toBe(true);
  });

  it("fails on duplicate documentId", () => {
    const m = validManifest();
    m.documents[1] = { ...m.documents[0]! };
    const { valid, errors } = validatePackManifest(m);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("duplicate") || e.includes("duplicated"))).toBe(true);
  });

  it("allows perDomain to be omitted", () => {
    const m = validManifest();
    const doc = m.documents[0] as Record<string, unknown>;
    delete doc["perDomain"];
    const { valid } = validatePackManifest(m);
    expect(valid).toBe(true);
  });

  it("fails when perDomain is an empty string", () => {
    const m = validManifest();
    (m.documents[0] as Record<string, unknown>)["perDomain"] = "";
    const { valid, errors } = validatePackManifest(m);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("perDomain"))).toBe(true);
  });
});
