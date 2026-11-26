# EasyLift design system: Ember

Chosen 2026-11-26, on a near-black base. The code source of truth is `src/theme/tokens.ts`. This file explains the rules.

**Personality:** athletic and confident, built to be read mid-set. Neutrals carry the app; orange marks the one thing to do next, and green means done.

## Color
One accent, one grey family (neutral, no blue or warm tint). Every token exists in **dark (default look)** and **light**.

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0A0A0A` | `#FAFAFA` | Screen background |
| `surface` | `#141414` | `#FFFFFF` | Cards (exercise card, feed post) |
| `surfaceRaised` | `#1C1C1C` | `#FFFFFF` | Sheets, bottom bars |
| `field` | `#1F1F1F` | `#F0F0F0` | Inputs, chips, secondary buttons |
| `border` | `#262626` | `#E5E5E5` | Hairlines, dividers |
| `text` | `#FAFAFA` | `#0A0A0A` | Primary text |
| `textSecondary` | `#A3A3A3` | `#525252` | Supporting text |
| `textMuted` | `#8A8A8A` | `#737373` | Previous values, captions, placeholders |
| `accent` | `#F97316` | `#EA580C` | Primary action, active field, rest timer, links |
| `onAccent` | `#1A0E05` | `#FFFFFF` | Text and icons on the accent |
| `success` | `#16A34A` | `#16A34A` | Completed-set check button |
| `onSuccess` | `#FFFFFF` | `#FFFFFF` | Check icon |
| `successBg` | `#122B1A` | `#DCFCE7` | Completed set row |
| `successText` | `#22C55E` | `#15803D` | Positive deltas ("+5%"), PR text |
| `danger` | `#EF4444` | `#DC2626` | Destructive actions, failure-set letter |
| `setWarmup` | `#F5A524` | `#B45309` | "W" set letter |
| `setDrop` | `#60A5FA` | `#2563EB` | "D" set letter |

The rules:
- **Accent spend:** at most one accent-filled control per screen region (Finish, Start workout, Save). Everything else is `field` or ghost.
- **Green only means completed or improved.** It is never used for decoration.
- Set-type letters (W/F/D) are the only other hues. They are semantic and always paired with the letter, so meaning never relies on colour alone.

## Typography
- **Barlow Condensed** for numbers and display text: weights, reps, timers, stats, screen titles, exercise names (uppercase).
- **Barlow** for everything you read: body, labels, buttons.
- Numbers always use tabular figures.

| Style | Font | Size / line | Use |
|---|---|---|---|
| `display` | BC 700 | 34 / 38 | Big timers, summary numbers |
| `title` | BC 700 | 26 / 30 | Screen titles |
| `exercise` | BC 700, uppercase, +0.5 tracking | 20 / 24 | Exercise names |
| `numeric` | BC 700 | 22 / 26 | Set fields (kg, reps) |
| `stat` | BC 600 | 18 / 22 | Header stats |
| `headline` | Barlow 600 | 17 / 22 | Section headers, buttons |
| `body` | Barlow 400 | 16 / 22 | Body copy |
| `label` | Barlow 500 | 14 / 18 | Chips, small buttons |
| `caption` | Barlow 500 | 12 / 16 | Column headers (uppercase), metadata |

There is one `display` size per screen. Nothing goes below 12.

## Space, shape and size
- 4-point grid: `4, 8, 12, 16, 20, 24, 32, 40`. Use `gap`, not stacked margins. Screen gutter is 16.
- **Shape lock:** fields and buttons 10, cards and sheets 16, chips are pills (999).
- Touch targets are at least 48 dp. Set rows are 56 high, and set fields are 48 high with at least 64 wide.

## Icons
**MaterialCommunityIcons** (`@expo/vector-icons`) only, including `dumbbell`, `timer-outline`, `check-bold` and `dots-vertical`. No emoji anywhere in the UI.

## Input patterns (no typing needed)
- **Rest time:** an inline stepper chip. Tap "Rest 1:30" and it becomes `− ⏱ 1:30 +` with 15 s steps (hold to repeat, 0 = Off, max 10:00). Tap the time to close, or it closes itself after 6 s idle.
- **Kg and reps: expanding set row** (chosen over a ruler sheet). The next set opens in place, pre-filled from last time, with −/+ steppers (2.5 kg, 1 rep). Hold to repeat, or tap the number to type.
  - **± snaps to the 2.5 kg grid:** steps only land on …0, …2.5, …5 or …7.5 (81 → + gives 82.5, 81 → − gives 80). Pressing ± ends any typing.
  - **Tap the top strip** ("Last time 80 × 8", the empty space, or ⌃) to close the open set. Only the set number keeps its own action (changing the set type). There is no Copy button: sets already start from last time.
  - **A completed set stays green when opened:** green tint, green border, and "Mark not done" instead of "Complete set".
  - "Complete set" moves on to the next unfinished set *after* this one, scrolled clear of the rest bar.

- **Set type: tap the set number to cycle** Normal (1, 2…) → Warm-up (W) → Failure (F) → Drop (D). This was decided on 2026-11-26 over a labelled menu, so keep it.

## Motion and haptics
- Tabs and stack transitions use the platform defaults.
- **Completing a set:** the row background fades to `successBg` in 150 ms, and the check fills. Android gets a success haptic notification on the same frame.
- **Rest timer bar:** rises 72 dp while fading in over 260 ms, decelerating (ease-out cubic) with no overshoot or bounce. It leaves the same way in 180 ms. At zero there's a heavy haptic, then it auto-dismisses after 3 s.
- Value steps (±2.5 kg / ±1 rep) give a selection haptic.
- Respect "reduce motion": swap springs for 0-ms fades.

## States every screen ships with
These are loading skeletons that match the layout, a written empty state with one action, inline errors, light and dark, large text (130%), and offline behaviour.

## Voice
Copy is short, in sentence case, and starts with a verb ("Start workout", "Add set", "Finish"). Each intent gets one label. There's no "please", and no exclamation marks except on PR celebrations.
