import { describe, expect, it } from "vitest";
import { viteConfigNeedsRelativeBase } from "../../src/core/prototype/build-base-path.js";

describe("build-base-path", () => {
  it("accepts base: './'", () => {
    expect(
      viteConfigNeedsRelativeBase(`export default defineConfig({ base: './' })`),
    ).toBe(false);
  });

  it("flags missing base (Vite default /)", () => {
    expect(viteConfigNeedsRelativeBase(`export default defineConfig({ plugins: [] })`)).toBe(
      true,
    );
  });

  it("flags base: '/'", () => {
    expect(viteConfigNeedsRelativeBase(`export default defineConfig({ base: '/' })`)).toBe(true);
  });
});
