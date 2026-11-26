// Pick one or more exercises from the library, for a workout or the routine editor.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { addExercisesToWorkout } from '@/lib/data/actions';
import { useExercises } from '@/lib/data/queries';
import { equipmentLabel, EQUIPMENT_OPTIONS, muscleLabel, MUSCLE_OPTIONS } from '@/lib/exercise-labels';
import { goBack } from '@/lib/nav';
import { pickResult } from '@/lib/pick-result';
import { fonts, radius, size, space, useColors } from '@/theme';

export default function PickExercisesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ for: 'workout' | 'routine'; id?: string; new?: string }>();
  const all = useExercises();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // A custom exercise created from here comes back already selected.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(all.map((x) => x.id));
      return;
    }
    const fresh = all.filter((x) => !seen.current!.has(x.id) && x.owner_id);
    for (const x of all) seen.current.add(x.id);
    if (fresh.length) setSelected((s) => [...s, ...fresh.map((x) => x.id)]);
  }, [all]);

  const list = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((x) => {
      if (muscle && x.primary_muscle !== muscle) return false;
      if (equipment && (x.equipment === 'kettlebells' ? 'kettlebell' : x.equipment) !== equipment) return false;
      const hay = `${x.name} ${equipmentLabel(x.equipment)} ${muscleLabel(x.primary_muscle)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [all, query, muscle, equipment]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const add = () => {
    if (params.for === 'workout' && params.id) addExercisesToWorkout(params.id, selected);
    else pickResult.set(selected);
    // "New routine" starts here; the editor opens with the picks, in this screen's place.
    if (params.for === 'routine' && params.new === '1') router.replace({ pathname: '/routine/[id]', params: { id: 'new' } });
    else goBack();
  };

  return (
    // Keyboard-avoiding so the Add button stays above the keyboard while searching.
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="title" style={styles.flex}>
          Add exercises
        </Text>
        <Button label="New" icon="plus" compact onPress={() => router.push('/exercises/new')} />
      </View>

      <View style={[styles.search, { backgroundColor: c.field }]}>
        <Icon name="magnify" size={20} color={c.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={c.textMuted}
          selectionColor={c.accent}
          cursorColor={c.accent}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search exercises"
          style={[styles.searchInput, { color: c.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Icon name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FilterRow options={MUSCLE_OPTIONS} value={muscle} onChange={setMuscle} label={muscleLabel} allLabel="All muscles" />
      <FilterRow
        options={EQUIPMENT_OPTIONS}
        value={equipment}
        onChange={setEquipment}
        label={equipmentLabel}
        allLabel="All equipment"
      />

      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: space.lg }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="body" tone="textSecondary" style={styles.center}>
              No exercises match. Try another search, or create your own.
            </Text>
            <Button label="Create exercise" icon="plus" onPress={() => router.push('/exercises/new')} />
          </View>
        }
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.name}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : 'transparent' }]}>
              <View style={[styles.avatar, { backgroundColor: on ? c.accent : c.field }]}>
                {on ? (
                  <Icon name="check-bold" size={20} color={c.onAccent} />
                ) : (
                  <Text variant="headline" tone="textSecondary">
                    {item.name.charAt(0)}
                  </Text>
                )}
              </View>
              <View style={styles.flex}>
                <Text variant="headline" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text variant="label" tone="textMuted" numberOfLines={1}>
                  {muscleLabel(item.primary_muscle)} · {equipmentLabel(item.equipment)}
                  {item.owner_id ? ' · Custom' : ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      {selected.length ? (
        <View style={[styles.dock, { paddingBottom: space.md + insets.bottom }]}>
          <Button
            label={`Add ${selected.length} ${selected.length === 1 ? 'exercise' : 'exercises'}`}
            variant="primary"
            onPress={add}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function FilterRow({
  options,
  value,
  onChange,
  label,
  allLabel,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  label: (v: string) => string;
  allLabel: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
      style={styles.filterScroll}
      keyboardShouldPersistTaps="handled">
      <Chip label={allLabel} selected={value === null} onPress={() => onChange(null)} />
      {options.map((o) => (
        <Chip key={o} label={label(o)} selected={value === o} onPress={() => onChange(value === o ? null : o)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: size.touch },
  flex: { flex: 1 },
  search: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    minHeight: size.touch,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: space.sm, outlineWidth: 0 },
  filterScroll: { flexGrow: 0, flexShrink: 0, marginTop: space.sm },
  filters: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xs, alignItems: 'center', minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 64 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xl, gap: space.lg },
  center: { textAlign: 'center' },
  dock: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
