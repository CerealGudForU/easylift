// Share card: one of your workouts as an image (Android) or as text (web), for
// sending anywhere outside EasyLift. Built from the device copy, so it works offline.
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoCarousel } from '@/components/social/workout-photo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { exercisesOf, newBests, setsOf, useWorkoutData, workoutStats } from '@/lib/data/queries';
import { formatDuration, formatNumber, formatWorkoutDate } from '@/lib/format';
import { useWorkoutPhotos } from '@/lib/photos';
import { e1rm } from '@/lib/progress';
import { palette, radius, space } from '@/theme';

// The card is always the dark Ember look, whatever the app theme: it's an image people post.
const k = palette.dark;
const MAX_EXERCISES = 6;

export default function ShareScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useWorkoutData();
  const photos = useWorkoutPhotos(id).data ?? [];
  const card = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const view = useMemo(() => {
    const w = data.w.get(id);
    if (!w || w.deleted_at || !w.ended_at) return null;
    const exercises = exercisesOf(id).map((we) => {
      const sets = setsOf(we.id).filter((s) => s.completed_at && s.set_type !== 'warmup');
      // "Best set" = highest estimated 1RM; bodyweight sets fall back to most reps.
      const best = [...sets].sort(
        (a, b) => e1rm(b.weight_kg ?? 0, b.reps ?? 0) - e1rm(a.weight_kg ?? 0, a.reps ?? 0) || (b.reps ?? 0) - (a.reps ?? 0),
      )[0];
      return { id: we.id, name: data.e.get(we.exercise_id)?.name ?? 'Exercise', sets: sets.length, best };
    });
    return { workout: w, stats: workoutStats(id), records: newBests(id).length, exercises };
  }, [data, id]);

  if (!view) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Share" />
        <Text variant="body" tone="textSecondary" style={styles.missing}>
          Only finished workouts can be shared.
        </Text>
      </View>
    );
  }
  const { workout, stats, records, exercises } = view;
  const setText = (b: (typeof exercises)[number]['best']) =>
    !b ? '' : b.weight_kg ? `${formatNumber(b.weight_kg)} kg × ${b.reps ?? 0}` : `${b.reps ?? 0} reps`;

  const asText = () =>
    [
      `${workout.title} · ${formatWorkoutDate(workout.started_at)}`,
      `${formatDuration(stats.durationS)} · ${formatNumber(Math.round(stats.volumeKg))} kg · ${stats.sets} sets`,
      ...exercises.map((x) => `${x.sets} × ${x.name}${x.best ? ` (best ${setText(x.best)})` : ''}`),
      records ? `${records} new personal record${records === 1 ? '' : 's'}` : '',
      'Logged with EasyLift',
    ]
      .filter(Boolean)
      .join('\n');

  const share = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share workout' });
      } else {
        await Share.share({ message: asText() });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Share" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }]}>
        <View
          ref={card}
          collapsable={false}
          style={styles.card}
          accessible
          accessibilityLabel={`Share card. ${asText()}`}>
          <View style={styles.brand}>
            <Icon name="dumbbell" size={18} color={k.accent} />
            <Text variant="caption" style={{ color: k.accent }}>
              EASYLIFT
            </Text>
          </View>
          <View>
            <Text variant="display" style={{ color: k.text }} numberOfLines={2}>
              {workout.title}
            </Text>
            <Text variant="label" style={{ color: k.textMuted }}>
              {formatWorkoutDate(workout.started_at)}
            </Text>
          </View>

          {photos.length ? <PhotoCarousel photos={photos.slice(0, 1)} label="Workout photo" /> : null}

          <View style={styles.stats}>
            <CardStat label="Time" value={formatDuration(stats.durationS)} />
            <CardStat label="Volume" value={`${formatNumber(Math.round(stats.volumeKg))} kg`} />
            <CardStat label="Sets" value={String(stats.sets)} />
          </View>

          <View style={[styles.list, { borderTopColor: k.border }]}>
            {exercises.slice(0, MAX_EXERCISES).map((x) => (
              <View key={x.id} style={styles.exRow}>
                <Text variant="body" numberOfLines={1} style={[styles.flex, { color: k.text }]}>
                  <Text variant="body" style={{ color: k.textMuted }}>
                    {x.sets} ×{' '}
                  </Text>
                  {x.name}
                </Text>
                <Text variant="stat" style={{ color: k.textSecondary }}>
                  {setText(x.best)}
                </Text>
              </View>
            ))}
            {exercises.length > MAX_EXERCISES ? (
              <Text variant="label" style={{ color: k.textMuted }}>
                +{exercises.length - MAX_EXERCISES} more
              </Text>
            ) : null}
          </View>

          {records ? (
            <View style={[styles.records, { backgroundColor: k.surfaceRaised }]}>
              <Icon name="trophy" size={20} color={k.accent} />
              <Text variant="headline" style={{ color: k.text }}>
                {records} new personal record{records === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
        </View>

        <Button label="Share" icon="share-variant" variant="primary" loading={busy} onPress={share} style={styles.button} />
        {failed ? (
          <Text variant="label" tone="danger" style={styles.center}>
            Couldn&apos;t share. Try again.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" style={{ color: k.textMuted }}>
        {label.toUpperCase()}
      </Text>
      <Text variant="numeric" style={{ color: k.text }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  missing: { padding: space.lg },
  content: { padding: space.lg, gap: space.lg },
  card: {
    backgroundColor: k.surface,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    padding: space.xl,
    gap: space.lg,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stats: { flexDirection: 'row', gap: space.xxl },
  stat: { gap: 2 },
  list: { gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.lg },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  records: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.control },
  button: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  center: { textAlign: 'center' },
});
