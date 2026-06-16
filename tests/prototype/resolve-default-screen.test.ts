import { describe, expect, it } from "vitest";
import { finalizeScreenMap, resolveDefaultScreenId } from "@/core/prototype/resolve-default-screen.js";
import type { PrototypeScreenMapEntry } from "@/core/prototype/types.js";

function entry(
  partial: Partial<PrototypeScreenMapEntry> & Pick<PrototypeScreenMapEntry, "screenId" | "displayName">,
): PrototypeScreenMapEntry {
  return {
    screenDocPath: "basic-design/screens/x.md",
    prototypePath: `prototype/src/${partial.screenId.toLowerCase()}.html`,
    route_exists: false,
    ...partial,
  };
}

describe("resolveDefaultScreenId", () => {
  const screens = [
    entry({ screenId: "home", displayName: "Home", route_exists: true }),
    entry({ screenId: "login", displayName: "Login", route_exists: true }),
    entry({ screenId: "settings", displayName: "Settings", route_exists: false }),
  ];

  it("prefers screens with routes/files and picks first when no prior default", () => {
    expect(resolveDefaultScreenId(screens)).toBe("home");
  });

  it("keeps previous default when still available (route exists)", () => {
    expect(resolveDefaultScreenId(screens, { previous: "login" })).toBe("login");
  });

  it("honors explicit override among available screens", () => {
    expect(resolveDefaultScreenId(screens, { explicit: "login" })).toBe("login");
  });

  it("falls back to index order when no routes exist yet", () => {
    const pending = screens.map((s) => ({ ...s, route_exists: false }));
    expect(resolveDefaultScreenId(pending, { previous: "login" })).toBe("login");
    expect(resolveDefaultScreenId(pending)).toBe("home");
  });
});

describe("finalizeScreenMap", () => {
  it("attaches defaultScreen with reviewUrl for web landing", () => {
    const screens = [
      entry({
        screenId: "login",
        displayName: "Login",
        route_exists: true,
        reviewUrl: "https://poc.dev.kaopiz.com/login",
      }),
      entry({ screenId: "home", displayName: "Home", route_exists: true }),
    ];
    const result = finalizeScreenMap({
      schemaVersion: 1,
      themeName: "stripe",
      buildMode: "spa",
      generatedAt: "2020-01-01T00:00:00.000Z",
      defaultScreenId: "login",
      screens,
    });
    expect(result.defaultScreenId).toBe("login");
    expect(result.defaultScreen?.screenId).toBe("login");
    expect(result.defaultScreen?.reviewUrl).toBe("https://poc.dev.kaopiz.com/login");
  });
});
