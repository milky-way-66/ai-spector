import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { apr1Hash, formatHtpasswdLine } from "../../src/prototype/htpasswd.js";

function opensslApr1(password: string, salt: string): string {
  return execFileSync("openssl", ["passwd", "-apr1", "-salt", salt, password], {
    encoding: "utf8",
  }).trim();
}

describe("apr1Hash", () => {
  it("matches openssl passwd -apr1", () => {
    const salt = "aqXxxPrm";
    expect(apr1Hash("password", salt)).toBe(opensslApr1("password", salt));
  });
});

describe("formatHtpasswdLine", () => {
  it("prefixes username with apr1 hash", () => {
    const line = formatHtpasswdLine("demo", "secret");
    expect(line).toMatch(/^demo:\$apr1\$/);
  });
});
