import { describe, expect, it } from "vitest";
import { preprocessCallouts, renderCourseMarkdown } from "@/core/course/render.js";

describe("preprocessCallouts", () => {
  it("extracts exercise callout to placeholders", () => {
    const md = ":::exercise\nTry: `setup ai-spector project`\n:::";
    const { markdown, callouts } = preprocessCallouts(md);
    expect(markdown).toContain("AISPECTOR_CALLOUT_0");
    expect(callouts[0]).toContain('class="callout exercise"');
    expect(callouts[0]).toContain("setup ai-spector project");
  });

  it("wraps roletip block", () => {
    const md = ":::roletip\n**BA** — focus on approval wording\n:::";
    const { callouts } = preprocessCallouts(md);
    expect(callouts[0]).toContain('class="callout roletip"');
  });

  it("wraps behind block in details", () => {
    const md = ":::behind\nUses terminal setup\n:::";
    const { callouts } = preprocessCallouts(md);
    expect(callouts[0]).toContain("<details");
    expect(callouts[0]).toContain('class="callout behind"');
  });
});

describe("renderCourseMarkdown links", () => {
  it("rewrites links with locale prefix", async () => {
    const html = await renderCourseMarkdown(
      "Next [lesson](../05-generate/01-generate-srs.md).",
      "03-chat-basics/01-how-chat-works.md",
      "en",
    );
    expect(html).toContain('href="/course/en/05-generate/01-generate-srs"');
  });

  it("injects exercise callout HTML", async () => {
    const html = await renderCourseMarkdown(
      ":::exercise\n`open the course`\n:::",
      "01-welcome/01-what-is-ai-spector.md",
      "en",
    );
    expect(html).toContain('class="callout exercise"');
  });
});
