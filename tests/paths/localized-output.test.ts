import { describe, expect, it } from "vitest";
import {
  hasLocaleSegment,
  isMisplacedBuiltinDocPath,
  localizedOutputForLang,
  localizedOutputForPrimary,
  localizeProjectionPaths,
  suggestLocalizedPath,
} from "../../src/core/paths/localized-output.js";

describe("localizedOutputForPrimary", () => {
  it("inserts primary language folder for builtin SRS and BD paths", () => {
    expect(localizedOutputForPrimary("docs/srs/3-use-cases.md", "en")).toBe(
      "docs/srs/en/3-use-cases.md",
    );
    expect(
      localizedOutputForPrimary("docs/basic-design/api-list.md", "en"),
    ).toBe("docs/basic-design/en/api-list.md");
    expect(
      localizedOutputForPrimary("docs/srs/03-use-cases/uc-01.md", "en"),
    ).toBe("docs/srs/en/03-use-cases/uc-01.md");
  });

  it("leaves already-localized and non-builtin paths unchanged", () => {
    expect(localizedOutputForPrimary("docs/srs/en/3-use-cases.md", "en")).toBe(
      "docs/srs/en/3-use-cases.md",
    );
    expect(localizedOutputForPrimary("docs/data-source/spec.ts", "en")).toBe(
      "docs/data-source/spec.ts",
    );
  });
});

describe("localizedOutputForLang", () => {
  it("maps unlocalized primary paths to secondary language folders", () => {
    expect(localizedOutputForLang("docs/srs/1-introduction.md", "vi")).toBe(
      "docs/srs/vi/1-introduction.md",
    );
  });

  it("swaps primary language segment when primary path is localized", () => {
    expect(
      localizedOutputForLang("docs/srs/en/1-introduction.md", "vi", "en"),
    ).toBe("docs/srs/vi/1-introduction.md");
    expect(
      localizedOutputForLang(
        "docs/srs/en/03-use-cases/uc-{nn}-{slug}.md",
        "vi",
        "en",
      ),
    ).toBe("docs/srs/vi/03-use-cases/uc-{nn}-{slug}.md");
  });
});

describe("misplaced builtin doc detection", () => {
  const langs = ["en", "vi"];

  it("flags docs/srs root files and nested paths without lang segment", () => {
    expect(isMisplacedBuiltinDocPath("docs/srs/3-use-cases.md", langs)).toBe(true);
    expect(isMisplacedBuiltinDocPath("docs/srs/03-use-cases/uc-01.md", langs)).toBe(
      true,
    );
    expect(isMisplacedBuiltinDocPath("docs/srs/en/3-use-cases.md", langs)).toBe(false);
    expect(isMisplacedBuiltinDocPath("docs/data-source/spec.md", langs)).toBe(false);
  });

  it("suggests primary language folder for misplaced paths", () => {
    expect(suggestLocalizedPath("docs/srs/3-use-cases.md", "en")).toBe(
      "docs/srs/en/3-use-cases.md",
    );
  });
});

describe("localizeProjectionPaths", () => {
  it("localizes builtin doc paths but not data-source paths", () => {
    expect(
      localizeProjectionPaths(
        ["docs/srs/3-use-cases.md", "docs/data-source/spec.ts"],
        "en",
      ),
    ).toEqual(["docs/srs/en/3-use-cases.md", "docs/data-source/spec.ts"]);
  });
});

describe("hasLocaleSegment", () => {
  it("detects BCP-47 folder after doc type", () => {
    expect(hasLocaleSegment("docs/srs/en/foo.md")).toBe(true);
    expect(hasLocaleSegment("docs/srs/3-use-cases.md")).toBe(false);
  });
});
