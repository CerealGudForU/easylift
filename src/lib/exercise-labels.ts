// Display names for the library's lowercase equipment and muscle values.
const EQUIPMENT: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  kettlebells: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  'smith machine': 'Smith machine',
  'body only': 'Bodyweight',
  bands: 'Band',
  'e-z curl bar': 'EZ bar',
  other: 'Other',
};

export const EQUIPMENT_OPTIONS = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith machine', 'body only', 'bands', 'e-z curl bar', 'other'];

export const MUSCLE_OPTIONS = [
  'chest',
  'lats',
  'middle back',
  'lower back',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abdominals',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'full body',
  'cardio',
];

const MUSCLE: Record<string, string> = {
  lats: 'Lats',
  'middle back': 'Upper back',
  abdominals: 'Abs',
  quadriceps: 'Quads',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const equipmentLabel = (e: string | null) => (e ? (EQUIPMENT[e] ?? cap(e)) : 'Other');
export const muscleLabel = (m: string | null) => (m ? (MUSCLE[m] ?? cap(m)) : 'Other');
