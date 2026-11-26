// One metric over time (e.g. estimated 1RM per session). X is real time, so gaps
// between sessions show as gaps. The selected point gets a crosshair.
import { Circle, Line, Path } from 'react-native-svg';

import type { Point } from '@/lib/progress';
import { useColors } from '@/theme';

import { ChartFrame, type Geometry } from './chart-frame';

type Props = {
  points: Point[];
  selected: number;
  onSelect: (index: number) => void;
  formatTick: (v: number) => string;
  formatDate: (t: number) => string;
  accessibilityLabel: string;
};

const INSET = 8; // keeps end dots inside the plot

export function LineChart({ points, selected, onSelect, formatTick, formatDate, accessibilityLabel }: Props) {
  const c = useColors();
  const values = points.map((p) => p.value);
  const t0 = points[0]?.t ?? 0;
  const t1 = points[points.length - 1]?.t ?? 0;
  const xOf = (t: number, g: Geometry) =>
    t1 === t0 ? (g.left + g.right) / 2 : g.left + INSET + ((t - t0) / (t1 - t0)) * (g.right - g.left - 2 * INSET);

  return (
    <ChartFrame
      min={Math.min(...values)}
      max={Math.max(...values)}
      formatTick={formatTick}
      accessibilityLabel={accessibilityLabel}
      onSelect={onSelect}
      hitTest={(x, g) => {
        let best: number | null = null;
        let dist = Infinity;
        points.forEach((p, i) => {
          const d = Math.abs(xOf(p.t, g) - x);
          if (d < dist) [best, dist] = [i, d];
        });
        return best;
      }}
      xLabels={(g) =>
        // One label when there's one point, or every point falls on the same date.
        points.length === 1 || formatDate(t0) === formatDate(t1)
          ? [{ x: (g.left + g.right) / 2, label: formatDate(t0) }]
          : [
              { x: g.left + 40, label: formatDate(t0) },
              { x: g.right - 40, label: formatDate(t1) },
            ]
      }>
      {(g) => {
        const xy = points.map((p) => [xOf(p.t, g), g.y(p.value)] as const);
        const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
        const area = xy.length > 1 ? `${line} L${xy[xy.length - 1][0]},${g.bottom} L${xy[0][0]},${g.bottom} Z` : '';
        const sel = xy[selected];
        // Dots on every point only while they stay readable; the selected one always.
        const showDots = points.length <= 24;
        return (
          <>
            {area ? <Path d={area} fill={c.accent} fillOpacity={0.1} /> : null}
            {xy.length > 1 ? (
              <Path d={line} stroke={c.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {sel ? <Line x1={sel[0]} x2={sel[0]} y1={g.top} y2={g.bottom} stroke={c.textMuted} strokeWidth={1} /> : null}
            {xy.map(([x, y], i) =>
              showDots || i === selected ? (
                <Circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={i === selected ? 6 : 4}
                  fill={c.accent}
                  stroke={c.surface}
                  strokeWidth={2}
                />
              ) : null,
            )}
          </>
        );
      }}
    </ChartFrame>
  );
}
