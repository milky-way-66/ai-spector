import { describe, expect, it } from "vitest";
import {
  findAbsoluteLocalRefs,
  htmlHasAbsoluteLocalRefs,
  rewriteAbsoluteLocalRefs,
} from "../../src/prototype/relative-assets.js";

describe("relative-assets", () => {
  it("finds root-absolute script and stylesheet refs", () => {
    const html = `
      <script type="module" crossorigin src="/assets/index-uOr-eA2t.js"></script>
      <link rel="stylesheet" href="/assets/index.css">
    `;
    expect(findAbsoluteLocalRefs(html)).toEqual(["/assets/index-uOr-eA2t.js", "/assets/index.css"]);
    expect(htmlHasAbsoluteLocalRefs(html)).toBe(true);
  });

  it("ignores external, protocol-relative, and anchor refs", () => {
    const html = `
      <link href="https://fonts.googleapis.com/css2?family=Inter">
      <script src="//cdn.example.com/lib.js"></script>
      <a href="#section">Skip</a>
    `;
    expect(findAbsoluteLocalRefs(html)).toEqual([]);
  });

  it("rewrites root-absolute refs to ./ relative", () => {
    const html =
      '<script type="module" crossorigin src="/assets/index-uOr-eA2t.js"></script>';
    expect(rewriteAbsoluteLocalRefs(html)).toBe(
      '<script type="module" crossorigin src="./assets/index-uOr-eA2t.js"></script>',
    );
  });

  it("preserves already-relative refs", () => {
    const html = '<script src="./assets/app.js"></script>';
    expect(rewriteAbsoluteLocalRefs(html)).toBe(html);
  });
});
