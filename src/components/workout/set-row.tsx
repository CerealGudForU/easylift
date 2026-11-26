import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { motion, radius, size, space, useColors } from '@/theme';

import { useEnsureVisible, type ViewRef } from './ensure-visible';
import { Stepper } from './stepper';
import type { WorkoutSet } from './types';

export const WEIGHT_STEP_KG = 2.5;

type Props = {
  set: WorkoutSet;
  label: string;
  /** The set being worked on: shown open with steppers. */
  expanded: boolean;
  onExpand: () => void;
  /** Close the open set (tap on its top strip). */
  onCollapse: () => void;
  onChange: (patch: Partial<WorkoutSet>) => void;
  /**
   * `fromPanel`: toggled from the open set (moves on / stays open); otherwise from a row checkbox.
   * Leave it out when planning (routine editor): no checkbox and no Complete button.
   */
  onToggleDone?: (fromPanel?: boolean) => void;
  onPressType: () => void;
  /** Shows a delete button on the open set. */
  onDelete?: () => void;
};

export function SetRow(props: Props) {
  return props.expanded ? <ExpandedSet {...props} /> : <CollapsedSet {...props} />;
}

function useLabelColor(set: WorkoutSet) {
  const c = useColors();
  return set.type === 'warmup'
    ? c.setWarmup
    : set.type === 'failure'
      ? c.danger
      : set.type === 'drop'
        ? c.setDrop
        : c.text;
}

function CollapsedSet({ set, label, onExpand, onToggleDone, onPressType }: Props) {
  const c = useColors();
  const labelColor = useLabelColor(set);
  const progress = useSharedValue(set.done ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(set.done ? 1 : 0, { duration: motion.complete });
  }, [set.done, progress]);

  // Rows sit on the card surface, so fade from it to the success tint.
  const from = c.surface;
  const to = c.successBg;
  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [from, to]),
  }));

  const prev = set.previous;
  // Undone sets show last time's numbers as a muted hint until they're set.
  const suggest = prev ?? set.hint;
  const weight = set.weightKg ?? suggest?.weightKg;
  const reps = set.reps ?? suggest?.reps;
  const hinted = set.weightKg == null && set.reps == null;

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <Pressable
        onPress={onPressType}
        accessibilityRole="button"
        accessibilityLabel={`Set ${label}, change set type`}
        style={styles.labelCell}>
        <Text variant="numeric" style={{ color: labelColor, fontSize: 18 }}>
          {label}
        </Text>
      </Pressable>

      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel={`Edit set ${label}`}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.6 : 1 }]}>
        <Text variant="label" tone="textMuted" style={styles.prev} numberOfLines={1}>
          {prev ? `${formatNumber(prev.weightKg)} × ${prev.reps}` : '—'}
        </Text>
        <Text variant="numeric" tone={hinted && !set.done ? 'textMuted' : 'text'} style={styles.value}>
          {weight == null ? '–' : formatNumber(weight)}
        </Text>
        <Text variant="numeric" tone={hinted && !set.done ? 'textMuted' : 'text'} style={styles.valueReps}>
          {reps == null ? '–' : String(reps)}
        </Text>
      </Pressable>

      {onToggleDone ? <CheckButton done={set.done} label={label} onPress={() => onToggleDone(false)} /> : null}
    </Animated.View>
  );
}

function ExpandedSet({ set, label, onCollapse, onChange, onToggleDone, onPressType, onDelete }: Props) {
  const c = useColors();
  const ref = useRef<ViewRef>(null);
  const ensureVisible = useEnsureVisible();
  // When a set opens, make sure its Complete button isn't hidden (e.g. behind the rest bar).
  useEffect(() => {
    const t = setTimeout(() => ensureVisible(ref), 60);
    return () => clearTimeout(t);
  }, [ensureVisible]);
  const labelColor = useLabelColor(set);
  const prev = set.previous;
  const suggest = prev ?? set.hint;
  const weight = set.weightKg ?? suggest?.weightKg ?? 0;
  const reps = set.reps ?? suggest?.reps ?? 0;

  return (
    <Animated.View
      ref={ref}
      entering={FadeIn.duration(motion.complete)}
      style={[
        styles.panel,
        // A completed set stays green while open, like its collapsed row.
        set.done ? { borderColor: c.success, backgroundColor: c.successBg } : { borderColor: c.accent },
      ]}>
      {/* The top strip closes the set, except the set number (set type) and the delete button.
          They're siblings, not nested, so web doesn't get buttons inside a button. */}
      <View style={styles.panelHead}>
        <Pressable
          onPress={onCollapse}
          accessibilityRole="button"
          accessibilityLabel={`Close set ${label}`}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          onPress={onPressType}
          accessibilityRole="button"
          accessibilityLabel={`Set ${label}, change set type`}
          style={styles.labelCell}>
          <Text variant="numeric" style={{ color: labelColor, fontSize: 18 }}>
            {label}
          </Text>
        </Pressable>
        <Text variant="label" tone="textMuted" pointerEvents="none">
          {prev ? `Last time ${formatNumber(prev.weightKg)} × ${prev.reps}` : 'No previous'}
        </Text>
        <View style={styles.flex} pointerEvents="none" />
        {onDelete ? (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete set ${label}`}
            style={styles.delete}>
            <Icon name="trash-can-outline" size={20} color={c.textSecondary} />
          </Pressable>
        ) : null}
        <View pointerEvents="none">
          <Icon name="chevron-up" size={22} color={c.textSecondary} />
        </View>
      </View>

      <Stepper
        label="Kg"
        unit="kilograms"
        value={weight}
        step={WEIGHT_STEP_KG}
        decimal
        max={999}
        onChange={(weightKg) => onChange({ weightKg, reps })}
      />
      <Stepper
        label="Reps"
        unit="reps"
        value={reps}
        step={1}
        max={999}
        onChange={(r) => onChange({ reps: r, weightKg: weight })}
      />

      {!onToggleDone ? null : set.done ? (
        <Button label="Mark not done" variant="secondary" onPress={() => onToggleDone(true)} />
      ) : (
        <Pressable
          onPress={() => {
            haptic.success();
            onToggleDone(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Complete set ${label}`}
          style={({ pressed }) => [styles.complete, { backgroundColor: c.success, opacity: pressed ? 0.8 : 1 }]}>
          <Icon name="check-bold" size={20} color={c.onSuccess} />
          <Text variant="headline" style={{ color: c.onSuccess }}>
            Complete set
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function CheckButton({ done, label, onPress }: { done: boolean; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        if (!done) haptic.success();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`Complete set ${label}`}
      style={[styles.check, { backgroundColor: done ? c.success : c.field }]}>
      <Icon name="check-bold" size={20} color={done ? c.onSuccess : c.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: size.setRow,
    paddingHorizontal: space.xs,
    marginHorizontal: -space.xs,
    borderRadius: radius.control,
    borderCurve: 'continuous',
  },
  labelCell: { width: 36, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: size.touch },
  prev: { flex: 1 },
  delete: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  value: { width: 72, textAlign: 'center' },
  valueReps: { width: 72, textAlign: 'center' },
  check: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    borderWidth: 1.5,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    padding: space.md,
    gap: space.md,
    marginHorizontal: -space.xs,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.touch },
  flex: { flex: 1 },
  complete: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    height: size.touch + 4,
    borderRadius: radius.control,
    borderCurve: 'continuous',
  },
});
