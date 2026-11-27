// Create a custom exercise (it syncs, and friends see its name on your workouts).
// Only the name is required; tap a selected chip again to clear it.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { createExercise } from '@/lib/data/actions';
import { useExercises } from '@/lib/data/queries';
import { equipmentLabel, EQUIPMENT_OPTIONS, muscleLabel, MUSCLE_OPTIONS } from '@/lib/exercise-labels';
import { size, space, useColors } from '@/theme';

export default function NewExerciseScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const all = useExercises();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  const clean = name.trim();
  const duplicate = all.some(
    (x) => x.name.toLowerCase() === clean.toLowerCase() && (x.equipment ?? null) === equipment,
  );
  // Only the name is required; main muscle and equipment are optional.
  const ready = clean.length > 0 && !duplicate;

  const save = () => {
    if (!ready) return;
    createExercise({ name: clean, primaryMuscle: muscle, equipment });
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Icon name="close" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="title" style={styles.flex}>
          New exercise
        </Text>
        <Button label="Save" variant="primary" compact disabled={!ready} onPress={save} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Landmine Press"
          autoCapitalize="words"
          maxLength={80}
          autoFocus
          returnKeyType="done"
          hint={duplicate ? { text: 'You already have an exercise with this name and equipment.', tone: 'danger' } : null}
        />
        <Section title="Main muscle (optional)">
          {MUSCLE_OPTIONS.map((m) => (
            <Chip key={m} label={muscleLabel(m)} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </Section>
        <Section title="Equipment (optional)">
          {EQUIPMENT_OPTIONS.map((e) => (
            <Chip key={e} label={equipmentLabel(e)} selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" tone="textSecondary">
        {title.toUpperCase()}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: size.touch },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.xl },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
