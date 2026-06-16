import { describe, expect, it } from "vitest";
import {
  toDeployBasePath,
  toDeployPrototypePath,
  toSpaScreenPrototypePath,
} from "@/core/prototype/deploy-path.js";

describe("deploy path helpers", () => {
  it("strips prototype dir prefix from repo paths", () => {
    expect(toDeployPrototypePath("prototype/src/login.html")).toBe("src/login.html");
    expect(toDeployPrototypePath("prototype/dist/index.html")).toBe("dist/index.html");
  });

  it("strips prototype dir prefix from repo buildDest", () => {
    expect(toDeployBasePath("prototype/dist")).toBe("dist");
    expect(toDeployBasePath("prototype/dist", "prototype")).toBe("dist");
  });

  it("keeps buildDest when prototype prefix is absent", () => {
    expect(toDeployBasePath("dist")).toBe("dist");
  });

  it("builds per-screen SPA prototypePath without trailing slash", () => {
    expect(toSpaScreenPrototypePath("dist", "/schedules/new")).toBe("dist/schedules/new");
    expect(toSpaScreenPrototypePath("dist", "/orders/demo-001?tab=1")).toBe(
      "dist/orders/demo-001",
    );
    expect(toSpaScreenPrototypePath("dist", "/login/")).toBe("dist/login");
  });
});
