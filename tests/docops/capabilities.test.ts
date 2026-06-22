import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESOLVED_PLUGINS,
  PLUGIN_CAPABILITY_MAP,
  syncCapabilitiesFromPlugins,
} from "@/core/docops/capabilities.js";
import { mergeDocopsDefaults } from "@/core/docops/config.js";

describe("docops capabilities", () => {
  it("maps graph plugin to graph capability", () => {
    const base = mergeDocopsDefaults({});
    const synced = syncCapabilitiesFromPlugins(base, ["comments", "review", "graph"]);
    expect(synced.capabilities.graph).toBe(true);
    expect(synced.capabilities.generate).toBe(false);
  });

  it("enables generate when any generate-* plugin is resolved", () => {
    const base = mergeDocopsDefaults({});
    const synced = syncCapabilitiesFromPlugins(base, ["generate-srs"]);
    expect(synced.capabilities.generate).toBe(true);
  });

  it("documents plugin ids with capability keys", () => {
    expect(PLUGIN_CAPABILITY_MAP.graph).toBe("graph");
    expect(DEFAULT_RESOLVED_PLUGINS).toContain("comments");
  });
});
