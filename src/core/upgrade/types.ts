export type UpgradeItemKind = "auto" | "config" | "agent" | "manual";
export type UpgradeSeverity = "required" | "recommended";
export type UpgradeEditor = "cursor" | "claude";

export interface UpgradeDetectRule {
  type: string;
  target?: string;
  minJump?: "patch" | "minor" | "major";
  path?: string;
  key?: string;
  default?: unknown;
  from?: string;
  to?: string;
}

export interface UpgradeApplyRule {
  command?: "sync-cursor" | "sync-claude" | "hooks install";
  type?: "config-set" | "config-rename";
  key?: string;
  value?: unknown;
  from?: string;
  to?: string;
}

export interface UpgradeChecklistItem {
  id: string;
  since: string;
  until?: string | null;
  kind: UpgradeItemKind;
  severity: UpgradeSeverity;
  title: string;
  detect: UpgradeDetectRule;
  apply?: UpgradeApplyRule;
  agentGuide?: string;
  userGuide?: string;
  changelogRef?: string;
  editors?: UpgradeEditor[];
}

export interface UpgradeChecklist {
  version: 1;
  packageMinVersion: string;
  items: UpgradeChecklistItem[];
}

export interface UpgradeFinding {
  id: string;
  status: "ok" | "missing" | "stale" | "warning";
  severity: UpgradeSeverity;
  message: string;
  fix?: "auto" | "agent" | "manual";
  detail?: string;
}

export interface UpgradeScanResult {
  scannedAt: string;
  fromVersion: string;
  toVersion: string;
  editors: UpgradeEditor[];
  applicableItems: string[];
  autoFixable: string[];
  findings: UpgradeFinding[];
  ready: boolean;
}

export interface UpgradeSetupItem {
  done: boolean;
  at: string | null;
  note?: string;
}

export interface UpgradeSetupState {
  version: 1;
  fromVersion: string | null;
  toVersion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  items: Record<string, UpgradeSetupItem>;
}

export const UPGRADE_GATE_ITEMS = [
  "upgrade.confirmed",
  "upgrade.npm-installed",
  "upgrade.auto-applied",
  "upgrade.complete",
] as const;
