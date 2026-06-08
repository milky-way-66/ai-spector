import { describe, expect, it } from "vitest";
import { resolveDefaultScreenId } from "../../src/core/prototype/resolve-default-screen.js";
import type { PrototypeScreenMapEntry } from "../../src/core/prototype/types.js";

function entry(
  partial: Partial<PrototypeScreenMapEntry> & Pick<PrototypeScreenMapEntry, "screenId" | "displayName">,
): PrototypeScreenMapEntry {
  return {
    screenDoc: "docs/basic-design/screens/x.md",
    screenDocPath: "basic-design/screens/x.md",
    prototypeStem: partial.screenId.toLowerCase(),
    prototypePath: `prototype/src/${partial.screenId.toLowerCase()}.html`,
    htmlExists: false,
    ...partial,
  };
}

describe("resolveDefaultScreenId", () => {
  const screens = [
    entry({ screenId: "home", displayName: "Home", htmlExists: true }),
    entry({ screenId: "login", displayName: "Login", htmlExists: true }),
    entry({ screenId: "settings", displayName: "Settings", htmlExists: false }),
  ];

  it("prefers screens with HTML and picks first when no prior default", () => {
    expect(resolveDefaultScreenId(screens)).toBe("home");
  });

  it("keeps previous default when still available (has HTML)", () => {
    expect(resolveDefaultScreenId(screens, { previous: "login" })).toBe("login");
  });

  it("honors explicit override among available screens", () => {
    expect(resolveDefaultScreenId(screens, { explicit: "login" })).toBe("login");
  });

  it("falls back to index order when no HTML exists yet", () => {
    const pending = screens.map((s) => ({ ...s, htmlExists: false }));
    expect(resolveDefaultScreenId(pending, { previous: "login" })).toBe("login");
    expect(resolveDefaultScreenId(pending)).toBe("home");
  });
});
