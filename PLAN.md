# EasyLift — Build Plan

A workout tracker in the style of Hevy (routines, live set logging, rest timer, progress charts, social feed). It ships as a **native Android app (targeting Android 17 / API 37)** and as an **installable PWA for iPhone**. Backend: **Supabase**. PWA hosting: **Cloudflare**.

> **Originality rule.** We copy the *mechanics* (what a strength-logging app does), not Hevy itself. No Hevy name, logo, screenshots, icons, colour scheme, copy, or exercise media. EasyLift gets its own visual identity from UI UX Pro Max. Appllama research covers the whole fitness category, so no single app is the template.

---

## 1. Key decision: one codebase, two targets

| Target | How it ships |
|---|---|
| Android 17 | Expo (React Native) dev/release build → APK/AAB (`targetSdkVersion 37`) |
| iPhone | The same Expo app exported for web (`react-native-web`) → PWA on Cloudflare, installed with Safari's "Add to Home Screen" |

**Why Expo:** the Appllama design skill is written for Expo + Expo Router + Reanimated. Expo's web export gives us the PWA from the same code, and this session already has the Expo skills (`expo-router`, `expo-ui`, `expo-animation`, `expo-data-fetching`, etc.). A Kotlin/Compose app plus a separate web app would mean building everything twice.

**Stack**
- Expo SDK (latest stable, which must support API 37; check before scaffolding), Expo Router, TypeScript
- Reanimated + Gesture Handler (swipe-to-delete sets, sheets), FlashList (history, exercise library)
- Local-first data: `expo-sqlite` (native, plus web via WASM/OPFS) with a Drizzle ORM schema
- Sync: a custom outbox to Supabase (workouts are per-user and almost all appends, so conflicts are rare). Use PowerSync only if the custom sync gets complicated.
- TanStack Query for server-only data (feed, profiles, comments)
- Charts: `victory-native` (Skia) on Android, with a web fallback check
- Supabase JS client with `expo-secure-store` (native) or IndexedDB (web) for the session

---

## 2. How the two skills are used

### UI UX Pro Max (installed: `~/.claude/skills/ui-ux-pro-max`)
Owns **visual identity and the UX rules**.
1. Generate the design system once:
   `search.py "fitness workout tracker strength gym dark mode" --design-system -p "EasyLift"`. Save it to `design/MASTER.md`. It covers palette, type pairing, spacing, radii, and motion timings.
2. Run targeted queries per area: `--domain chart` (volume/1RM charts), `--domain ux` (numeric steppers, timers, touch targets, reduced motion), `--stack react-native`.
3. Turn the result into `src/theme/tokens.ts` with semantic tokens only and no raw hex in components. Include light and dark themes. Dark is the default because people use it in the gym.
4. Before each phase is done, run the `pro-rules.md` pre-delivery checklist: 44px targets, contrast 4.5:1, safe areas, dark-mode contrast.

### Appllama: free plan, design skill only
**Decision:** install only the design skill:
`npx skills@latest add appllama/appllama-skills --skill appllama-app-design-skill`

- `appllama-app-design-skill` (MIT, free, works **without** the MCP) is the build bar. It covers native controls, navigation semantics (push vs replace, sheets, one-way doors), the motion bar, and a per-screen definition of done. This is most of Appllama's value for this project.
- `appllama-usage` (research over the Appllama MCP) is **skipped**. The free plan has no MCP access and no credits; it only allows browsing on the website (welcome screens of every app plus 2 rotating apps in full). Instead, browse appllama.io by hand on the free plan if you like, and write notes to `research/fitness/`.
- *Optional upgrade:* one month of Pro (about $16) unlocks the MCP with 1,500 credits, which is enough for the research below. Cancel afterwards.

