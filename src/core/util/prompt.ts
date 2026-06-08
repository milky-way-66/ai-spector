import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function promptLine(question: string, defaultValue = ""): Promise<string> {
  if (!isInteractive()) {
    return defaultValue;
  }
  const rl = readline.createInterface({ input, output });
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  rl.close();
  const trimmed = answer.trim();
  return trimmed || defaultValue;
}

export async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  if (!isInteractive()) {
    return defaultYes;
  }
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await promptLine(`${question} (${hint})`, defaultYes ? "y" : "n");
  const norm = answer.toLowerCase();
  if (!norm) {
    return defaultYes;
  }
  return norm === "y" || norm === "yes";
}

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Numbered single-choice prompt. Returns the value of the chosen option.
 * In non-interactive mode returns the default value immediately.
 */
export async function promptSelect<T extends string>(
  question: string,
  options: SelectOption<T>[],
  defaultValue: T,
): Promise<T> {
  if (!isInteractive()) {
    return defaultValue;
  }

  const defaultIdx = options.findIndex((o) => o.value === defaultValue);

  process.stdout.write(`\n${question}\n`);
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const marker = opt.value === defaultValue ? " (default)" : "";
    const hint = opt.hint ? `  — ${opt.hint}` : "";
    process.stdout.write(`  ${i + 1}) ${opt.label}${marker}${hint}\n`);
  }

  const rl = readline.createInterface({ input, output });
  const defaultDisplay = String(defaultIdx + 1);
  const raw = await rl.question(`Choose [${defaultDisplay}]: `);
  rl.close();

  const trimmed = raw.trim();
  if (!trimmed) {
    return defaultValue;
  }

  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return options[num - 1].value;
  }

  // Accept value typed directly (e.g. "claude")
  const byValue = options.find((o) => o.value === trimmed);
  if (byValue) {
    return byValue.value;
  }

  process.stdout.write(`  Invalid choice — using default (${defaultValue})\n`);
  return defaultValue;
}
