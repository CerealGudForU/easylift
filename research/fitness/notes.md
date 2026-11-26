# Fitness app research (2026-11-26)

Sources:
- **Hevy** (free tier): live walkthrough on the Android phone. Screenshots are in `research/screens/hevy/`, which is git-ignored and for local reference only.
- **Hevy and Strong**: public marketing and feature pages.
- **Fitbod**: skipped. It has a hard paywall, and EasyLift has no onboarding or paywall to learn from. Fitbod's site also refused automated reads.

Pattern notes only. EasyLift copies none of these apps' visuals, copy or assets.

## What these apps converge on (table stakes)
| Area | Pattern |
|---|---|
| Tabs | 3 tabs: Feed/Home · Workout · Profile |
| Start | "Start empty workout" plus a routines list on the Workout tab |
| Exercise picker | Full-screen modal: search, Equipment and Muscle filter chips, list with thumbnail + primary muscle, **multi-select** with a sticky "Add N exercises" button, and "Create" for custom exercises |
| Logging table | Columns: SET · PREVIOUS · KG · REPS · ✓. One row per set, "+ Add Set" under each exercise |
| Input | Tap a cell to get a **numeric keypad** (system or custom). "Done" moves to the next field |
| Completing | Tick the ✓. The whole row turns green, and volume/sets update live in the header |
| Previous | Last session's `weight × reps` is shown greyed. Tapping it copies it into the row |
| Set types | Tap the set number to open a sheet: Warm-up (W), Normal (1, 2…), Failure (F), Drop (D), Remove |
| Rest timer | Per-exercise chip ("Rest: 1:30"). Starts automatically when a set is ticked, with ±15 s adjust and skip. Drop sets don't trigger it. Lock-screen/notification controls |
| Exercise menu | ⋮ opens: Reorder, Replace, Add to superset, Remove |
| Header | Collapse chevron (minimises to a floating bar), elapsed time, a timer button, and a **Finish** button |
| Finish | Save sheet: title, description (@-mention friends), duration/volume/sets, photo, date, visibility, discard |
| After save | Workout count ("Nth workout"), streak, PRs hit, share card |
| Exercise detail | Tabs: Summary (chart: heaviest / est. 1RM / best-set volume), History, How-to, Leaderboard (friends). Lists personal records |
| Profile | Totals, a chart toggle (duration/volume/reps), a dashboard grid (Statistics, Exercises, Measures, Calendar), and a workout list |
| Social | Feed of friends' workouts (duration, volume, PRs), likes, comments, "copy workout / save as routine", compare stats with a friend |

## Pain points spotted in Hevy (opportunities for EasyLift)
- Many upsell surfaces: the PRO badge, the "Trainer" card, and locked stats. **EasyLift has none.**
- Logging fields are small (about 80 × 40 dp) for sweaty thumbs. **EasyLift should use bigger rows (≥56 dp) and a custom keypad with ±2.5 kg / ±1 rep steppers.**
- "Rest: OFF" is the default, and setting it means scrolling a wheel. **EasyLift: rest on by default (90 s), with quick chips for 60/90/120/180.**
- The Home tab opens on "Suggested athletes" built around strangers. **EasyLift is friends-only: an empty state that says "Add friends by username".**
- The volume number is the only live feedback. **EasyLift adds a small "vs last time" delta per exercise.**

## EasyLift v1 feature checklist (from this research)
- [ ] 3 tabs: Feed · Workout · Profile
- [ ] Exercise picker with multi-select and filters; custom exercises
- [ ] Logging table with a previous column, tap-to-copy, set types, notes, supersets, reorder/replace
- [ ] Custom keypad with steppers; next-field flow
- [ ] Rest timer (auto, ±15 s, skip, notification) and a minimised workout bar
- [ ] Finish sheet, then a summary with PRs, workout count, streak, and a share card
- [ ] Exercise detail: chart (heaviest / est. 1RM / volume), history, PRs, friends leaderboard
- [ ] Profile: totals, weekly chart, calendar, measurements
- [ ] Friends feed: likes, comments, copy a workout as a routine, compare with a friend
