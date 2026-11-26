// Workout photos: up to 10 per workout. The original file is uploaded to the private
// workout-photos bucket and never changed; each photo's crop is a rectangle in 0..1
// of the original, stored on its workout_photos row and applied when drawing. That
// makes re-cropping lossless and possible any time.
// Reading needs a short-lived signed URL; storage RLS decides who can get one.
import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

import { getTable, uuid } from './data/store';
import { syncNow } from './data/sync';
import { queryClient } from './query';
import { supabase } from './supabase';

const BUCKET = 'workout-photos';
const URL_TTL_S = 60 * 60;
export const MAX_PHOTOS = 10;
/**
 * Longest side of an uploaded photo. Camera originals (e.g. 3000×4000) decode to ~48 MB
 * each on the phone and made the app use ~370 MB more memory; 1080 px (Instagram's size)
 * decodes to ~6 MB and saves as a ~40-80 KB JPEG.
 */
const MAX_SIDE = 1080;

export type Crop = { x: number; y: number; w: number; h: number };
export type Photo = {
  id: string;
  path: string;
  width: number;
  height: number;
  crop_x: number;
  crop_y: number;
  crop_w: number;
  crop_h: number;
};

export const cropOf = (p: Photo): Crop => ({ x: p.crop_x, y: p.crop_y, w: p.crop_w, h: p.crop_h });
/** Width ÷ height of the photo as cropped. */
export const croppedRatio = (p: Photo) => (p.width * p.crop_w) / (p.height * p.crop_h);

const photosKey = (workoutId: string) => ['photos', workoutId] as const;

export function useWorkoutPhotos(workoutId: string) {
  return useQuery({
    queryKey: photosKey(workoutId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_photos')
        .select('id, path, width, height, crop_x, crop_y, crop_w, crop_h')
        .eq('workout_id', workoutId)
        .order('position')
        .order('created_at');
      if (error) throw error;
      return data as Photo[];
    },
  });
}

/** Everything that shows a workout's photos (feed, post, the summary) reloads. */
function refreshPhotos(workoutId: string) {
  void queryClient.invalidateQueries({ queryKey: photosKey(workoutId) });
  void queryClient.invalidateQueries({ queryKey: ['feed'] });
  void queryClient.invalidateQueries({ queryKey: ['post', workoutId] });
}

export type PhotoSource = 'camera' | 'library';
export type AddResult = { ok: true; ids: string[] } | { ok: false; reason: 'cancelled' | 'denied' | 'failed' | 'full' };

/**
 * Takes a photo, or picks one or more from the library, and uploads them uncropped.
 * Returns the new photo ids so the caller can open the crop editor on them.
 */
export async function addWorkoutPhotos(workoutId: string, source: PhotoSource, existing: number): Promise<AddResult> {
  const workout = getTable('workouts').get(workoutId);
  if (!workout) return { ok: false, reason: 'failed' };
  const room = MAX_PHOTOS - existing;
  if (room <= 0) return { ok: false, reason: 'full' };

  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'denied' };

  // No system crop: EasyLift's own editor crops to any ratio and can crop again later.
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          allowsMultipleSelection: true,
          selectionLimit: room,
          orderedSelection: true,
        });
  if (result.canceled || !result.assets.length) return { ok: false, reason: 'cancelled' };

  try {
    // The workout row must be on the server before photos can point at it.
    await syncNow();
    const ids: string[] = [];
    for (const [i, asset] of result.assets.slice(0, room).entries()) {
      const size = asset.width && asset.height ? { width: asset.width, height: asset.height } : await imageSize(asset.uri);
      const small = await shrink(asset.uri, size.width, size.height);
      const id = uuid();
      const path = `${workout.owner_id}/${workoutId}/${id}.jpg`;
      const body = await (await fetch(small.uri)).arrayBuffer();
      const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const row = { id, workout_id: workoutId, path, position: existing + i, width: small.width, height: small.height };
      const ins = await supabase.from('workout_photos').insert(row as never);
      if (ins.error) {
        void supabase.storage.from(BUCKET).remove([path]);
        throw ins.error;
      }
      ids.push(id);
    }
    return { ok: true, ids };
  } catch (e) {
    if (__DEV__) console.log('[photo] upload failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'failed' };
  } finally {
    refreshPhotos(workoutId);
  }
}

/** Scales a photo down so its longest side is at most MAX_SIDE, as a JPEG. */
async function shrink(uri: string, width: number, height: number): Promise<{ uri: string; width: number; height: number }> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** The picker can report 0×0; measure the file instead (falls back to square). */
function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) =>
    Image.getSize(
      uri,
      (width, height) => resolve({ width: width || 1, height: height || 1 }),
      () => resolve({ width: 1, height: 1 }),
    ),
  );
}

export async function setPhotoCrop(workoutId: string, photoId: string, crop: Crop) {
  const { error } = await supabase
    .from('workout_photos')
    .update({ crop_x: crop.x, crop_y: crop.y, crop_w: crop.w, crop_h: crop.h } as never)
    .eq('id', photoId);
  refreshPhotos(workoutId);
  if (error) throw error;
}

export async function removeWorkoutPhoto(workoutId: string, photo: Photo) {
  const { error } = await supabase.from('workout_photos').delete().eq('id', photo.id);
  if (!error) void supabase.storage.from(BUCKET).remove([photo.path]);
  refreshPhotos(workoutId);
  if (error) throw error;
}

/** Signed URL for a photo path, cached for most of its lifetime. */
export function usePhotoUrl(path: string | null | undefined): string | null {
  const q = useQuery({
    queryKey: ['photo-url', path],
    enabled: !!path,
    staleTime: (URL_TTL_S - 300) * 1000,
    gcTime: (URL_TTL_S - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, URL_TTL_S);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return q.data ?? null;
}
