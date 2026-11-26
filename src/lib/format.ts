/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 82.5 -> "82.5", 80 -> "80", 2340 -> "2,340" */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n);
}

/** 0.0512 -> "+5%", -0.02 -> "−2%" */
export function formatDelta(ratio: number): string {
  const pct = Math.round(ratio * 100);
  return pct > 0 ? `+${pct}%` : pct < 0 ? `−${Math.abs(pct)}%` : '0%';
}
