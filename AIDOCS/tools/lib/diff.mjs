// diff.mjs - line-based LCS diff + unified-style printer. Used by commit
// --preview to show what would change without writing files. O(m*n) memory and
// time; fine for our file sizes (hundreds of lines max).

function lineDiff(aLines, bLines) {
  const m = aLines.length;
  const n = bLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) {
      result.push({ type: "ctx", line: aLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "del", line: aLines[i] });
      i++;
    } else {
      result.push({ type: "add", line: bLines[j] });
      j++;
    }
  }
  while (i < m) result.push({ type: "del", line: aLines[i++] });
  while (j < n) result.push({ type: "add", line: bLines[j++] });
  return result;
}

// Prints a unified-style diff with 3 lines of context around each change.
// No-op when before === after.
export function printUnifiedDiff(label, before, after) {
  if (before === after) return;
  console.log(`--- ${label}`);
  console.log(`+++ ${label}`);

  const aLines = before.split("\n");
  const bLines = after.split("\n");
  const diff = lineDiff(aLines, bLines);

  const contextSize = 3;
  const inWindow = new Set();
  for (let k = 0; k < diff.length; k++) {
    if (diff[k].type !== "ctx") {
      for (let q = Math.max(0, k - contextSize); q <= Math.min(diff.length - 1, k + contextSize); q++) {
        inWindow.add(q);
      }
    }
  }

  let lastPrinted = -2;
  for (let k = 0; k < diff.length; k++) {
    if (!inWindow.has(k)) continue;
    if (k > lastPrinted + 1) console.log("@@");
    lastPrinted = k;
    const prefix = diff[k].type === "ctx" ? "  " : (diff[k].type === "del" ? "- " : "+ ");
    console.log(`${prefix}${diff[k].line}`);
  }
  console.log("");
}
