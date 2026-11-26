import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { radius, space, useColors } from '@/theme';

import { RestChip } from './rest-chip';
import { SetRow } from './set-row';
import { setLabels, type WorkoutExercise, type WorkoutSet } from './types';

type Props = {
  exercise: WorkoutExercise;
  onChangeSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  onToggleSet: (setId: string, fromPanel: boolean) => void;
  onPressSetType: (setId: string) => void;
  expandedSetId: string | null;
  onExpandSet: (setId: string) => void;
  onCollapseSet: () => void;
  onAddSet: () => void;
  onChangeRest: (seconds: number) => void;
  onPressMenu?: () => void;
  onDeleteSet?: (setId: string) => void;
};

export function ExerciseCard({
  exercise,
  onChangeSet,
  onToggleSet,
  onPressSetType,
  expandedSetId,
  onExpandSet,
  onCollapseSet,
  onAddSet,
  onChangeRest,
  onPressMenu,
  onDeleteSet,
}: Props) {
  const c = useColors();
  const labels = setLabels(exercise.sets);

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.header}>
        <Text variant="exercise" tone="accent" style={styles.flex} numberOfLines={2}>
          {exercise.name}
        </Text>
        <Pressable onPress={onPressMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exercise options">
          <Icon name="dots-vertical" size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.chips}>
        <RestChip seconds={exercise.restSeconds} onChange={onChangeRest} />
        <Chip label={exercise.equipment} muted />
      </View>

      <View style={styles.columns}>
        <Text variant="caption" tone="textMuted" style={styles.colSet}>
          SET
        </Text>
        <Text variant="caption" tone="textMuted" style={styles.flex}>
          PREVIOUS
        </Text>
        <Text variant="caption" tone="textMuted" style={styles.colField}>
          KG
        </Text>
        <Text variant="caption" tone="textMuted" style={styles.colField}>
          REPS
        </Text>
        <View style={styles.colCheck} />
      </View>

      <View style={styles.sets}>
        {exercise.sets.map((s, i) => (
          <SetRow
            key={s.id}
            set={s}
            label={labels[i]}
            expanded={s.id === expandedSetId}
            onExpand={() => onExpandSet(s.id)}
            onCollapse={onCollapseSet}
            onChange={(patch) => onChangeSet(s.id, patch)}
            onToggleDone={(fromPanel) => onToggleSet(s.id, fromPanel ?? false)}
            onPressType={() => onPressSetType(s.id)}
            onDelete={onDeleteSet ? () => onDeleteSet(s.id) : undefined}
          />
        ))}
      </View>

      <Button label="Add set" icon="plus" onPress={onAddSet} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  columns: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: -space.xs },
  colSet: { width: 36, textAlign: 'center' },
  colField: { width: 72, textAlign: 'center' },
  colCheck: { width: 48 },
  sets: { gap: space.xs },
});
