import { describe, expect, it } from "vitest";
import {
  extractScreenIndexSection,
  parseScreenIndexFromList,
} from "../../src/prototype/parse-screen-index.js";
import type { PrototypeConfig } from "../../src/prototype/types.js";

const config: PrototypeConfig = {
  version: 1,
  listScreenDoc: "docs/basic-design/list-screens.md",
  screenIndexSection: "## 4. Screen Index",
  screenDetailDir: "docs/basic-design/screens/",
  prototypeDir: "prototype",
  srcDir: "prototype/src",
  slugFrom: "screenName",
  defaultTheme: "vercel",
};

const SAMPLE = `# Screen Map

## 4. Screen Index

| Screen | Section (Detail Screen) | User Role | Purpose |
|--------|-------------------------|-----------|---------|
| Login | 5 | Guest | Sign in |
| Dashboard | 6 | User | Overview |

## 5. Responsive Design
`;

describe("parseScreenIndexFromList", () => {
  it("parses standard Screen Index table", () => {
    const rows = parseScreenIndexFromList({
      projectRoot: "/proj",
      config,
      listMarkdown: SAMPLE,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      displayName: "Login",
      prototypeStem: "login",
      screenDoc: "docs/basic-design/screens/login.md",
      prototypePath: "prototype/src/login.html",
    });
    expect(rows[1]!.displayName).toBe("Dashboard");
  });

  it("supports optional Screen ID column", () => {
    const md = `## 4. Screen Index

| Screen ID | Screen | Section (Detail Screen) | User Role | Purpose |
|-----------|--------|-------------------------|-----------|---------|
| SCR-01 | Login | 5 | Guest | Sign in |
`;
    const rows = parseScreenIndexFromList({
      projectRoot: "/proj",
      config,
      listMarkdown: md,
    });
    expect(rows[0]!.screenId).toBe("SCR-01");
    expect(rows[0]!.displayName).toBe("Login");
  });

  it("extracts section body", () => {
    const section = extractScreenIndexSection(SAMPLE, "## 4. Screen Index");
    expect(section).toContain("| Login |");
    expect(section).not.toContain("Responsive Design");
  });
});
