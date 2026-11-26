// Shared chart scaffolding: measures its width, draws recessive gridlines with y-axis
// labels, and turns a tap or drag on the plot into "which point is this?".
// Marks follow the dataviz specs: 2px lines, ≥8px dots with a surface ring, a 10%
// area wash, bars ≤24px with a 4px rounded end, hairline solid gridlines.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { niceTicks } from '@/lib/progress';
import { space, useColors } from '@/theme';

export const PLOT_HEIGHT = 168;
export const GUTTER = 44; // y-axis labels
const TOP = 10;
const RIGHT = 10;
const BOTTOM = 10; // room for a dot (with its ring) sitting on the lowest gridline

export type Geometry = {
  width: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Value → y pixel. */
  y: (v: number) => number;
};

type Props = {
  /** Smallest and largest value plotted; the axis rounds outwards to clean ticks. */
  min: number;
  max: number;
  /** Start the axis at zero (bars must; lines usually shouldn't). */
  fromZero?: boolean;
  formatTick: (v: number) => string;
  /** X-axis labels, placed at pixel positions within the plot. */
  xLabels: (g: Geometry) => { x: number; label: string }[];
  /** Index of the mark nearest a touch at plot x. */
  hitTest: (x: number, g: Geometry) => number | null;
  onSelect: (index: number) => void;
  accessibilityLabel: string;
  children: (g: Geometry) => ReactNode;
};

export function ChartFrame({ min, max, fromZero, formatTick, xLabels, hitTest, onSelect, accessibilityLabel, children }: Props) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const ticks = niceTicks(fromZero ? 0 : min, max, 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const g: Geometry = {
    width,
    left: GUTTER,
    right: Math.max(GUTTER + 1, width - RIGHT),
    top: TOP,
    bottom: TOP + PLOT_HEIGHT,
    y: (v) => TOP + PLOT_HEIGHT - ((v - lo) / (hi - lo || 1)) * PLOT_HEIGHT,
  };

  const touch = (e: GestureResponderEvent) => {
    const i = hitTest(e.nativeEvent.locationX, g);
    if (i != null) onSelect(i);
  };

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <View
        style={{ height: TOP + PLOT_HEIGHT + BOTTOM }}
        // Tap or drag to inspect; a vertical scroll still takes over the gesture.
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => true}
        onResponderGrant={touch}
        onResponderMove={touch}>
        {width > 0 ? (
          <>
            <Svg width={width} height={TOP + PLOT_HEIGHT + BOTTOM}>
              {ticks.map((t) => (
                <Line key={t} x1={g.left} x2={g.right} y1={g.y(t)} y2={g.y(t)} stroke={c.border} strokeWidth={1} />
              ))}
              {children(g)}
            </Svg>
            {ticks.map((t) => (
              <Text
                key={t}
                variant="caption"
                tone="textMuted"
                numberOfLines={1}
                style={[styles.yLabel, { top: g.y(t) - 8 }]}>
                {formatTick(t)}
              </Text>
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.xAxis}>
        {width > 0
          ? xLabels(g).map((l, i) => (
              <Text
                key={i}
                variant="caption"
                tone="textMuted"
                numberOfLines={1}
                style={[styles.xLabel, { left: Math.min(Math.max(0, l.x - 40), width - 80) }]}>
                {l.label}
              </Text>
            ))
          : null}
      </View>
    </View>
  );
}

/** Compact axis numbers: 950 → "950", 12500 → "12.5K". */
export function compact(n: number): string {
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 100) / 10}K`;
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(n);
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, width: GUTTER - space.sm, textAlign: 'right', fontVariant: ['tabular-nums'] },
  xAxis: { height: 20, marginTop: space.xs },
  xLabel: { position: 'absolute', width: 80, textAlign: 'center' },
});