#### Self-run screen research (replaces the paid research skill)
Claude does this itself, with no Appllama credits:
1. **Public sources in the built-in browser:** Google Play and App Store listing screenshots and "What's new" notes, the official websites and help centres/feature docs (these describe every flow step by step), and changelogs. Apps: Hevy, Fitbod, Strong, and 1–2 others, so no single app becomes the template.
2. **Live walkthrough on your phone (optional, most detailed):** you install the apps from the Play Store and **sign in or create the accounts yourself**. Then Claude drives them over adb (`input tap/swipe`, `screencap`, `screenrecord`) and captures the real flows: starting a workout, logging sets, the rest timer, finishing, history, charts, and adding friends. Claude won't create accounts, accept terms, or buy anything in those apps; anything like that is handed to you.
3. Output: `research/fitness/<flow>.md` with pattern notes (what every app does, what's best-in-class, what EasyLift will do differently) plus a feature matrix. Screenshots stay in a git-ignored `research/screens/` folder for local reference only. They are never committed, published, or traced into EasyLift's UI.

If Pro is ever bought, the research budget is about 150–250 credits:
1. `search_apps` for top-grossing fitness/workout loggers. Pick 5–8 apps across the category, not just one.
2. `list_flows` / `get_flow_apps` for onboarding, the active workout session, routine builder, exercise picker, workout summary/share, progress charts, and the social feed.
3. `list_ui_elements` → `get_element_screens` for rest-timer, set-row, numeric-keypad, and calendar/streak patterns.
4. Download screens right away (URLs expire after about 1 hour). Write notes to `research/fitness/<flow>.md` covering what works, what's common, and what we'll do differently.

> **Windows caveat:** Appllama's verification loop assumes the iOS Simulator (`xcrun simctl`), which needs a Mac. Do this instead: run the full-motion pass on **your USB-connected Android phone** with `adb exec-out screencap` / `adb shell screenrecord`, and test on a **real iPhone in Safari / installed PWA** for iOS.

**Division of labour:** Appllama decides *what the screen needs and how it should behave* (from category evidence). UI UX Pro Max decides *how EasyLift looks* and checks accessibility and UX quality. Where they conflict, use Appllama for interaction/navigation and UI UX Pro Max for visuals and accessibility.

---

## 3. Feature scope

**MVP (v1)**
- Auth: **username + password only, no email** (see §4.1)
- **Friends-based social:** search by username, send/accept friend requests, a feed of friends' workouts, likes, comments, and a share card
- Exercise library: EasyLift's own curated list of ~100 general exercises, one per movement and equipment ("Barbell Squat", "Kettlebell Squat", "Lat Pulldown"), not every grip/tempo variant (`scripts/exercise-library.mts`, seeded with `npm run seed:exercises`, which retires removed entries). Includes muscle-group/equipment filters and custom exercises for anything more specific. (Replaced the free-exercise-db import on 2026-11-26: its names were too specific.)
- Routines: create, reorder (drag), folders, and "start workout from routine"
- **Active workout** (the core screen): set rows (weight × reps, RPE), set types (warm-up, normal, drop, failure), "previous" values shown inline, tap-to-complete, supersets, notes, an auto rest timer with haptics, and a minimised "workout in progress" bar that stays across tabs
- Workout summary: duration, volume, PRs hit
- History + calendar, per-exercise history, PR detection (est. 1RM using the Epley formula, best set, best volume)
- Progress charts: est. 1RM, volume, and reps over time
- Settings: kg/lb, rest-timer defaults, theme
- Works fully offline; sync when back online

**v1.1:** body measurements + progress photos, plate calculator, warm-up calculator, friend leaderboards per exercise.

**Later:** web push reminders, Android home-screen widget, Wear OS, CSV import/export (including importing other apps' CSV exports).

---

## 4. Supabase backend

### 4.1 Username + password login (no email)
Supabase Auth needs an email or phone for each user, so EasyLift creates a **synthetic email that the user never sees**:
- Sign-up form: username + password + confirm password. Usernames (`^[A-Za-z0-9_.]{3,20}$`) keep the capitals the user picks for display ("EthanJG") but are unique and matched ignoring case (citext). The client calls `signUp` with the email `<lowercased username>@users.easylift.cerealgudforu.workers.dev` and `data: { username }` (`src/lib/auth.ts`). Supabase rejects reserved TLDs (`.invalid`, `.local`), so the synthetic address uses a subdomain of our own workers.dev host, which has no mail server. With "Confirm email" off, no mail is ever sent. **Never change this domain**: existing accounts sign in through it.
- Sign-in: username + password → same mapping → `signInWithPassword`.
- Supabase dashboard: **"Confirm email" is off** (done 2026-11-26). The app enforces the 8-character minimum on sign-up. Keep the sign-up rate limits.
- A trigger on `auth.users` insert creates `profiles` with `username UNIQUE` (citext). A `username_available(text)` RPC gives live "username taken" feedback.
- **No "forgot password" flow.** The app is for friends and family, so the admin resets passwords by hand. `npm run reset-password -- <username> <new-password>` runs locally with the secret key (`SUPABASE_SECRET_KEY`) from a git-ignored `.env.local` and calls `auth.admin.updateUserById`. The sign-in screen says "Forgot it? Ask the admin." Logged-in users can change their own password in Settings.
- Usernames are the public identity, so the synthetic email is never shown or exposed through the API (profiles holds only the username).

### 4.2 Friends-based social
- `friendships(user_a, user_b, requested_by, status: pending|accepted, created_at)` with `user_a < user_b` (one row per pair, so no duplicates). Supports send, accept, decline, cancel, and unfriend.
- SQL helper `is_friend(a, b)` (security definer, stable) is used in RLS.
- Workout `visibility`: `friends` (default) | `private`. There are no public posts. Non-friends see only username + avatar when searching.
- Feed = friends' `friends`-visibility workouts, newest first, keyset pagination (`started_at, id`), served by a SQL view/RPC `get_feed(cursor)`.
- Likes and comments only on workouts you can see (RLS reuses the same check). Notifications table for friend requests, likes, and comments, with an in-app bell (Supabase Realtime).
- Block/report: a `blocks` table. A block also removes the friendship and hides the user from search.

**Tables** (all with RLS: owner read/write; friends read where `visibility = 'friends'` and `is_friend(auth.uid(), owner_id)`):
```
profiles(id → auth.users, username citext unique, display_name, avatar_url, units, created_at)
friendships(user_a, user_b, requested_by, status, created_at) · blocks(blocker_id, blocked_id)
notifications(id, user_id, kind, actor_id, workout_id, read_at, created_at)
exercises(id, owner_id NULL=global, name, primary_muscle, secondary_muscles[], equipment, type[weight_reps|reps|time|distance])
routines(id, owner_id, name, folder, position, notes)
routine_exercises(id, routine_id, exercise_id, position, superset_group, rest_seconds, notes)
routine_sets(id, routine_exercise_id, position, set_type, target_reps, target_weight)
workouts(id, owner_id, routine_id, title, started_at, ended_at, notes, visibility, client_updated_at)
workout_exercises(id, workout_id, exercise_id, position, superset_group, notes)
workout_sets(id, workout_exercise_id, position, set_type, weight_kg, reps, rpe, duration_s, distance_m, completed_at)
personal_records(id, owner_id, exercise_id, kind, value, workout_set_id, achieved_at)
likes(user_id, workout_id) · comments(id, workout_id, user_id, body, created_at)
body_measurements(id, owner_id, measured_at, weight_kg, body_fat_pct, ...)
```
- Generate UUIDs on the client so offline-created rows sync without remapping. Track `client_updated_at` and use last-write-wins per row.
- Always store weight in **kg**. Convert only for display.
- PR calculation: a Postgres function/trigger on `workout_sets` insert, plus a client-side copy for offline display.
- Storage buckets: `avatars` (public), `progress-photos` (private, RLS by folder = user id).
- Edge Functions: share-image generation; push notifications later.
- Workflow: Supabase CLI locally (`supabase start`, migrations in `supabase/migrations`), regenerate TS types, then push to the hosted project. Install `npx skills add supabase/agent-skills` for guidance. Run `get_advisors` (security + performance) before each release.

---

## 5. Cloudflare (PWA)

- `npx expo export -p web` → `dist/`, deployed with **Wrangler to Workers static assets** (or Cloudflare Pages; either works). SPA fallback goes to `index.html`.
- PWA layer: `manifest.webmanifest` (name, `display: standalone`, theme colours from tokens, 192/512 + maskable icons), `apple-touch-icon`, `apple-mobile-web-app-*` meta, and a Workbox-generated service worker (precache the app shell, network-first for API calls).
- `_headers`: `no-cache` on `sw.js` and `index.html`, immutable caching on hashed assets, and a strict CSP that allows the Supabase URL.
- Worker name `easylift` → **https://easylift.cerealgudforu.workers.dev** (you'll set this up later; a custom domain can be added after that). Add this URL to Supabase Auth's allowed site URLs. Supabase env vars set as build-time `EXPO_PUBLIC_*` (publishable key only; never the secret key).

**iOS PWA limits to design around**
- No background execution: the rest timer must be based on timestamps (`endsAt`), not intervals, so it stays correct after the app is backgrounded. Alerts come from a scheduled local notice when possible, otherwise a vibration/sound on return.
- Web Push only works for home-screen-installed PWAs (iOS 16.4+), so show an "Add to Home Screen" guide on first visit in Safari.
- Use the Screen Wake Lock API during workouts (with a feature check), and call `navigator.storage.persist()` so data isn't evicted.
- No haptics API on iOS web, so feedback has to be visual only there.

---

## 6. Android 17 specifics
- `compileSdk`/`targetSdk` 37 via `expo-build-properties`. Use edge-to-edge (now mandatory), predictive back gesture support, and Material You dynamic colour as an option on top of the brand tokens.
- Use a foreground service / scheduled notification (`expo-notifications`) for the rest timer while the app is in the background. Haptics come from `expo-haptics`.
- **Development builds happen locally and install straight onto your USB-connected phone** with `npx expo run:android --device` (debug, with hot reload). Public releases go through GitHub (§6.1).
- Phone prep: enable Developer options → **USB debugging**, accept the PC's RSA prompt, and check that it shows in `adb devices`.
- PC prep (currently missing): **Node LTS**, **Android Studio** (SDK Platform 37, Build-Tools, Platform-Tools/adb), set `ANDROID_HOME`, and **JDK 17** (Android Studio's bundled JBR works). Java 23 is installed now, but Gradle/React Native expects 17.

### 6.1 GitHub as the single source of builds
One **public GitHub repo** (e.g. `easylift`) holds the code. Both targets build from it automatically.

```
push to main ──► Cloudflare Workers Builds ──► easylift.cerealgudforu.workers.dev (PWA)
push tag v1.2.0 ──► GitHub Actions ──► signed APK ──► GitHub Release "v1.2.0" (EasyLift-1.2.0.apk)
```

**Android APK via GitHub Releases**
- `.github/workflows/android-release.yml`: runs on `v*` tags. It sets up Node + JDK 17, runs `npx expo prebuild -p android` and then `./gradlew assembleRelease`, signs with the release keystore, and uploads the APK to the Release with `softprops/action-gh-release`.
- The keystore lives in **GitHub Secrets** (`ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). **Back it up offline.** If it's lost, existing installs can't update without uninstalling first.
- `versionName` comes from the tag and `versionCode` is computed from it (e.g. 1.2.3 → 10203) in `app.config.ts` (see §7.5). A higher versionCode plus the same signature lets updates install over the old version.
- Download link for users: `https://github.com/CerealGudForU/easylift/releases/latest/download/EasyLift.apk`. The workflow also uploads a fixed-name copy so this link never changes. Users allow "Install unknown apps" for their browser once.
- **In-app updater:** on launch (and in Settings → "Check for updates"), call `GET https://api.github.com/repos/CerealGudForU/easylift/releases/latest`, compare `tag_name` with the installed version, and show a "Update available, see what's new" sheet with the release notes. Tapping it downloads the APK with `expo-file-system` and opens the Android installer through an intent (`REQUEST_INSTALL_PACKAGES` permission). Android always asks the user to confirm; silent updates aren't possible outside the Play Store.
- Users can also add the repo to **Obtainium**, which tracks GitHub releases automatically.
- Optional later: `expo-updates` hosted on GitHub/Cloudflare for instant JS-only fixes without a new APK. Skip for v1 and keep native releases simple.

**PWA via Cloudflare from GitHub**
- Connect the repo in Cloudflare dashboard → Workers → `easylift` → **Settings → Builds → Connect to GitHub**. Build command `npx expo export -p web && node scripts/build-sw.mjs`, deploy command `npx wrangler deploy`. Every push to `main` deploys, and other branches get preview URLs.
- `wrangler.jsonc` in the repo: `assets.directory = "dist"`, `not_found_handling = "single-page-application"`.
- Build env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are set in Cloudflare build settings. Both are safe to make public.
- PWA updates: the service worker detects a new version and shows a "New version, tap to reload" toast. It never reloads in the middle of a workout.

**CI checks** (`.github/workflows/ci.yml`, on every PR/push): typecheck, lint, Vitest, Supabase migration lint. Releases only build from a green `main`.

---

## 7. Phases

| # | Phase | Main skills | Done when |
|---|---|---|---|
| 0 | **Setup**: install Node LTS, Android Studio (SDK 37, adb, JDK 17), Supabase CLI, Wrangler, git init; install the Appllama design skill; enable USB debugging | — | Expo starter runs on your phone *and* in the browser |
| 1 | **Research**: Claude studies Hevy, Fitbod, Strong and others from store listings + help docs, plus an optional live walkthrough on your phone over adb | built-in browser, adb | `research/fitness/*.md` + feature matrix |
| 2 | **Design system**: tokens, type, icons (one icon set, e.g. Lucide/Phosphor, no emoji), core components (SetRow, NumericStepper, RestTimer, ExerciseCard, Sheet) | ui-ux-pro-max, appllama-app-design-skill | `design/MASTER.md` + component gallery screen in light and dark |
| 3 | **Backend + auth**: migrations, RLS, exercise seed, username/password sign-up/in, admin reset script | Supabase MCP/CLI | Advisors clean; RLS tests pass; sign up → sign in works on phone + web |
| 4 | **Core loop**: library → routine builder → active workout → summary → history | all | A full workout can be logged offline on Android and web and syncs (done 2026-11-26, see §7.1) |
| 5 | **Progress**: PRs, charts, calendar, per-exercise history | ui-ux-pro-max `--domain chart` | Charts readable, accessible, correct against fixtures (done 2026-11-26, see §7.2) |
| 6 | **Friends + feed**: username search, requests, feed, likes, comments, notifications, share card, workout photos | all | Feed paginates; private/non-friend workouts never leak (RLS test) (done 2026-11-26, see §7.3) |
| 7 | **PWA + deploy**: manifest, SW, iOS install flow, Cloudflare connected to GitHub | — | Push to main → live at easylift.cerealgudforu.workers.dev; installed on a real iPhone, works in airplane mode |
| 8 | **Android release pipeline**: icons, splash, keystore, Actions release workflow, in-app updater | — | Tag v0.1.0 → APK on GitHub Releases → installs on your phone; tag v0.1.1 → the app offers the update and it installs over v0.1.0 |

### 7.1 Phase 4 notes (2026-11-26)
- **Offline-first store** (`src/lib/data/`): the UI reads and writes a device copy (SQLite rows on Android, localStorage per table on web); `sync.ts` pushes dirty rows parents-first and pulls by `updated_at`, last-write-wins on `client_updated_at` (server trigger `private.keep_newest` skips stale upserts). Syncs after edits, on foreground, and every 30 s while anything is waiting.
- **Workout tab**: floating "Start Workout" button; routines list with "Start routine". "New routine" opens the exercise picker first; the name is optional (blank = named after its main muscles, e.g. "Chest & Shoulders").
- **Active workout**: previous values from the last session, suggested values from the set above when there's no history, rest timer that survives minimising, "workout in progress" bar above the tabs, finish drops unfinished sets.
- Not in Phase 4 yet: supersets, RPE, exercise notes, timed/distance logging (cardio is logged as weight × reps), drag reordering (exercises move up/down from their menu), kg/lb setting.

### 7.2 Phase 5 notes (2026-11-26)
- **Progress maths** live in `src/lib/progress.ts` (pure, no store): Epley e1RM, per-session metrics (warm-ups excluded), all-time records (heaviest weight, est. 1RM, best set, session volume, most reps; the first session to reach a value holds it), records set in a given workout, chart series, weekly totals, week streak and the Monday-first month grid. `npm test` runs the Vitest fixtures in `progress.test.ts`.
- **PRs are computed on the device** from synced sets, not stored: no `personal_records` rows, so offline edits and deleted workouts can never leave a stale record. The friends feed (Phase 6) can compute "PRs hit" the same way, or add a server-side copy then.
- **Screens**: Profile shows a 12-week bar chart (workouts / volume / time) plus Exercises and Calendar tiles; `/exercises/all` lists logged exercises with their best; `/exercises/[id]` has a line chart (est. 1RM, heaviest, best set, volume, reps; 1M/3M/1Y/All), personal records and full history; `/calendar` has the month grid, streak and the chosen day's workouts. The workout summary lists every new record per exercise, and exercise names open their progress.
- **Charts** are `react-native-svg` (`src/components/charts/`), one series each in the accent colour (no legend; the title and caption name it), tap or drag to read a point, and an accessibility label summarising the data. The session history under each chart is its table view.
- Memos that read the store through helpers must call `dependsOn(data)`, not `void data`: the React Compiler drops a bare `void` and the memo goes stale.

### 7.3 Phase 6 notes (2026-11-26)
- **Server-only, online**: friends, feed, likes, comments and notifications go through TanStack Query (`src/lib/query.tsx`, `src/lib/social.ts`), not the offline store. The cache is cleared when the signed-in user changes. Without a connection these screens show an error with Try again; logging workouts still works offline.
- **SQL** (`20261126120000_social_feed.sql`): `get_feed(before_started, before_id, page_size)` (keyset pagination on `(started_at, id)`, 10 per page), `search_profiles(q)` (username prefix, ignoring case, wildcards literal) and `list_friends()`. All SECURITY INVOKER, so RLS stays the only gate. The feed shows finished, friends-visible workouts by you and your friends. Notifications are in the Realtime publication; the bell's unread count updates live.
- **Screens**: Feed tab (cards with time / volume / sets, first 3 exercises, like and comment), `/friends` (search, requests with Accept/Decline, sent requests, Unfriend / Block), `/post/[id]` (the full workout from the server, likes, comments; delete your own comments or any on your workout), `/notifications` (opening it marks all read), `/share/[id]` (a dark share card: an image via react-native-view-shot + expo-sharing on Android, text via the share sheet on web).
- **Visibility**: the workout summary has a "Friends can see this / Only you" toggle (`workouts.visibility`, synced).
- **Workout photos** (`20261126130000_workout_photos.sql`): one square photo per workout (camera or library via expo-image-picker), added from the summary right after Finish or later from history. Files go to the private `workout-photos` bucket at `<owner>/<workout>/<random>.jpg`; `workouts.photo_path` syncs like any field. Storage RLS reuses `can_view_workout`, so a photo is exactly as visible as its workout; it's read through 1-hour signed URLs. Uploading needs a connection (the summary shows an error to retry). Replacing or removing a photo deletes the old file (best effort).
- **RLS test** (`supabase/tests/rls.sql`) now also covers the feed (no private/unfinished/non-friend rows, counts, two pages with no overlap), search (self excluded, literal wildcards, hidden after a block), friend lists and photo access (friend sees only the visible workout's photo, stranger none, no uploads into another user's folder).
- **Feed cards** show Time · Exercises · Sets · Volume and when the workout was posted (finished), e.g. "Today, 18:05 · 4h ago" (`formatPosted`).
- **Friends row + profiles** (`20261127090000_profiles_activity_photos.sql`): `friends_now()` lists friends for the row on top of the feed, working out now first (green ring + LIFTING). "Working out now" comes from `private.active_since(who)`, a SECURITY DEFINER helper that returns only the start time of an open, friends-visible workout from the last 6 hours, and only to that person or their friends. `/user/[id]` shows the profile (`get_profile`), friend actions, and for friends/self: tiles (workouts, week streak, this week, total volume), the 12-week chart (Phase 5's WeeklyCard), top exercises with best set and est. 1RM (`get_profile_exercises`), and their workouts (`get_feed(..., only_owner)`). Names and avatars in the feed and friends list open profiles.
- **Photos v2**: up to 10 per workout in `workout_photos` (server-only, online). The original file is kept; each row stores a normalised crop rectangle that is applied when drawing (`CroppedImage`), so re-cropping is lossless and can be done any time from the summary (tap a photo → Crop). `/photo-crop` crops to any ratio (drag corners, drag to move, Free / Original / 1:1 / 4:5 / 16:9) and steps through several new photos. The feed shows them as a swipeable carousel. `workouts.photo_path` was migrated and dropped; sync now pushes only the listed columns, so stray fields on old device rows can't break an upload.
- **Comments** (`20261127120000_comment_likes_history.sql`): comments can be liked (`comment_likes`, visible exactly when the comment is, via `private.can_view_comment`). `get_feed` carries the 10 most recent comments with likes; each card shows one under Like/Comment, swiped sideways for the next. The Comment button opens a bottom sheet (`CommentsSheet`) with every comment and a box that only opens the keyboard when tapped; the full workout page uses the same comment rows (`get_comments`).
- **Feed card layout**: duration sits on the title row (right); stats are Exercises · Sets · Volume; Like and Comment are white (accent when liked).
- **Friend exercise charts**: tapping an exercise on a profile drops down a line chart over time (Weight = heaviest set, Reps = most reps, Est. 1RM) from `get_profile_exercise_history`; the Top exercises header opens `/user/exercises/[id]`, every exercise they have done (searchable) with the same drop-downs.
- **Photo size** (2026-11-27): photos are scaled to 1080 px on the long side and saved as JPEG (~40-80 KB) on the device before upload (expo-image-manipulator). Full camera originals (3000×4000) decode to ~48 MB each and made the app use ~370 MB more memory (845 MB vs 475 MB on the feed); after the change the feed measured 562 MB. Memory cost depends on pixel size, not file size. The carousel only loads the photo in view and its neighbours. EthanJG's 5 existing photos were shrunk the same way; their originals are kept at `<owner>/<workout>/originals/` in the bucket. The dev build (debug JS over Metro) uses far more memory and CPU than a release build will.
- **Like/Comment row**: icons only, left-aligned, with the count beside each (1.2K style) when there is one.
- **Test bot**: LiftBot (password chosen by the user) has ~10 weeks of push/pull/legs history, is friends with EthanJG, and had an open workout for testing the LIFTING ring (it stops showing after 6 hours).
- **Tab bar is custom** (`src/components/ui/tab-bar.tsx`): React Navigation's BottomTabBar draws each icon twice in opacity wrappers, and on Android (Fabric) a tab switch after finishing or discarding a workout crashed with "addViewAt: … already has a parent". Don't swap it back. Realtime channels get a unique name per subscription (reusing a name returns a still-subscribed channel and throws).
- New native modules this phase: expo-image-picker, expo-sharing, react-native-view-shot (Android dev build rebuilt). Not yet: profile photos (avatars are initials), push notifications, viewing a friend's profile page.

### 7.4 Phase 7 notes (2026-11-27)
- **Build**: `npm run build:web` = `expo export -p web` then `scripts/build-sw.mjs`, which writes `dist/sw.js` (precache list + version hash of every file) and `dist/_headers` (CSP with the Supabase origin from `EXPO_PUBLIC_SUPABASE_URL`, no-cache on `/`, `sw.js` and the manifest, immutable on `/_expo/static/*` and `/assets/*`). `npm run preview:web` builds and serves it with `wrangler dev` (Cloudflare's own runtime, no login needed).
- **Service worker** is hand-written (no Workbox dependency): it precaches the whole app (~4.6 MB, 57 files) into a cache per version and never touches Supabase requests. Pages are served from the newest complete cache, so the page and the per-screen code files it loads on demand always match. (A network-first page once ran ahead of the cache: in airplane mode, Finish opened the summary screen, its newer code file wasn't cached, and the app froze.) A new version installs and takes over at once; the previous version's cache is kept so pages still running it can load their files. The shell is cached as `/` because Cloudflare redirects `/index.html` to `/` and Safari refuses redirected page responses. Only production builds register it (`__DEV__` skips it).
- **Updates**: when a new version takes over, `src/components/pwa/pwa-layer.tsx` shows "New version available · Reload" (reload only on tap; an active workout is stored on the device). The app checks for a new version each time it returns to the foreground. A root `ErrorBoundary` (`src/components/app-error.tsx`) shows "Something went wrong · Reload" instead of a blank screen.
- **Also in the PWA layer**: the iPhone/iPad "Install EasyLift" guide (Share → Add to Home Screen; shown in the browser only, until closed), Screen Wake Lock while a workout is active, and `navigator.storage.persist()`. The native app gets a no-op `pwa-layer.native.tsx`.
- **HTML shell** is `public/index.html` (output "single" uses it, not `+html.tsx`): manifest, apple-touch-icon, `viewport-fit=cover` for the notch, status bar style, theme colours and a dark/light body background so there's no white flash. Icons (`public/icons/`) come from `scripts/web-icons.mjs` (orange dumbbell on #0A0A0A, maskable versions inside the safe circle). The Android launcher icon is still the Expo default until Phase 8.
- **iPhone Home Screen layout** (fixed 2026-11-27 with an on-screen debug panel, since removed): (1) the status bar is `black`, not `black-translucent`; with translucent, iOS drew the app under the clock and battery and left an equal gap at the bottom. (2) Expo Router's web `SafeAreaProvider` always reports 0 insets, so the tab bar sat under the home bar; `src/components/pwa/safe-area.tsx` (`WebSafeArea`, wrapping the root layout) reads `env(safe-area-inset-*)` and provides the real values (34 pt bottom on a 402×874 iPhone). (3) `html`/`body` are `position: fixed` with `overscroll-behavior: none` so a swipe can't drag the whole page. Measured on the iPhone: screen 874 pt, status bar 62 pt, app area 812 pt.
- **Offline feed**: the TanStack Query cache for feed, friends, profiles, posts, comments and notifications is saved on the device (`@tanstack/react-query-persist-client` + sync storage persister, same storage as the session, 7 days, per account), so these show offline with an "Offline · showing the feed from your last visit" note. Photos still need a connection.
- **Steppers on touch web**: react-native-web waits 50 ms before `onPressIn` on touch, so quick iPhone taps on the −/+ buttons were lost (they have no `onPress`). They spread `pressInNow` (`delayPressIn: 0`).
- **Text fields** hide the browser's blue focus outline (they draw their own orange border).
- **No per-screen code splitting on web** (`expo-router` plugin `asyncRoutes: { web: false }` in app.json): each screen's code loading on first visit left a blank frame between screens, and offline it could be missing. Everything is in one 2.8 MB script now.
- **Starting a workout** opens `/workout/active?start=1[&routine=<id>]` and that screen creates the workout in a layout effect. Creating it first made the Workout tab redraw ("In progress" card, bar) for a frame before the workout screen.
- **Stepper field width**: on web an `<input>` has a wide built-in width; at the stepper's font size it covered the − button, so tapping − focused the field. The field is now `width: 100%` of its column.
- **Five tabs** (2026-11-27): Feed, Calendar, Workout, Statistics, Profile. Calendar (`(tabs)/calendar.tsx`, month grid, week streak, day's workouts) and Statistics (`(tabs)/stats.tsx`, every logged exercise with its best, opening its PRs and charts) replaced the two tiles on Profile; the old `/calendar` and `/exercises/all` screens moved into the tabs.
- **Custom exercises** need only a name; main muscle and equipment are optional (tap a selected chip to clear it). Where they're missing, nothing is shown instead of "Other".
- **30-day change** (`recentChange` in `src/lib/progress.ts`, tested): heaviest weight (most reps for bodyweight exercises) in the latest session of the last 30 days vs the last session before the window (else the window's first). Shown on every Statistics row and on the exercise screen as a green / red / grey (0 %) badge (`components/progress/change-badge.tsx`). The Statistics tab opens with a "Most improved · last 30 days" card: the biggest gain and its chart.
- **Calendar extras**: `get_calendar(from, to)` (migration `20261127150000_calendar.sql`, SECURITY INVOKER, same visibility rule as the feed, max 100 days, RLS-tested) returns your and your friends' finished workouts, with the first photo on your own only. "Friends" shows a coloured dot per friend under each day they trained (tap a friend chip to hide them) and lists them under the chosen day. Days where you added a photo get a white underline; the first tap shows a small preview above the day, the second opens the post. Saved for offline like the feed.
- **Fixed**: the post screen ("Can't load this workout") failed for every post since comment likes were added: embedding `profiles` from `comments` became ambiguous (PGRST201). The post query no longer fetches comments (the screen loads them via `get_comments`).
- **Fonts** are imported per weight (`@expo-google-fonts/barlow/400Regular` etc.). Importing the package root bundled all 36 weights (~3.8 MB) into the web build.
- **Verified** in headless Chrome against `wrangler dev`: service worker installs and controls the page, no CSP errors, sign-in and the feed work, with the server stopped and Supabase blocked the app still opens signed in (profile and charts from the device copy), a rebuilt version shows the banner and Reload switches to it and deletes the old cache, and the iPhone guide appears for an iPhone user agent. The in-app browser pane can't register service workers, so use Chrome for these checks.
- **CI**: `.github/workflows/ci.yml` runs typecheck, lint and Vitest on pushes to main and on pull requests.
- **Left for the user**: connect the repo in Cloudflare (Workers → Create → Import a repository; name `easylift`; build command `npm run build:web`; deploy command `npx wrangler deploy`; build variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), then install it on an iPhone and test airplane mode.

### 7.5 Phase 8 notes (2026-11-27)
- **Icons + splash**: `scripts/web-icons.mjs` now also writes the Android icon (`assets/images/icon.png`, adaptive foreground / background #0A0A0A / monochrome for themed icons, the dumbbell scaled into the 66 dp safe circle) and `splash-icon.png` (the mark alone, 120 dp on #0A0A0A).
- **Version**: `app.config.ts` extends app.json; a release passes its tag as `APP_VERSION` and `versionCode` = major·10000 + minor·100 + patch (v0.1.0 → 100, v0.1.1 → 101). Without it, app.json's `version` is used.
- **Signing**: `plugins/with-release-signing.js` adds a `release` signing config that reads `EASYLIFT_KEYSTORE`, `EASYLIFT_KEYSTORE_PASSWORD`, `EASYLIFT_KEY_ALIAS`, `EASYLIFT_KEY_PASSWORD` from the environment when Gradle runs (nothing secret is written into the project). Without them a release build falls back to the debug key. The release key (PKCS12, RSA 4096, alias `easylift`, valid 100 years) is at `C:\Users\Cerea\EasyLift-release-key\` with its password and base64 copy; **back that folder up offline**.
- **APK size**: only `armeabi-v7a` and `arm64-v8a` are built (expo-build-properties `buildArchs`), not the x86 emulator ABIs.
- **Release workflow** (`.github/workflows/android-release.yml`): on a `v*.*.*` tag it runs typecheck/lint/tests, restores the keystore from secrets, `expo prebuild -p android --clean`, `gradlew assembleRelease`, checks that the APK isn't debug-signed and that versionName matches the tag, then publishes a GitHub Release (auto-generated notes) with `EasyLift-<version>.apk` and the fixed-name `EasyLift.apk`. Needs repo secrets `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` and repo variables `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **In-app updater** (Android only; `src/lib/updates.android.ts`, pure parts in `updates-core.ts` with tests): on launch and on returning to the app (at most every 6 h, not in dev builds, not during a workout) it reads `releases/latest` from the GitHub API; if the tag is newer than the installed version, an "Update available" sheet shows the version, size and release notes. Update downloads the APK into the cache with progress (`expo-file-system`) and opens Android's installer with a content URI (`expo-intent-launcher`, `REQUEST_INSTALL_PACKAGES`). Android asks to allow installs from EasyLift the first time, then to confirm. Profile has an "EasyLift 0.1.0 · Check for updates" row.
- **Switching the phone from the dev build**: the dev build is signed with the debug key, so the first release APK can't install over it; uninstall the dev build first (sync first so nothing on the device is lost). Afterwards every release installs over the previous one. To keep developing, the debug build can't be installed alongside it without a different package name.

**Per-screen definition of done** (Appllama + UI UX Pro Max combined): light/dark, safe areas, empty/loading/error/long-content states, 44px targets, large text, reduced motion respected, motion checked in an emulator screen recording, works offline.

**Testing:** Vitest for pure logic (1RM, PRs, unit conversion, sync merge), Maestro flows on the Android emulator for the workout loop, Playwright (WebKit) for the PWA, and SQL tests for RLS.

---

## 8. Decisions (2026-11-26)
1. Appllama: free plan, design skill only; research skill skipped (optional one-month Pro later).
2. Android: build and install directly on the user's USB-connected phone; no Play Store for now.
3. Name **EasyLift**; PWA at `https://easylift.cerealgudforu.workers.dev` (Worker set up later by the user).
4. Social feed is in v1 and **friends-based** (requests/accept; no public posts).
5. Login is **username + password only**, no email; the admin resets forgotten passwords by hand (friends-and-family app).
7. Research: public sources plus a live walkthrough of the installed Hevy (free tier) and Fitbod (hard paywall, so only its onboarding and paywall are visible) on the user's phone. Gaps are filled from store screenshots and help docs.
6. **GitHub is the source of all builds:** APKs go to GitHub Releases with an in-app updater; the PWA auto-deploys to Cloudflare on push to `main`.
