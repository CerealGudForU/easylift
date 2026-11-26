import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { formatClock } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/use-now';
import { radius, size, space, useColors } from '@/theme';

// Rise a short distance and decelerate into place: no overshoot or bounce.
const ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 72 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
}).duration(260);

const EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: 72 }], easing: Easing.in(Easing.cubic) },
}).duration(180);

type Props = {
  /** Epoch ms when rest ends. Timestamp-based so it stays correct after the app is backgrounded. */
  endsAt: number;
  totalSeconds: number;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  /** Called once the bar has finished (3 s after reaching zero). */
  onDone: () => void;
};

export function RestTimerBar({ endsAt, totalSeconds, onAdjust, onSkip, onDone }: Props) {
  const c = useColors();
  const now = useNow(250);
  const finished = useRef(false);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const progress = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;

  useEffect(() => {
    if (remaining === 0 && !finished.current) {
      finished.current = true;
      haptic.heavy();
      const t = setTimeout(onDone, 3000);
      return () => clearTimeout(t);
    }
    if (remaining > 0) finished.current = false;
  }, [remaining, onDone]);

  return (
    <Animated.View
      entering={ENTER}
      exiting={EXIT}
      accessibilityLiveRegion="polite"
      style={[styles.bar, { backgroundColor: c.accent }]}>
      <View style={[styles.track, { backgroundColor: c.onAccent + '33' }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: c.onAccent }]} />
      </View>
      <View style={styles.row}>
        <BarButton label="−15" onPress={() => onAdjust(-15)} a11y="Subtract 15 seconds" />
        <View style={styles.center}>
          <Text variant="caption" style={{ color: c.onAccent }}>
            {remaining === 0 ? 'REST DONE' : 'REST'}
          </Text>
          <Text variant="display" style={{ color: c.onAccent, fontSize: 30, lineHeight: 34 }}>
            {formatClock(remaining)}
          </Text>
        </View>
        <BarButton label="+15" onPress={() => onAdjust(15)} a11y="Add 15 seconds" />
        <BarButton label="Skip" onPress={onSkip} a11y="Skip rest" />
      </View>
    </Animated.View>
  );
}

function BarButton({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.btn, { backgroundColor: c.onAccent + (pressed ? '33' : '1A') }]}>
      <Text variant="headline" style={{ color: c.onAccent }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.sm },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  center: { flex: 1, alignItems: 'center' },
  btn: {
    minWidth: size.touch + 8,
    height: size.touch,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
});
