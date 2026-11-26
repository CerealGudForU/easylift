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

/** 3725 -> "1h 2m", 1500 -> "25m", 40 -> "40s" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** "Today, 18:05", "Yesterday, 07:30", "Mon 24 Nov", "24 Nov 2025" */
export function formatWorkoutDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' }) + `, ${time}`;
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** "now", "5m", "3h", "2d", then a short date ("24 Nov", "24 Nov 2025"). */
export function formatAgo(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const s = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * When a post went up, with how long ago: "Today, 18:05 · 4h ago",
 * "Mon, 07:30 · 3d ago", "24 Nov, 18:05" (no "ago" after a week).
 */
export function formatPosted(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86_400_000);
  const label =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Yesterday'
        : days < 7
          ? d.toLocaleDateString(undefined, { weekday: 'short' })
          : d.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
            });
  if (days >= 7) return `${label}, ${time}`;
  const ago = formatAgo(iso, now);
  return `${label}, ${time} · ${ago === 'now' ? 'just now' : `${ago} ago`}`;
}
