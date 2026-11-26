// Columns from a zero baseline (e.g. volume per week). Bars are at most 24px wide
// with a 4px rounded top; the selected bar is full strength, the rest a step back.
import { Path } from 'react-native-svg';

import { useColors } from '@/theme';

import { ChartFrame, type Geometry } from './chart-frame';

type Props = {
  values: number[];
  labels: string[];
  selected: number;
  onSelect: (index: number) => void;
  formatTick: (v: number) => string;
  accessibilityLabel: string;
  /** Which bars get an x-axis label (others are left to the readout). */
  labelEvery?: number;
};

const MAX_BAR = 24;
const R = 4;

/** A column with rounded top corners and a square base. */
function column(x: number, w: number, top: number, base: number): string {
  const h = base - top;
  if (h <= 0) return '';
  const r = Math.min(R, w / 2, h);
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

export function BarChart({ values, labels, selected, onSelect, formatTick, accessibilityLabel, labelEvery = 1 }: Props) {
  const c = useColors();
  const n = values.length;
  const band = (g: Geometry) => (g.right - g.left) / Math.max(1, n);

  return (
    <ChartFrame
      min={0}
      max={Math.max(1, ...values)}
      fromZero
      formatTick={formatTick}
      accessibilityLabel={accessibilityLabel}
      onSelect={onSelect}
      hitTest={(x, g) => {
        const i = Math.floor((x - g.left) / band(g));
        return i >= 0 && i < n ? i : null;
      }}
      xLabels={(g) =>
        labels
          .map((label, i) => ({ x: g.left + band(g) * (i + 0.5), label, i }))
          .filter(({ i }) => (n - 1 - i) % labelEvery === 0)
      }>
      {(g) => {
        const b = band(g);
        const w = Math.max(4, Math.min(MAX_BAR, b * 0.6));
        return values.map((v, i) => (
          <Path
            key={i}
            d={column(g.left + b * i + (b - w) / 2, w, g.y(v), g.bottom)}
            fill={c.accent}
            fillOpacity={i === selected ? 1 : 0.45}
          />
        ));
      }}
    </ChartFrame>
  );
}
