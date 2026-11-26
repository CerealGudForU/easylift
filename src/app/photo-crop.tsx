// Crop one or more workout photos to any ratio. Works on the original image, so a
// photo can be cropped again later with nothing lost. Drag a corner to resize, drag
// inside to move, or pick a ratio. With several photos it steps through them.
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { goBack } from '@/lib/nav';
import { cropOf, setPhotoCrop, usePhotoUrl, useWorkoutPhotos, type Crop, type Photo } from '@/lib/photos';
import { size, space, useColors } from '@/theme';

type Rect = { l: number; t: number; r: number; b: number }; // display pixels
type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'move';
const MIN = 48; // smallest crop side on screen
const RATIOS: { label: string; value: number | 'free' | 'original' }[] = [
  { label: 'Free', value: 'free' },
  { label: 'Original', value: 'original' },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '16:9', value: 16 / 9 },
];

export default function PhotoCropScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { workout, ids } = useLocalSearchParams<{ workout: string; ids: string }>();
  const order = useMemo(() => (ids ?? '').split(',').filter(Boolean), [ids]);
  const photos = useWorkoutPhotos(workout);
  const [step, setStep] = useState(0);
  const photo = photos.data?.find((p) => p.id === order[step]);

  const next = () => (step + 1 < order.length ? setStep(step + 1) : goBack());

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.top}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={26} color="#FAFAFA" />
        </Pressable>
        <Text variant="headline" style={[styles.flex, styles.title]}>
          {order.length > 1 ? `Crop photo ${step + 1} of ${order.length}` : 'Crop photo'}
        </Text>
        <View style={{ width: 26 }} />
      </View>
      {photo ? (
        <Cropper key={photo.id} photo={photo} workoutId={workout} last={step + 1 >= order.length} onDone={next} />
      ) : (
        <View style={styles.center}>
          {photos.isError ? (
            <Text variant="body" style={{ color: c.textMuted }}>
              Can&apos;t load the photo. Check your connection.
            </Text>
          ) : photos.isPending ? (
            <ActivityIndicator color="#FAFAFA" />
          ) : (
            <Text variant="body" style={{ color: c.textMuted }}>
              This photo was removed.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function Cropper({ photo, workoutId, last, onDone }: { photo: Photo; workoutId: string; last: boolean; onDone: () => void }) {
  const c = useColors();
  const url = usePhotoUrl(photo.path);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState<number | 'free' | 'original'>('free');
  // The crop as fractions of the original (what's saved), starting from the saved one.
  const [crop, setCrop] = useState<Crop>(() => cropOf(photo));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // The original, fitted inside the available area.
  const scale = area.w ? Math.min(area.w / photo.width, area.h / photo.height) : 0;
  const disp = { w: photo.width * scale, h: photo.height * scale };

  const rect: Rect | null = disp.w
    ? { l: crop.x * disp.w, t: crop.y * disp.h, r: (crop.x + crop.w) * disp.w, b: (crop.y + crop.h) * disp.h }
    : null;
  const setRect = (r: Rect) =>
    setCrop({ x: r.l / disp.w, y: r.t / disp.h, w: (r.r - r.l) / disp.w, h: (r.b - r.t) / disp.h });

  const locked = ratio === 'free' ? null : ratio === 'original' ? photo.width / photo.height : ratio;

  /** The biggest centred rectangle of ratio `r` (width ÷ height). */
  const centred = (r: number): Rect => {
    let w = disp.w;
    let h = w / r;
    if (h > disp.h) {
      h = disp.h;
      w = h * r;
    }
    const l = (disp.w - w) / 2;
    const t = (disp.h - h) / 2;
    return { l, t, r: l + w, b: t + h };
  };

  const pickRatio = (v: (typeof RATIOS)[number]['value']) => {
    setRatio(v);
    if (v === 'free') return;
    setRect(centred(v === 'original' ? photo.width / photo.height : v));
  };

  // The rectangle when the current drag began (only touched in touch handlers).
  const startRect = useRef<Rect | null>(null);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    const k: Crop = { x: clamp01(crop.x), y: clamp01(crop.y), w: clamp01(crop.w), h: clamp01(crop.h) };
    k.w = Math.min(k.w, 1 - k.x);
    k.h = Math.min(k.h, 1 - k.y);
    try {
      await setPhotoCrop(workoutId, photo.id, k);
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.area} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {url && disp.w ? (
          <View style={{ width: disp.w, height: disp.h }}>
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="fill" />
            {rect ? (
              <>
                {/* Dim everything outside the crop. */}
                <View style={[styles.shade, { left: 0, top: 0, width: disp.w, height: rect.t }]} />
                <View style={[styles.shade, { left: 0, top: rect.b, width: disp.w, height: disp.h - rect.b }]} />
                <View style={[styles.shade, { left: 0, top: rect.t, width: rect.l, height: rect.b - rect.t }]} />
                <View style={[styles.shade, { left: rect.r, top: rect.t, width: disp.w - rect.r, height: rect.b - rect.t }]} />
                <DragArea
                  label="Crop area. Drag to move"
                  onStart={() => {
                    startRect.current = rect;
                  }}
                  onDrag={(dx, dy) => {
                    if (startRect.current) setRect(drag(startRect.current, 'move', dx, dy, disp, locked));
                  }}
                  style={[styles.frame, { left: rect.l, top: rect.t, width: rect.r - rect.l, height: rect.b - rect.t }]}>
                  {/* Rule-of-thirds guides. */}
                  <View style={[styles.guideV, { left: '33.3%' }]} />
                  <View style={[styles.guideV, { left: '66.6%' }]} />
                  <View style={[styles.guideH, { top: '33.3%' }]} />
                  <View style={[styles.guideH, { top: '66.6%' }]} />
                </DragArea>
                {(['tl', 'tr', 'bl', 'br'] as const).map((h) => (
                  <DragArea
                    key={h}
                    label="Crop corner. Drag to resize"
                    onStart={() => {
                      startRect.current = rect;
                    }}
                    onDrag={(dx, dy) => {
                      if (startRect.current) setRect(drag(startRect.current, h, dx, dy, disp, locked));
                    }}
                    style={[
                      styles.handle,
                      { left: (h[1] === 'l' ? rect.l : rect.r) - HANDLE / 2, top: (h[0] === 't' ? rect.t : rect.b) - HANDLE / 2 },
                    ]}>
                    <View style={[styles.corner, cornerStyle(h)]} />
                  </DragArea>
                ))}
              </>
            ) : null}
          </View>
        ) : (
          <ActivityIndicator color="#FAFAFA" />
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratios} style={styles.ratioRow}>
        {RATIOS.map((r) => (
          <Chip key={r.label} label={r.label} selected={ratio === r.value} onPress={() => pickRatio(r.value)} />
        ))}
      </ScrollView>
      {failed ? (
        <Text variant="label" style={[styles.error, { color: c.danger }]}>
          Couldn&apos;t save the crop. Check your connection.
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Reset"
          icon="restore"
          onPress={() => {
            setRatio('free');
            setCrop({ x: 0, y: 0, w: 1, h: 1 });
          }}
          style={styles.flex}
        />
        <Button label={last ? 'Crop' : 'Crop & next'} icon="crop" variant="primary" loading={saving} onPress={save} style={styles.flex} />
      </View>
    </>
  );
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** A view you drag: reports how far the finger has moved since it went down. */
function DragArea({
  label,
  onStart,
  onDrag,
  style,
  children,
}: {
  label: string;
  onStart: () => void;
  onDrag: (dx: number, dy: number) => void;
  style: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={style}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        origin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        onStart();
      }}
      onResponderMove={(e) => {
        const o = origin.current;
        if (o) onDrag(e.nativeEvent.pageX - o.x, e.nativeEvent.pageY - o.y);
      }}
      onResponderRelease={() => {
        origin.current = null;
      }}
      onResponderTerminate={() => {
        origin.current = null;
      }}>
      {children}
    </View>
  );
}

/** New rectangle after dragging handle `h` by (dx, dy), kept inside the image and at least MIN. */
function drag(s: Rect, h: Handle, dx: number, dy: number, d: { w: number; h: number }, locked: number | null): Rect {
  if (h === 'move') {
    const w = s.r - s.l;
    const ht = s.b - s.t;
    const l = Math.min(Math.max(0, s.l + dx), d.w - w);
    const t = Math.min(Math.max(0, s.t + dy), d.h - ht);
    return { l, t, r: l + w, b: t + ht };
  }
  // The opposite corner stays put.
  const left = h[1] === 'l';
  const top = h[0] === 't';
  const ax = left ? s.r : s.l;
  const ay = top ? s.b : s.t;
  let x = Math.min(Math.max(0, (left ? s.l : s.r) + dx), d.w);
  let y = Math.min(Math.max(0, (top ? s.t : s.b) + dy), d.h);
  let w = Math.max(MIN, Math.abs(ax - x));
  let ht = Math.max(MIN, Math.abs(ay - y));
  if (locked) {
    // Follow the larger movement, then fit inside the room available from the anchor.
    if (w / ht > locked) ht = w / locked;
    else w = ht * locked;
    const roomW = left ? ax : d.w - ax;
    const roomH = top ? ay : d.h - ay;
    const k = Math.min(1, roomW / w, roomH / ht);
    w *= k;
    ht *= k;
  } else {
    w = Math.min(w, left ? ax : d.w - ax);
    ht = Math.min(ht, top ? ay : d.h - ay);
  }
  x = left ? ax - w : ax + w;
  y = top ? ay - ht : ay + ht;
  return { l: Math.min(ax, x), t: Math.min(ay, y), r: Math.max(ax, x), b: Math.max(ay, y) };
}

const HANDLE = 44;
const ARM = 22;
const cornerStyle = (h: 'tl' | 'tr' | 'bl' | 'br') => ({
  [h[0] === 't' ? 'top' : 'bottom']: HANDLE / 2 - 3,
  [h[1] === 'l' ? 'left' : 'right']: HANDLE / 2 - 3,
  [h[0] === 't' ? 'borderTopWidth' : 'borderBottomWidth']: 4,
  [h[1] === 'l' ? 'borderLeftWidth' : 'borderRightWidth']: 4,
});

const styles = StyleSheet.create({
  // Always dark: photos are judged best on black, whatever the app theme.
  screen: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: size.touch },
  title: { color: '#FAFAFA', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', margin: space.lg },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  frame: { position: 'absolute', borderWidth: 1.5, borderColor: '#FAFAFA' },
  guideV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  guideH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  handle: { position: 'absolute', width: HANDLE, height: HANDLE },
  corner: { position: 'absolute', width: ARM, height: ARM, borderColor: '#FAFAFA' },
  ratioRow: { flexGrow: 0 },
  ratios: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  error: { textAlign: 'center', marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
});
