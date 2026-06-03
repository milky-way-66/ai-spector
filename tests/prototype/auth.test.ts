import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runPrototypeAuth } from "../../src/commands/prototype.js";
import { loadPrototypeConfig } from "../../src/prototype/config.js";
import { withTempProject } from "../helpers/temp-project.js";

describe("runPrototypeAuth", () => {
  it("writes basicAuth to config and htpasswd file", async () => {
    await withTempProject(async (root) => {
      await runPrototypeAuth({
        root,
        username: "reviewer",
        password: "s3cret!",
      });

      const { config } = await loadPrototypeConfig(root);
      expect(config.basicAuth?.username).toBe("reviewer");
      expect(config.basicAuth?.password).toBe("s3cret!");

      const htpasswd = await readFile(join(root, "prototype/htpasswd"), "utf8");
      expect(htpasswd.trim()).toMatch(/^reviewer:\$apr1\$/);
    });
  });

  it("--from-config regenerates htpasswd", async () => {
    await withTempProject(async (root) => {
      await runPrototypeAuth({
        root,
        username: "demo",
        password: "pass",
      });

      const htpasswdPath = join(root, "prototype/htpasswd");
      const { unlink } = await import("node:fs/promises");
      await unlink(htpasswdPath);

      await runPrototypeAuth({ root, fromConfig: true });

      const htpasswd = await readFile(htpasswdPath, "utf8");
      expect(htpasswd.trim()).toMatch(/^demo:\$apr1\$/);
    });
  });
});
