import type { DocopsCapabilities } from "../docops/paths.js";
import type { DocopsConfig } from "../docops/types.js";

export class CapabilityDisabledError extends Error {
  constructor(public readonly capability: keyof DocopsCapabilities) {
    super(`Capability "${capability}" is disabled in docops.config.json`);
    this.name = "CapabilityDisabledError";
  }
}

export function isCapabilityEnabled(
  config: DocopsConfig,
  capability: keyof DocopsCapabilities,
): boolean {
  return config.capabilities?.[capability] === true;
}

export function requireCapability(
  config: DocopsConfig,
  capability: keyof DocopsCapabilities,
): void {
  if (!isCapabilityEnabled(config, capability)) {
    throw new CapabilityDisabledError(capability);
  }
}
