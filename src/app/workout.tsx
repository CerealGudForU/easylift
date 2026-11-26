// Phase 2 component gallery: a live, local-only workout using the Ember components.
// Replaced by the real workout flow (with Supabase sync) in Phase 4.
import { useCallback, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { EnsureVisibleContext, type ViewRef } from '@/components/workout/ensure-visible';
import { ExerciseCard } from '@/components/workout/exercise-card';
import { RestTimerBar } from '@/components/workout/rest-timer-bar';
import type { SetType, WorkoutExercise, WorkoutSet } from '@/components/workout/types';
import { WorkoutHeader } from '@/components/workout/workout-header';
import { space, useColors } from '@/theme';

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'failure', 'drop'];
/** chosenId value meaning "no set open" (the user closed it). */
const COLLAPSED = '__collapsed__';
let nextId = 100;
const id = () => String(++nextId);

const DEMO: WorkoutExercise[] = [
  {
    id: 'bench',
    name: 'Bench press',
    equipment: 'Barbell',
    restSeconds: 90,
    sets: [
      { id: 'b0', type: 'warmup', weightKg: 40, reps: 10, done: true, previous: { weightKg: 40, reps: 10 } },
      { id: 'b1', type: 'normal', weightKg: 82.5, reps: 8, done: true, previous: { weightKg: 80, reps: 8 } },
      { id: 'b2', type: 'normal', weightKg: null, reps: null, done: false, previous: { weightKg: 80, reps: 8 } },
      { id: 'b3', type: 'normal', weightKg: null, reps: null, done: false, previous: { weightKg: 80, reps: 7 } },
    ],
  },
  {
    id: 'row',
    name: 'Bent over row',
    equipment: 'Barbell',
    restSeconds: 120,
    sets: [
      { id: 'r1', type: 'normal', weightKg: null, reps: null, done: false, previous: { weightKg: 70, reps: 10 } },
      { id: 'r2', type: 'normal', weightKg: null, reps: null, done: false, previous: { weightKg: 70, reps: 9 } },
    ],
  },
];

/** Rest state ending `seconds` from now. Kept outside render (it reads the clock). */
function restFor(seconds: number) {
  return { endsAt: Date.now() + seconds * 1000, total: seconds };
}

function nextUndoneAfter(exercises: WorkoutExercise[], setId: string): string | null {
  const all = exercises.flatMap((x) => x.sets);
  const i = all.findIndex((s) => s.id === setId);
  const after = all.slice(i + 1).find((s) => !s.done);
  const before = all.slice(0, i).find((s) => !s.done);
  return (after ?? before)?.id ?? null;
}

