// Workout photos: a cropped photo, the swipeable carousel the feed shows, and the
// summary's strip for adding, re-cropping and removing photos.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  addWorkoutPhotos,
  croppedRatio,
  MAX_PHOTOS,
  removeWorkoutPhoto,
  usePhotoUrl,
  useWorkoutPhotos,
  type Photo,
  type PhotoSource,
} from '@/lib/photos';
import { radius, size, space, useColors } from '@/theme';

/**
 * A photo with its crop applied. Given only `width`, the box takes the cropped photo's
 * shape. Given `width` and `height`, the photo covers the box: scaled (never stretched)
 * until it fills it, centred, with any overflow cut off.
 */
export function CroppedImage({ photo, width, height }: { photo: Photo; width: number; height?: number }) {
  const c = useColors();
  const url = usePhotoUrl(photo.path);
  const ratio = croppedRatio(photo);
  const h = height ?? width / ratio;
  // Size of the cropped region on screen: big enough to cover the box in both directions.
  const regionW = Math.max(width, h * ratio);
  const regionH = regionW / ratio;
  // Scale the whole original so the crop region has that size, then centre it in the box.
  const imgW = regionW / photo.crop_w;
  const imgH = regionH / photo.crop_h;
  const left = -photo.crop_x * imgW - (regionW - width) / 2;
  const top = -photo.crop_y * imgH - (regionH - h) / 2;
  return (
    <View style={{ width, height: h, overflow: 'hidden', backgroundColor: c.field }}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ position: 'absolute', width: imgW, height: imgH, left, top }}
          contentFit="fill"
          transition={150}
        />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={c.textMuted} />
        </View>
      )}
    </View>
  );
}

// The frame's shape follows the first photo, within portrait 4:5 and landscape 1.91:1.
const clampRatio = (r: number) => Math.min(1.91, Math.max(0.8, r));

/**
 * One or more photos, swiped sideways, with page dots. Every photo covers the frame.
 * Tap a photo to see it full screen.
 */
