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
- Exercise library: seeded from the public-domain dataset [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db) (check the license at import). Includes muscle-group/equipment filters and custom exercises.
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
- Sign-up form: username + password + confirm password. The client normalises the username (lowercase, `^[a-z0-9_.]{3,20}$`) and calls `signUp({ email: \`${username}@users.easylift.invalid\`, password, options: { data: { username } } })`. `.invalid` is a reserved TLD, so no mail can ever be sent. If Supabase's validator rejects it, use `@easylift.local`.
- Sign-in: username + password → same mapping → `signInWithPassword`.
- Supabase dashboard: **turn off "Confirm email"**, set minimum password length to 8 with leaked-password protection, and keep the sign-up rate limits.
- A trigger on `auth.users` insert creates `profiles` with `username UNIQUE` (citext). A `username_available(text)` RPC gives live "username taken" feedback.
- **No "forgot password" flow.** The app is for friends and family, so the admin resets passwords by hand. `scripts/reset-password.ts <username> <new-password>` runs locally with the service-role key from a git-ignored `.env.local` and calls `auth.admin.updateUserById`. The sign-in screen says "Forgot it? Ask the admin." Logged-in users can change their own password in Settings.
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
- Worker name `easylift` → **https://easylift.cerealgudforu.workers.dev** (you'll set this up later; a custom domain can be added after that). Add this URL to Supabase Auth's allowed site URLs. Supabase env vars set as build-time `EXPO_PUBLIC_*` (anon key only; never the service key).

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
- `versionName` comes from the tag and `versionCode` is computed from it (e.g. 1.2.3 → 10203) in `app.config.ts`. A higher versionCode plus the same signature lets updates install over the old version.
- Download link for users: `https://github.com/CerealGudForU/easylift/releases/latest/download/EasyLift.apk`. The workflow also uploads a fixed-name copy so this link never changes. Users allow "Install unknown apps" for their browser once.
- **In-app updater:** on launch (and in Settings → "Check for updates"), call `GET https://api.github.com/repos/CerealGudForU/easylift/releases/latest`, compare `tag_name` with the installed version, and show a "Update available, see what's new" sheet with the release notes. Tapping it downloads the APK with `expo-file-system` and opens the Android installer through an intent (`REQUEST_INSTALL_PACKAGES` permission). Android always asks the user to confirm; silent updates aren't possible outside the Play Store.
- Users can also add the repo to **Obtainium**, which tracks GitHub releases automatically.
- Optional later: `expo-updates` hosted on GitHub/Cloudflare for instant JS-only fixes without a new APK. Skip for v1 and keep native releases simple.

**PWA via Cloudflare from GitHub**
- Connect the repo in Cloudflare dashboard → Workers → `easylift` → **Settings → Builds → Connect to GitHub**. Build command `npx expo export -p web && node scripts/build-sw.mjs`, deploy command `npx wrangler deploy`. Every push to `main` deploys, and other branches get preview URLs.
- `wrangler.jsonc` in the repo: `assets.directory = "dist"`, `not_found_handling = "single-page-application"`.
- Build env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) are set in Cloudflare build settings. Both are safe to make public.
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
| 4 | **Core loop**: library → routine builder → active workout → summary → history | all | A full workout can be logged offline on Android and web and syncs |
| 5 | **Progress**: PRs, charts, calendar, per-exercise history | ui-ux-pro-max `--domain chart` | Charts readable, accessible, correct against fixtures |
| 6 | **Friends + feed**: username search, requests, feed, likes, comments, notifications, share card | all | Feed paginates; private/non-friend workouts never leak (RLS test) |
| 7 | **PWA + deploy**: manifest, SW, iOS install flow, Cloudflare connected to GitHub | — | Push to main → live at easylift.cerealgudforu.workers.dev; installed on a real iPhone, works in airplane mode |
| 8 | **Android release pipeline**: icons, splash, keystore, Actions release workflow, in-app updater | — | Tag v0.1.0 → APK on GitHub Releases → installs on your phone; tag v0.1.1 → the app offers the update and it installs over v0.1.0 |

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
