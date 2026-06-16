import { describe, expect, it } from "vitest";
import {
  attachReviewUrls,
  buildReviewUrl,
  enrichScreenMapWithReviewUrls,
} from "@/core/prototype/review-url.js";
import type { PrototypeScreenMapEntry } from "@/core/prototype/types.js";

const ctx = {
  reviewHost: "https://poc.dev.kaopiz.com",
  projectId: "acme-crm",
  deployVersion: "1.4",
};

describe("review URL helpers", () => {
  it("builds full review URL from host, project, version, and prototypePath", () => {
    expect(buildReviewUrl(ctx, "dist/login")).toBe(
      "https://poc.dev.kaopiz.com/acme-crm/1.4/dist/login",
    );
    expect(buildReviewUrl(ctx, "src/home.html")).toBe(
      "https://poc.dev.kaopiz.com/acme-crm/1.4/src/home.html",
    );
  });

  it("omits optional projectId and deployVersion segments", () => {
    expect(buildReviewUrl({ reviewHost: "https://poc.dev.kaopiz.com" }, "login")).toBe(
      "https://poc.dev.kaopiz.com/login",
    );
    expect(
      buildReviewUrl(
        { reviewHost: "https://poc.dev.kaopiz.com", projectId: "acme-crm" },
        "dist/login",
      ),
    ).toBe("https://poc.dev.kaopiz.com/acme-crm/dist/login");
  });

  it("returns undefined when reviewHost is missing", () => {
    expect(buildReviewUrl({ projectId: "acme" }, "dist/login")).toBeUndefined();
  });

  it("copies prototypePath to reviewUrl when directReviewUrl is true", () => {
    const url = "https://legacy.example.com/prototypes/login";
    const screens: PrototypeScreenMapEntry[] = [
      {
        screenId: "login",
        displayName: "Login",
        screenDocPath: "basic-design/screens/login.md",
        prototypePath: url,
        route_exists: true,
      },
    ];
    const out = attachReviewUrls(screens, { directReviewUrl: true });
    expect(out[0]!.reviewUrl).toBe(url);
  });

  it("enriches screen-map top-level review fields", () => {
    const result = enrichScreenMapWithReviewUrls(
      {
        schemaVersion: 1,
        themeName: "stripe",
        buildMode: "spa",
        generatedAt: "2020-01-01T00:00:00.000Z",
        screens: [
          {
            screenId: "login",
            displayName: "Login",
            screenDocPath: "basic-design/screens/login.md",
            prototypePath: "dist/login",
            route_exists: true,
          },
        ],
      },
      [ctx],
    );
    expect(result.reviewHost).toBe(ctx.reviewHost);
    expect(result.projectId).toBe(ctx.projectId);
    expect(result.deployVersion).toBe(ctx.deployVersion);
    expect(result.screens[0]!.reviewUrl).toContain("/dist/login");
  });
});
