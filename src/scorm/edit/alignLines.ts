// Map an edited text back onto the element's original text runs.
//
// A Lectora text element is a series of runs (differently formatted pieces — a
// paragraph, a list item, or an inline link like "Click [here] for help", which is
// three runs). The editor shows one run per line. After editing, each line has to
// go back into the right run: unchanged lines are matched to their own run (longest
// common subsequence), so deleting a middle line removes *that* run — not the last
// one — and an inline link stays on its own words. Changed lines take the unmatched
// runs between matches, in order; extra lines join the run before them.

const norm = (s: string): string => s.replace(/[\s ]+/g, ' ').trim();

/**
 * @param runs  the element's current run texts, in order
 * @param lines the edited text, one entry per line
 * @returns the new text for each run, or null where the run should be removed
 */
export function alignLines(runs: string[], lines: string[]): (string | null)[] {
  const n = runs.length;
  const m = lines.length;
  const out: (string | null)[] = new Array(n).fill(null);
  if (!n) return out;

  // longest common subsequence of (normalized) lines
  const a = runs.map(norm);
  const b = lines.map(norm);
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matches: Array<[number, number]> = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) matches.push([i++, j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  matches.push([n, m]); // sentinel closes the last gap

  let last = -1; // last run given text, for extra lines to join
  let pending: string[] = []; // extra lines before any run was given text
  const give = (run: number, text: string) => {
    out[run] = pending.length ? [...pending, text].join('\n') : text;
    pending = [];
    last = run;
  };
  let oi = 0;
  let li = 0;
  for (const [mi, mj] of matches) {
    // the gap before this match: pair changed lines with unmatched runs, in order
    const k = Math.min(mi - oi, mj - li);
    for (let t = 0; t < k; t++) give(oi + t, lines[li + t]);
    const extra = lines.slice(li + k, mj);
    if (extra.length) {
      if (last >= 0) out[last] = [out[last], ...extra].join('\n');
      else pending.push(...extra);
    }
    // runs oi+k … mi-1 had their lines deleted → stay null (removed)
    if (mi < n) give(mi, lines[mj]);
    oi = mi + 1;
    li = mj + 1;
  }
  if (pending.length) out[0] = pending.join('\n'); // every run deleted but text remains
  return out;
}
