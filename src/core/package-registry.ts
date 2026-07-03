/** Internal Verdaccio — default for team installs (see ai-spector/.env.example). */
export const DEFAULT_NPM_REGISTRY = "http://10.101.0.239:4873";

export function npmInstallAiSpectorCommand(opts?: {
  dev?: boolean;
  version?: string;
}): string {
  const pkg = opts?.version ? `ai-spector@${opts.version}` : "ai-spector";
  const parts = ["npm", "install"];
  if (opts?.dev) parts.push("-D");
  parts.push(pkg, "--registry", DEFAULT_NPM_REGISTRY);
  return parts.join(" ");
}
