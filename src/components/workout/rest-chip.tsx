import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatClock } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { pressInNow, useHoldRepeat } from '@/lib/use-hold-repeat';
import { motion, radius, space, useColors } from '@/theme';

const STEP = 15;
const MAX = 600;
const AUTO_CLOSE_MS = 6000;

type Props = { seconds: number; onChange: (seconds: number) => void };

/**
 * Rest time chip. Tap it to open an inline −/+ stepper (15 s steps, hold to repeat).
 * Tap the time again to close; it also closes itself after 6 s without input. 0 = Off.
 */
export function RestChip({ seconds, onChange }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [lastTouch, setLastTouch] = useState(0);
  const valueRef = useRef(seconds);
  useEffect(() => {
    valueRef.current = seconds;
  }, [seconds]);

  // Auto-close after a pause; restarted on every interaction.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, lastTouch]);

  const { start, stop } = useHoldRepeat((dir) => {
    const next = Math.min(MAX, Math.max(0, valueRef.current + dir * STEP));
    if (next !== valueRef.current) {
      haptic.select();
      valueRef.current = next;
      onChange(next);
    }
    setLastTouch(Date.now());
  });

  const label = seconds > 0 ? formatClock(seconds) : 'Off';

  if (!open) {
    return (
      <Pressable
        onPress={() => {
          setOpen(true);
          setLastTouch(Date.now());
        }}
        accessibilityRole="button"
        accessibilityLabel={`Rest ${seconds > 0 ? formatClock(seconds) : 'off'}, adjust`}
        hitSlop={8}
        style={({ pressed }) => [styles.chip, { backgroundColor: c.field, opacity: pressed ? 0.75 : 1 }]}>
        <Icon name="timer-outline" size={14} color={c.text} />
        <Text variant="label">{seconds > 0 ? `Rest ${label}` : 'Rest off'}</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(motion.complete)}
      style={[styles.open, { backgroundColor: c.field, borderColor: c.accent }]}>
      <StepBtn icon="minus" label="Decrease rest by 15 seconds" onPressIn={() => start(-1)} onPressOut={stop} />
      <Pressable
        onPress={() => setOpen(false)}
        accessibilityRole="button"
        accessibilityLabel="Done adjusting rest"
        style={styles.center}>
        <Icon name="timer-outline" size={16} color={c.text} />
        <Text variant="stat" style={styles.time}>
          {label}
        </Text>
      </Pressable>
      <StepBtn icon="plus" label="Increase rest by 15 seconds" onPressIn={() => start(1)} onPressOut={stop} />
    </Animated.View>
  );
}

function StepBtn({
  icon,
  label,
  onPressIn,
  onPressOut,
}: {
  icon: 'plus' | 'minus';
  label: string;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      {...pressInNow}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.btn, pressed && { backgroundColor: c.border }]}>
      <Icon name={icon} size={20} color={c.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  open: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  btn: { width: 48, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.xs,
    minWidth: 72,
    justifyContent: 'center',
  },
  time: { minWidth: 40, textAlign: 'center' },
});