export default function WorkoutScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [startedAt] = useState(() => Date.now() - 24 * 60 * 1000);
  const [exercises, setExercises] = useState(DEMO);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);

  const updateSet = useCallback((exId: string, setId: string, fn: (s: WorkoutSet) => WorkoutSet) => {
    setExercises((xs) =>
      xs.map((x) => (x.id !== exId ? x : { ...x, sets: x.sets.map((s) => (s.id === setId ? fn(s) : s)) })),
    );
  }, []);

  // "vs last" is like-for-like: completed sets compared with the same sets last time,
  // so a half-finished workout isn't shown as a big drop.
  const { volume, doneSets, prevVolume } = useMemo(() => {
    let volume = 0;
    let doneSets = 0;
    let prevVolume = 0;
    for (const x of exercises)
      for (const s of x.sets)
        if (s.done) {
          doneSets++;
          volume += (s.weightKg ?? 0) * (s.reps ?? 0);
          if (s.previous) prevVolume += s.previous.weightKg * s.previous.reps;
        }
    return { volume, doneSets, prevVolume };
  }, [exercises]);

  // One set is open at a time. By default it's the next set to do; tapping another set opens
  // that one instead, and tapping the open set's top closes it (until the next set is completed).
  const [chosenId, setChosenId] = useState<string | null>(null);
  const nextUndoneId = useMemo(() => {
    for (const x of exercises) for (const s of x.sets) if (!s.done) return s.id;
    return null;
  }, [exercises]);
  const expandedId = chosenId === COLLAPSED ? null : (chosenId ?? nextUndoneId);

  const toggleSet = (x: WorkoutExercise, setId: string, fromPanel: boolean) => {
    const s = x.sets.find((it) => it.id === setId);
    if (!s) return;
    const completing = !s.done;
    updateSet(x.id, setId, (it) => ({
      ...it,
      done: completing,
      // Completing an empty set uses the placeholder (previous) values, like most loggers.
      weightKg: completing ? (it.weightKg ?? it.previous?.weightKg ?? null) : it.weightKg,
      reps: completing ? (it.reps ?? it.previous?.reps ?? null) : it.reps,
    }));
    if (fromPanel) {
      // From the open set: completing moves on to the next unfinished set *after* this one
      // (wrapping to skipped sets only at the end); un-completing keeps this one open to edit.
      setChosenId(completing ? nextUndoneAfter(exercises, setId) : setId);
    } else {
      // From a row's checkbox: never open anything. Pin whatever is open now (or nothing),
      // so the "next unfinished set" default can't pop a set open as a side effect.
      setChosenId(expandedId ?? COLLAPSED);
    }
    // Drop sets chain straight into the next set, so they don't start rest.
    if (completing && s.type !== 'drop' && x.restSeconds > 0) {
      setRest(restFor(x.restSeconds));
    }
  };

  // Scroll the open set fully into view, keeping clear of the rest bar at the bottom.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ViewRef>(null);
  const scrollY = useRef(0);
  const viewportH = useRef(0);
  const ensureVisible = useCallback((ref: RefObject<ViewRef | null>) => {
    const target = ref.current;
    const content = contentRef.current;
    if (!target || !content) return;
    target.measureLayout(content, (_x, y, _w, h) => {
      const top = y + space.lg; // content padding
      const bottomReserve = 150; // room for the rest bar
      const visibleBottom = scrollY.current + viewportH.current - bottomReserve;
      if (top + h > visibleBottom) {
        scrollRef.current?.scrollTo({ y: top + h - viewportH.current + bottomReserve, animated: true });
      } else if (top < scrollY.current) {
        scrollRef.current?.scrollTo({ y: Math.max(0, top - space.md), animated: true });
      }
    });
  }, []);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + space.sm, backgroundColor: c.bg, borderBottomColor: c.border },
        ]}>
        <WorkoutHeader
          startedAt={startedAt}
          exercises={exercises.length}
          sets={doneSets}
          deltaVsLast={prevVolume > 0 ? volume / prevVolume - 1 : null}
          onMinimize={() => {}}
          onFinish={() => {}}
        />
      </View>

      <EnsureVisibleContext.Provider value={ensureVisible}>
        <ScrollView
          ref={scrollRef}
          onLayout={(e) => (viewportH.current = e.nativeEvent.layout.height)}
          onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          contentContainerStyle={[styles.content, { paddingBottom: rest ? 140 : space.xxxl }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View ref={contentRef} style={styles.stack}>
            {exercises.map((x) => (
              <ExerciseCard
                key={x.id}
                exercise={x}
                onChangeSet={(setId, patch) => updateSet(x.id, setId, (s) => ({ ...s, ...patch }))}
                onToggleSet={(setId, fromPanel) => toggleSet(x, setId, fromPanel)}
                onChangeRest={(restSeconds) =>
                  setExercises((xs) => xs.map((it) => (it.id === x.id ? { ...it, restSeconds } : it)))
                }
                expandedSetId={expandedId}
                onExpandSet={setChosenId}
                onCollapseSet={() => setChosenId(COLLAPSED)}
                onPressSetType={(setId) =>
                  updateSet(x.id, setId, (s) => ({
                    ...s,
                    type: SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(s.type) + 1) % SET_TYPE_CYCLE.length],
                  }))
                }
                onAddSet={() =>
                  setExercises((xs) =>
                    xs.map((it) =>
                      it.id !== x.id
                        ? it
                        : {
                            ...it,
                            sets: [...it.sets, { id: id(), type: 'normal', weightKg: null, reps: null, done: false }],
                          },
                    ),
                  )
                }
              />
            ))}

            <Button label="Add exercise" icon="plus" variant="secondary" onPress={() => {}} />
            <Button label="Discard workout" variant="destructive" onPress={() => setExercises(DEMO)} />
            <Text variant="caption" tone="textMuted" style={styles.note}>
              Design preview. Tap a set to open it, its top to close it, its number to change its type, or the rest chip to adjust rest.
            </Text>
          </View>
        </ScrollView>
      </EnsureVisibleContext.Provider>

      {rest ? (
        <View style={[styles.restDock, { bottom: space.md }]}>
          <RestTimerBar
            endsAt={rest.endsAt}
            totalSeconds={rest.total}
            onAdjust={(d) =>
              setRest((r) =>
                r ? { endsAt: Math.max(Date.now(), r.endsAt + d * 1000), total: Math.max(1, r.total + d) } : r,
              )
            }
            onSkip={() => setRest(null)}
            onDone={() => setRest(null)}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  content: { padding: space.lg },
  stack: { gap: space.lg },
  restDock: { position: 'absolute', left: space.lg, right: space.lg },
  note: { textAlign: 'center' },
});
