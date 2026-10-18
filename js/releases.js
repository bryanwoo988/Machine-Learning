/* What changed since the version this reader last saw. */

export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const valid = v => /^\d+(\.\d+)*$/.test(String(v));

// Entries newer than `seen`, newest first. An unknown `seen` (a first visit,
// or corrupted storage) yields nothing: there is no "since" to report.
export function notesSince(list, seen) {
  if (!valid(seen)) return [];
  return list.filter(r => valid(r.v) && compareVersions(r.v, seen) > 0)
    .sort((x, y) => compareVersions(y.v, x.v));
}
