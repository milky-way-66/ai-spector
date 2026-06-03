import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { apr1Hash, formatHtpasswdLine } from "../../src/prototype/htpasswd.js";

function opensslApr1(password: string, salt: string): string {
  return execFileSync("openssl", ["passwd", "-apr1", "-salt", salt, password], {
    encoding: "utf8",
  }).trim();
}

/** Same algorithm as `htpasswd -nbm` (Apache MD5 / apr1). */
function htpasswdApr1Line(username: string, password: string): string | undefined {
  try {
    return execFileSync("htpasswd", ["-nbm", username, password], {
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
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

  it("apr1Hash matches htpasswd -nbm when htpasswd is installed", () => {
    const ref = htpasswdApr1Line("demo", "secret");
    if (!ref) {
      return;
    }
    const [, refHash] = ref.split(":");
    expect(refHash).toMatch(/^\$apr1\$/);
    const refSalt = refHash!.split("$")[2];
    expect(apr1Hash("secret", refSalt)).toBe(refHash);
  });
});
