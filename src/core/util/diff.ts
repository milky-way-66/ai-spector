export interface LineDiffResult {
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Line-oriented diff between two text blobs.
 * Output format: "{lineNo} - removed line" / "{lineNo} + added line"
 * Uses LCS-based comparison for accuracy on small-to-medium files.
 */
export function computeLineDiff(prev: string, next: string): LineDiffResult {
  const prevLines = prev.split("\n");
  const nextLines = next.split("\n");

  const m = prevLines.length;
  const n = nextLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (prevLines[i - 1] === nextLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff hunks
  const diffLines: string[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  let i = m;
  let j = n;
  const ops: Array<{ op: "eq" | "del" | "ins"; prevLine: number; nextLine: number; text: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prevLines[i - 1] === nextLines[j - 1]) {
      ops.push({ op: "eq", prevLine: i, nextLine: j, text: prevLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ op: "ins", prevLine: i, nextLine: j, text: nextLines[j - 1] });
      j--;
      linesAdded++;
    } else {
      ops.push({ op: "del", prevLine: i, nextLine: j + 1, text: prevLines[i - 1] });
      i--;
      linesRemoved++;
    }
  }

  ops.reverse();

  for (const op of ops) {
    if (op.op === "del") {
      diffLines.push(`${op.prevLine} - ${op.text}`);
    } else if (op.op === "ins") {
      diffLines.push(`${op.nextLine} + ${op.text}`);
    }
  }

  return {
    diff: diffLines.join("\n"),
    linesAdded,
    linesRemoved,
  };
}
