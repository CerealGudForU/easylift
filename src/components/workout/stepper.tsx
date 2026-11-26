import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useHoldRepeat } from '@/lib/use-hold-repeat';
import { radius, size, space, type as typeScale, useColors } from '@/theme';

type Props = {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  decimal?: boolean;
  unit: string;
  onChange: (v: number) => void;
};

/** Big −/+ stepper. Press and hold repeats; tap the number to type. */
export function Stepper({ label, value, step, min = 0, max = 9999, decimal, unit, onChange }: Props) {
  const c = useColors();
  const [draft, setDraftState] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setDraft = (d: string | null) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const { start: startHold, stop } = useHoldRepeat((dir) => {
    // Pressing −/+ ends any typing, so the field shows the stepped value, not the typed draft.
    if (draftRef.current !== null) {
      inputRef.current?.blur();
      draftRef.current = null;
      setDraft(null);
    }
    // Steps land on the step grid: with 2.5 kg, 81 → +  gives 82.5 and 81 → − gives 80,
    // so ± only ever produces …0, …2.5, …5 or …7.5. Values already on the grid move a full step.
    const v = valueRef.current;
    const onGrid = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    const target = onGrid ? v + dir * step : (dir > 0 ? Math.ceil(v / step) : Math.floor(v / step)) * step;
    const next = Math.min(max, Math.max(min, round(target)));
    if (next !== valueRef.current) {
      haptic.select();
      valueRef.current = next;
      onChange(next);
    }
  });

  const a11y = (dir: 1 | -1) => `${dir > 0 ? 'Increase' : 'Decrease'} ${label} by ${formatNumber(step)}`;

  return (
    <View style={styles.row}>
      <Text variant="caption" tone="textSecondary" style={styles.label}>
        {label.toUpperCase()}
      </Text>
      <StepButton dir={-1} onPressIn={() => startHold(-1)} onPressOut={stop} label={a11y(-1)} />
      <View style={styles.center}>
        <TextInput
          ref={inputRef}
          value={draft ?? formatNumber(value)}
          onFocus={() => {
            setDraft(String(value));
            // selectTextOnFocus doesn't stick on web (the mouse-up after the tap moves the caret), so select
            // after that render; typing then replaces the old number instead of appending to it.
            if (process.env.EXPO_OS === 'web') {
              setTimeout(() => (inputRef.current as unknown as HTMLInputElement | null)?.select?.(), 120);
            }
          }}
          onBlur={() => setDraft(null)}
          onChangeText={(t) => {
            const clean = t.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
            setDraft(clean);
            const n = Number(clean);
            if (clean !== '' && !Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          accessibilityLabel={`${label} in ${unit}`}
          style={[
            typeScale.display,
            styles.input,
            { color: c.text, borderColor: draft !== null ? c.accent : 'transparent' },
          ]}
        />
      </View>
      <StepButton dir={1} onPressIn={() => startHold(1)} onPressOut={stop} label={a11y(1)} />
    </View>
  );
}

function StepButton({
  dir,
  label,
  onPressIn,
  onPressOut,
}: {
  dir: 1 | -1;
  label: string;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.btn, { backgroundColor: pressed ? c.border : c.field }]}>
      <Icon name={dir > 0 ? 'plus' : 'minus'} size={26} color={c.accent} />
    </Pressable>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { width: 44 },
  center: { flex: 1, alignItems: 'center' },
  input: {
    minWidth: 96,
    textAlign: 'center',
    paddingVertical: 0,
    borderWidth: 2,
    borderRadius: radius.control,
    borderCurve: 'continuous',
  },
  btn: {
    width: 64,
    height: size.touch + 8,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
