import { describe, expect, it } from "vitest";
import { toDeployBasePath, toSpaScreenPrototypePath } from "../../src/prototype/deploy-path.js";

describe("deploy path helpers", () => {
  it("strips prototype dir prefix from repo buildDest", () => {
    expect(toDeployBasePath("prototype/dist")).toBe("dist");
    expect(toDeployBasePath("prototype/dist", "prototype")).toBe("dist");
  });

  it("keeps buildDest when prototype prefix is absent", () => {
    expect(toDeployBasePath("dist")).toBe("dist");
  });

  it("builds per-screen SPA prototypePath from previewUri", () => {
    expect(toSpaScreenPrototypePath("dist", "/schedules/new")).toBe("dist/schedules/new");
    expect(toSpaScreenPrototypePath("dist", "/orders/demo-001?tab=1")).toBe(
      "dist/orders/demo-001",
    );
  });
});
