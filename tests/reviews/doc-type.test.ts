import { describe, expect, it } from "vitest";
import { docTypeFromLogicalPath } from "@/core/reviews/doc-type.js";

describe("docTypeFromLogicalPath", () => {
  it("maps srs paths", () => {
    expect(docTypeFromLogicalPath("srs/01-overview")).toBe("srs");
    expect(docTypeFromLogicalPath("srs")).toBe("srs");
    expect(docTypeFromLogicalPath("docs/srs/01-overview.md")).toBe("srs");
  });

  it("maps basic-design paths", () => {
    expect(docTypeFromLogicalPath("basic-design/api")).toBe("basic-design");
    expect(docTypeFromLogicalPath("bd/api")).toBe("basic-design");
  });

  it("maps detail-design paths", () => {
    expect(docTypeFromLogicalPath("detail-design/module-a")).toBe("detail-design");
    expect(docTypeFromLogicalPath("dd/module-a")).toBe("detail-design");
  });

  it("returns null for unknown prefixes", () => {
    expect(docTypeFromLogicalPath("other/doc")).toBeNull();
  });
});
