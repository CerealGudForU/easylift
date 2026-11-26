// Every exercise someone has done (friends and yourself only, via RLS), most trained
// first. Tap one to see its chart over time.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseList } from '@/components/social/exercise-history';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useProfile, useProfileExercises } from '@/lib/social';
import { fonts, radius, size, space, useColors } from '@/theme';

export default function UserExercisesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile(id);
  const p = profile.data;
  const canSee = p?.status === 'friends' || p?.status === 'self';
  const q = useProfileExercises(id, canSee, 500);
  const [query, setQuery] = useState('');
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = (q.data ?? []).filter((x) => words.every((w) => x.name.toLowerCase().includes(w)));
  const title = p ? (p.status === 'self' ? 'Your exercises' : `${p.username}'s exercises`) : 'Exercises';

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenHeader title={title} />
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
          accessibilityLabel="Search exercises"
          style={[styles.input, { color: c.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Icon name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        {profile.isPending || (canSee && q.isPending) ? (
          <ActivityIndicator color={c.accent} style={styles.pad} />
        ) : profile.isError || q.isError ? (
          <View style={styles.pad}>
            <Text variant="body" tone="textSecondary">
              Can&apos;t load exercises. Check your connection.
            </Text>
            <Button label="Try again" onPress={() => (profile.isError ? profile.refetch() : q.refetch())} />
          </View>
        ) : !canSee ? (
          <Text variant="body" tone="textSecondary" style={styles.pad}>
            Only friends can see someone&apos;s exercises.
          </Text>
        ) : list.length ? (
          <>
            <Text variant="caption" tone="textMuted">
              {list.length} {list.length === 1 ? 'EXERCISE' : 'EXERCISES'} · MOST TRAINED FIRST
            </Text>
            <ExerciseList userId={id} exercises={list} />
          </>
        ) : (
          <Text variant="body" tone="textSecondary" style={styles.pad}>
            {words.length ? `No exercises match "${query.trim()}".` : 'No exercises logged yet.'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    minHeight: size.touch,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: space.sm, outlineWidth: 0 },
  content: { padding: space.lg, gap: space.sm, width: '100%', maxWidth: 600, alignSelf: 'center' },
  pad: { paddingVertical: space.xl, gap: space.md },
});