export function PhotoCarousel({ photos, label, style }: { photos: Photo[]; label: string; style?: ViewStyle }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  if (!photos.length) return null;
  const frameRatio = clampRatio(croppedRatio(photos[0]));
  const frameH = width / frameRatio;

  return (
    <View style={[styles.carousel, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={photos.length > 1}
          scrollEventThrottle={32}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={[styles.frame, { width, height: frameH, backgroundColor: c.field }]}>
          {photos.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => setViewer(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${label}, photo ${i + 1} of ${photos.length}. Open full screen`}
              style={{ width, height: frameH }}>
              {/* Only the photo in view and its neighbours are loaded, to keep memory down. */}
              {Math.abs(i - page) <= 1 ? <CroppedImage photo={p} width={width} height={frameH} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]} />
          ))}
        </View>
      ) : null}
      <PhotoViewer photos={photos} start={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

/** Full-screen photos on black, swiped sideways; each fits the screen without being cut. */
export function PhotoViewer({ photos, start, onClose }: { photos: Photo[]; start: number | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(start ?? 0);
  const [opened, setOpened] = useState(start);
  // Jump to the tapped photo each time the viewer opens.
  if (start !== opened) {
    setOpened(start);
    if (start != null) setPage(start);
  }
  const areaH = height - insets.top - insets.bottom - 2 * size.touch;

  return (
    <Modal visible={start != null} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.viewer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.viewerTop}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close photo" style={styles.close}>
            <Icon name="close" size={28} color="#FAFAFA" />
          </Pressable>
          {photos.length > 1 ? (
            <Text variant="headline" style={styles.counter}>
              {page + 1} / {photos.length}
            </Text>
          ) : null}
          <View style={styles.close} />
        </View>
        {start != null ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: start * width, y: 0 }}
            scrollEventThrottle={32}
            onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={styles.flex}>
            {photos.map((p, i) => {
              const r = croppedRatio(p);
              const w = Math.min(width, areaH * r);
              return (
                <View key={p.id} style={[styles.viewerPage, { width }]}>
                  {Math.abs(i - page) <= 1 ? <CroppedImage photo={p} width={w} /> : null}
                </View>
              );
            })}
          </ScrollView>
        ) : null}
        <View style={{ height: size.touch }} />
      </View>
    </Modal>
  );
}

const MESSAGES = {
  denied: 'EasyLift needs permission for that. You can allow it in your phone settings.',
  failed: "Couldn't upload. Check your connection and try again.",
  full: `A workout can have up to ${MAX_PHOTOS} photos.`,
} as const;

/** The summary's photo strip: thumbnails (tap to crop again or remove) and Add buttons. */
export function WorkoutPhotos({ workoutId }: { workoutId: string }) {
  const c = useColors();
  const q = useWorkoutPhotos(workoutId);
  const photos = q.data ?? [];
  const [busy, setBusy] = useState<PhotoSource | null>(null);
  const [error, setError] = useState<keyof typeof MESSAGES | null>(null);
  const [menu, setMenu] = useState<Photo | null>(null);

  const add = async (source: PhotoSource) => {
    setBusy(source);
    setError(null);
    const r = await addWorkoutPhotos(workoutId, source, photos.length);
    setBusy(null);
    if (r.ok) router.push({ pathname: '/photo-crop', params: { workout: workoutId, ids: r.ids.join(',') } });
    else if (r.reason !== 'cancelled') setError(r.reason);
  };
  const crop = (p: Photo) => router.push({ pathname: '/photo-crop', params: { workout: workoutId, ids: p.id } });

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {photos.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => setMenu(p)}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1}. Crop or remove`}
              style={({ pressed }) => [styles.thumb, { opacity: pressed ? 0.8 : 1 }]}>
              <CroppedImage photo={p} width={THUMB * Math.min(1.91, Math.max(0.5, croppedRatio(p)))} height={THUMB} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.prompt}>
          <View style={[styles.badge, { backgroundColor: c.field }]}>
            <Icon name="camera-outline" size={24} color={c.accent} />
          </View>
          <View style={styles.flex}>
            <Text variant="headline">Add photos</Text>
            <Text variant="label" tone="textMuted">
              Friends see them with this workout in their feed.
            </Text>
          </View>
        </View>
      )}
      {q.isError ? (
        <Text variant="label" tone="danger">
          Photos need a connection.
        </Text>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label="Take photo"
          icon="camera"
          compact
          loading={busy === 'camera'}
          disabled={!!busy || photos.length >= MAX_PHOTOS}
          onPress={() => add('camera')}
          style={styles.flex}
        />
        <Button
          label="Choose"
          icon="image-multiple-outline"
          compact
          loading={busy === 'library'}
          disabled={!!busy || photos.length >= MAX_PHOTOS}
          onPress={() => add('library')}
          style={styles.flex}
        />
      </View>
      {error ? (
        <Text variant="label" tone="danger">
          {MESSAGES[error]}
        </Text>
      ) : null}

      <ActionSheet
        visible={!!menu}
        title="Photo"
        actions={[
          { label: 'Crop', icon: 'crop', onPress: () => menu && crop(menu) },
          {
            label: 'Remove photo',
            icon: 'trash-can-outline',
            destructive: true,
            onPress: () => menu && removeWorkoutPhoto(workoutId, menu).catch(() => setError('failed')),
          },
        ]}
        onClose={() => setMenu(null)}
      />
    </View>
  );
}

const THUMB = 96;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  carousel: { borderRadius: radius.control, overflow: 'hidden' },
  frame: { borderRadius: radius.control },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: size.touch, paddingHorizontal: space.md },
  close: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#FAFAFA' },
  viewerPage: { alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.md },
  strip: { gap: space.sm },
  thumb: { borderRadius: radius.control, overflow: 'hidden' },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: space.sm },
});
