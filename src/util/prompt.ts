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
