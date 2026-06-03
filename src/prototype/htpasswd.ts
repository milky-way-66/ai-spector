import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Apache apr1 MD5 via `openssl passwd -apr1` (nginx/Apache compatible). */
export function apr1Hash(password: string, salt?: string): string {
  const args = ["passwd", "-apr1"];
  if (salt) {
    args.push("-salt", salt);
  }
  args.push(password);
  try {
    return execFileSync("openssl", args, { encoding: "utf8" }).trim();
  } catch (err) {
    throw new Error(
      "Could not run `openssl passwd -apr1`. Install OpenSSL and ensure it is on PATH.",
      { cause: err },
    );
  }
}

export function formatHtpasswdLine(username: string, password: string): string {
  const user = username.trim();
  if (!user) {
    throw new Error("username is required");
  }
  if (!password) {
    throw new Error("password is required");
  }
  const hash = apr1Hash(password);
  return `${user}:${hash}`;
}

export async function writeHtpasswdFile(
  filePath: string,
  username: string,
  password: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${formatHtpasswdLine(username, password)}\n`, "utf8");
}
