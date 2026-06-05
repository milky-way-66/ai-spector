export interface LineDiffResult {
  /** Line-oriented diff: `{lineNo} - {text}` / `{lineNo} + {text}` */
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

interface DiffOp {
  type: "remove" | "add";
  lineNo: number;
  text: string;
}

/**
 * Produce a compact line diff for merge resolution (not unified diff).
 * Removals use the old line number; additions use the new line number.
 */
export function computeLineDiff(
  oldText: string | undefined,
  newText: string,
): LineDiffResult {
  if (oldText === undefined) {
    const lines = splitLines(newText);
    const diff = lines.map((line, index) => `${index + 1} + ${line}`).join("\n");
    return { diff, linesAdded: lines.length, linesRemoved: 0 };
  }

  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const ops = buildLineDiffOps(oldLines, newLines);

  let linesAdded = 0;
  let linesRemoved = 0;
  const parts: string[] = [];

  for (const op of ops) {
    if (op.type === "remove") {
      linesRemoved++;
      parts.push(`${op.lineNo} - ${op.text}`);
    } else {
      linesAdded++;
      parts.push(`${op.lineNo} + ${op.text}`);
    }
  }

  return { diff: parts.join("\n"), linesAdded, linesRemoved };
}

function splitLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  return text.split("\n");
}

function buildLineDiffOps(oldLines: string[], newLines: string[]): DiffOp[] {
  const m = oldLines.length;
  const n = newLines.length;
  const lcs = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i]![j] = lcs[i - 1]![j - 1]! + 1;
      } else {
        lcs[i]![j] = Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i--;
      j--;
      continue;
    }
    if (j > 0 && (i === 0 || lcs[i]![j - 1]! >= lcs[i - 1]![j]!)) {
      ops.push({ type: "add", lineNo: j, text: newLines[j - 1]! });
      j--;
      continue;
    }
    if (i > 0) {
      ops.push({ type: "remove", lineNo: i, text: oldLines[i - 1]! });
      i--;
    }
  }

  ops.reverse();
  return ops;
}
