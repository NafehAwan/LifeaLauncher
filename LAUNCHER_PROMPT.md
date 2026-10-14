# Master Prompt — "LifeaLauncher": a red-themed Minecraft client in the style of Dawn + Lunar Client

> Copy everything below the line into your coding agent (Claude Code, Cursor, etc.).
> It is written to be used **on top of the existing `agent-5` codebase**, but works from scratch too.
> Read `BUG_REPORT.md` first: every P0 bug there must be fixed before any new feature.

---

## 0. Role and how to work

You are a senior desktop engineer who has shipped Minecraft launchers. You are building **LifeaLauncher**, a
Windows-first (also macOS/Linux) Minecraft Java client. It looks like Dawn's launcher (clean, dark, modern, a little pixel
flavour), but **red-themed**. It has the in-game feature set people expect from Lunar Client and Dawn: built-in
performance, HUD mods, zoom, freelook, cosmetics, friends, and one-click profiles.

Rules for how you work:
1. **Nothing counts as done until you have run it.** "TypeScript compiles" is not done. For every milestone: build the
   packaged app, open it, click the feature, and (for launch features) start Minecraft and reach the title screen.
   Paste the log lines that prove it.
2. Work in the milestone order in §10. Commit after each milestone, with a short changelog entry in `WORKLOG.md`.
3. Don't hand-roll Minecraft launch internals from memory. Follow the real Mojang version-JSON spec and the
   Fabric meta API, or use a maintained library (`@xmcl/core` + `@xmcl/installer` are recommended). Verify every
   field name against a live API response before you code against it.
4. Never leave a button with no handler. If a feature is not built yet, hide it. Don't show a dead control.
5. Keep one source of truth for IDs (themes, routes, settings keys) in `src/shared/constants.ts`, imported by the
   main process, preload and renderer.
6. Legal and safety: no cheats (no reach, killaura, x-ray, autoclicker or anything else that breaks server rules).
   Don't copy Lunar's or Dawn's names, logos, art or code; take the *feature ideas* and *layout patterns* only.
   Mod jars come from Modrinth with attribution. Don't redistribute Mojang's game files; download them from Mojang.

---

## 1. Tech stack (keep what exists, fix how it's built)

- **Electron 30+**, **React 18 + TypeScript (strict)**, **Vite 5**, **Tailwind 3**, **Zustand**, **TanStack Query**, `lucide-react`, `skinview3d`.
- Build the **main process and preload as CommonJS** (`.cjs` output) so `__dirname` and `require` work. Keep the
  renderer as ESM. Set Vite `base: './'`.
- Serve the renderer in production through a custom privileged protocol, `app://lifea/`, registered with
  `protocol.handle`. That also serves `app://lifea/wardrobe/<file>.png` from the user's data folder for skins and capes.
  Don't use absolute `/…` asset paths anywhere.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (the preload uses only `contextBridge` + `ipcRenderer`).
  Validate every IPC argument in main with `zod`.
- Settings live at `app.getPath('userData')/settings.json`, a fixed path. Game data lives at `settings.gameDir ?? ~/.lifea`.
  Settings must never depend on themselves (this was bug P0-1).
- Packaging: `electron-builder` NSIS (Windows), DMG (macOS), AppImage (Linux), plus `electron-updater` pointed at GitHub
  Releases. Never commit binaries to git.

---

## 2. Visual design: "Dawn layout, blood-red skin"

### 2.1 Design tokens (`src/styles/tokens.css`, one file)
```
--bg-0:  #0b0607   (window / deepest)
--bg-1:  #120a0c   (sidebar)
--bg-2:  #1a0f12   (cards)
--bg-3:  #24151a   (raised / hover)
--line:  #2e1a20   (1px borders)
--text-1:#f5ecee   --text-2:#b9a3a8   --text-3:#7a6268
--red-500:#e11d2e  (primary accent)      --red-400:#ff3b4a (hover)
--red-700:#9b0f1c  (pressed / deep)      --red-glow: rgba(225,29,46,.45)
--ember:  #ff6a2b  (secondary accent, used sparingly: progress shimmer, "new" dots)
--success:#3ddc84  --warning:#ffb020  --danger:#ff4d5e
radius: 6px (controls) / 10px (cards) / 14px (hero)
shadow-card: 0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px rgba(0,0,0,.45)
```
- Fonts: **Inter** for UI and **Monocraft** for pixel headings, bundled locally. No Google Fonts CDN, so the app works offline.
- Motion: 150–200 ms ease-out; respect `prefers-reduced-motion`. The primary button gets a subtle red glow pulse on hover only.
- Every surface uses the tokens. Accent color is user-configurable, but the default and all presets are reds
  (Crimson, Blood, Ruby, Scarlet, Ember).

### 2.2 Window chrome
- Frameless window, min **1100×680**, with a custom 40 px title bar: logo + "LIFEA" wordmark on the left, then
  minimize/maximize/close (close turns red on hover). The title bar is draggable (`-webkit-app-region: drag`).
- **Left icon rail (72 px)**, Dawn/Lunar style: Home, Profiles, Mods, Cosmetics, Friends, Servers, Screenshots,
  Settings. The active item gets a red 3 px left bar and a red-tinted icon. Tooltips on hover.
- **Bottom-left**: account avatar (3D head from the skin) + username + online dot. Clicking it opens the account switcher.
- **Right drawer (collapsible, 300 px)**: Friends list with presence. It can stay open on any page, like Lunar's social panel.

### 2.3 Home screen (the hero)
- Full-bleed animated background, chosen per theme: the existing pixel parallax scenes (fix the IDs) plus
  1–2 dark cinematic red scenes, with a soft vignette.
- Left-aligned hero: selected **profile name**, MC version + loader chips, and a big **PLAY** button (red,
  64 px tall, 300 px wide) with a **version/profile dropdown** caret attached on its right, as in Lunar.
- Under PLAY: a one-line status ("Ready", "Downloading 1 234 / 4 012 files · 38 MB/s", "Running · 12:41").
  It turns into an inline progress bar while preparing. Show **one** progress UI, not two.
- Below that: **News carousel** (3 cards, from a JSON feed you host) and **Featured servers** (cards with live ping,
  player count, MOTD and a "Join" button that launches straight into the server via `--quickPlayMultiplayer`).
- "Jump back in" row: the last 4 profiles and the last 3 worlds (Quick Play singleplayer).

### 2.4 Other screens
- **Profiles**: grid of profile cards (icon, name, version, loader, playtime, mod count). Create / duplicate / delete /
  export `.mrpack` / import `.mrpack`. Profile detail has tabs for Mods, Resource Packs, Shaders, Worlds, Screenshots,
  Logs and Settings (RAM, Java, resolution, JVM args, pre-launch command).
- **Mods (in-launcher, Lunar style)**: a grid of built-in **Lifea mods** (§4), each a card with icon, toggle and gear
  for options. There's also a "Modrinth" tab to browse mods, packs, shaders and resource packs. Install is **filtered to
  the profile's MC version + loader** and resolves required dependencies.
- **Cosmetics**: 3D `skinview3d` preview (drag-rotate, walk/idle/emote animations, front/back) on the left and a
  categorised grid on the right (Capes, Wings, Hats, Bandanas, Pets, Emotes) with Equip / Equipped states.
- **Friends**: list with presence ("In launcher", "Playing 1.21.4 on play.example.net", "Offline"), friend requests,
  DMs, "Join" button when the server is joinable.
- **Servers**: saved servers with ping via SRV lookup + Server List Ping. Add / edit / reorder. They're synced to the
  profile's `servers.dat` so they also appear in-game.
- **Screenshots**: gallery of every profile's `screenshots/`, with open, copy and delete.
- **Settings**: General (language, launch behaviour: hide / minimize / keep open, close-to-tray), Appearance
  (theme, accent, background animation, reduced motion, UI zoom via `webContents.setZoomFactor`), Java (auto-managed
  runtimes listed per major version, custom path override, default RAM slider with a system-RAM-aware recommendation),
  Accounts, Downloads (parallel downloads, mirror), Advanced (game folder, clear caches, open logs), About (version,
  update check, licences).
- **Console**: live game log, level filter, search, copy, "Upload log" (mclo.gs), and an auto-detected crash reason
  banner (e.g. "Wrong Java version", "Mod X requires Fabric API").

---

## 3. Launcher core (it must actually launch)

Implement as `src/main/game/` with these modules, each unit-tested:

1. **Version manifest**: `piston-meta.mojang.com/mc/game/version_manifest_v2.json`, cached 1 h, with filters for
   releases and snapshots. The version picker is populated from here, not a hard-coded list.
2. **Version JSON resolver**: supports `inheritsFrom` (merge child onto parent: libraries concatenated, child
   `mainClass` wins, `arguments.game`/`jvm` concatenated).
3. **Client jar**: download `downloads.client` → `versions/<id>/<id>.jar`, SHA-1 verified, appended **last** on the classpath.
4. **Libraries**: full rule evaluation (os name, **os arch**, features). Download `artifact` and, for legacy versions,
   `classifiers[natives[os]]`. Pick only natives that match `process.arch` (x64 / arm64 / x86).
5. **Natives**: extract native classifier jars (respect `extract.exclude`) to `versions/<id>/natives-<hash>/` and
   pass that path to both `-Djava.library.path` and `${natives_directory}`.
6. **Assets**: asset index → objects, **parallel pool of 24**, SHA-1 verified, retry with backoff. For legacy
   `virtual`/`map_to_resources` indexes, copy objects to the right folder. Throttle progress IPC to ≤10 events/s.
7. **Java runtimes**: read `javaVersion.majorVersion`. Download the matching runtime automatically (Mojang
   `java-runtime` manifest, or Adoptium API v3 Temurin JRE) to `runtimes/<major>/`, verify it, and cache it. A user
   override is allowed but warns if the major version mismatches.
8. **Arguments**: build from `arguments.jvm` + `arguments.game` (or legacy `minecraftArguments`) with full rule
   evaluation and **all** template variables (`natives_directory`, `launcher_name`, `launcher_version`, `classpath`,
   `classpath_separator`, `library_directory`, `version_type`, `auth_xuid`, `clientid`, `user_type`,
   `quickPlay*`…). Add `-Xmx`/`-Xms` from the profile and `-XstartOnFirstThread` on macOS (comes from the rules).
9. **Loaders**:
   - **Fabric**: `GET https://meta.fabricmc.net/v2/versions/loader/{mc}/{loader}/profile/json`, saved as
     `versions/fabric-loader-{loader}-{mc}/…json` and resolved through `inheritsFrom`.
   - **Quilt**: same pattern via `meta.quiltmc.org/v3`.
   - **Forge / NeoForge**: run the official installer headlessly (`--installClient`, or use `@xmcl/installer`), then
     resolve the produced version JSON.
10. **Process**: spawn with `cwd = profile dir`. Stream stdout/stderr line by line and parse log4j levels. State
    machine: `idle → preparing → downloading → launching → running → exited|crashed`. Keep one running game per
    profile. Make **Cancel** work in every phase, using an `AbortController` passed into every download.
11. **Crash helper**: on non-zero exit, scan the last 300 lines and `crash-reports/` for known patterns and show a
    human sentence plus a "Fix it" button where possible (switch Java, install Fabric API, lower RAM).

Acceptance: a fresh Windows VM with **no Java installed** can install the app, sign in, and launch **vanilla 1.21.x,
Fabric 1.21.x, Fabric 1.20.1, vanilla 1.8.9 and 1.12.2** to the title screen.

---

## 4. In-game features (Lunar Client / Dawn feature parity)

These need code inside the game. Build them as **one Fabric mod, `lifea-core`**, in a `mod/` folder of this repo
(Gradle + Fabric Loom, Java 21, Mixin). The launcher injects it into every Fabric profile it manages (and into the
built-in "Lifea PvP" profiles). Targets: 1.21.x first, then 1.20.1, then a Legacy Fabric build for 1.8.9 (the PvP
crowd's version).

### 4.1 Performance (installed automatically into Lifea profiles, versions resolved from Modrinth)
Sodium, Lithium, FerriteCore, EntityCulling, ImmediatelyFast, ModernFix, Dynamic FPS, MoreCulling, Krypton (where
compatible), plus Iris for shaders. The **Boost** page shows real before/after numbers: `lifea-core` reports average
FPS and 1 % lows per session over local IPC (a localhost WebSocket opened by the launcher, with a token passed via
a system property).

### 4.2 HUD mods (each draggable in a **HUD editor** opened with Right-Shift, snap-to-grid, scale, colour, background
toggle; layout saved per profile)
FPS · CPS (left/right) · Keystrokes (WASD + mouse + space) · Ping · Coordinates + direction + biome · Armor status ·
Potion effects · Held-item durability · Clock / real-time · Server address · Memory usage · Speed (blocks/s) ·
Reach display (purely informational) · Combo counter · Saturation · Day counter · Pack display · Scoreboard tweaks
(scale / hide numbers / move).

### 4.3 Gameplay quality-of-life (allowed on major servers)
Zoom (C, smooth, scroll to adjust) · Freelook / perspective mod (hold Alt; disable automatically on servers that send
the standard "disallow freelook" signal) · Toggle sprint / toggle sneak with HUD indicator · Custom crosshair editor ·
Hit colour · Block outline colour/thickness · 1.7 animations (for 1.8.9) · Motion blur · Fullbright (gamma) ·
Time changer (client-side) · Weather changer (client-side) · Item physics (cosmetic) · Chat tweaks (timestamps,
copy, stacking duplicates, infinite history) · Nametag tweaks · Particle multiplier · Waypoints (with death waypoint) ·
Screenshot uploader (to the launcher gallery) · Auto-GG / Auto-text hotkeys · Mod menu (Right-Shift) styled to match
the launcher's red theme.

### 4.4 Cosmetics (Lunar/Dawn style, safe version)
- A **Lifea Cosmetics API** (small backend, §5) stores which cosmetics each Minecraft UUID has equipped.
- `lifea-core` fetches equipped cosmetics for nearby players and renders capes, wings, hats, bandanas and pets with
  its own model renderer. Players **without** Lifea see nothing extra (same as Lunar).
- Emotes: a radial wheel (B key), synced to other Lifea players via the backend's WebSocket.
- Cosmetic textures are original art made for this project, in the red/ember style. Nothing ripped from other clients.

### 4.5 Social (in-game overlay)
Friends overlay (the same friends as the launcher), presence ("Playing on X"), DMs, join-friend, party invites. Uses
the same backend WebSocket.

---

## 5. Backend (`server/`, small, self-hostable)

Node 20 + Fastify + PostgreSQL (or Supabase), deployed separately.
- **Auth**: the client proves account ownership with the Minecraft access token. The backend calls
  `api.minecraftservices.com/minecraft/profile` once and issues its own short-lived JWT. Never store Mojang tokens server-side.
- **Endpoints**: `GET /cosmetics/catalog`, `GET/PUT /me/cosmetics`, `POST /cosmetics/lookup` (batch of UUIDs → equipped),
  `GET /news`, `GET /featured-servers`, friends CRUD, `WS /realtime` (presence, DMs, emotes, party).
- Rate limiting, input validation, and no PII beyond UUID + username.

---

## 6. Accounts

- **Microsoft login**: OAuth 2.0 auth-code + PKCE in a popup `BrowserWindow`, or the device-code flow. Chain:
  MSA → Xbox Live → XSTS → `login_with_xbox` → entitlement check → profile. Tokens are stored encrypted with
  Electron `safeStorage`, with refresh on launch.
  *Note: a new Azure app ID must be approved by Mojang (minecraft-services app review form) before the Minecraft
  API accepts it. Build the flow, document the env var `LIFEA_MSA_CLIENT_ID`, and fall back to offline mode with
  a clear banner until approval.*
- Multiple accounts with a quick switcher. Offline accounts are allowed for singleplayer, with a chosen username, and
  are labelled "Offline". The skin shown in the launcher comes from the profile (`textures.minecraft.net`).
- Skin changer: upload a PNG or pick from the library and set it on the real Mojang profile
  (`POST /minecraft/profile/skins`) for MS accounts. The library is stored locally and served via `app://`.

---

## 7. Profiles (Dawn-style "one click")

- Built-in, always-present profiles: **Lifea PvP 1.8.9**, **Lifea 1.21 (latest)**, **Lifea 1.20.1**. Each is Fabric +
  performance pack + `lifea-core`, created on first run and updated automatically when a new `lifea-core` ships.
- User profiles: any version, any loader, any Modrinth modpack (search, or import `.mrpack`). A modpack page offers
  "Install" → profile created → PLAY.
- Mods tab: toggle (renames `.jar` ↔ `.jar.disabled`), update-all (Modrinth hash lookup
  `POST /v2/version_files/update`), and drag-and-drop a jar in. Dependencies are resolved; incompatible loader/version
  is blocked with a reason.
- Per-profile Java, RAM, resolution, JVM args, game dir and "launch into server" option.

---

## 8. Quality bar

- Lighthouse-style budget for the renderer: first paint < 1 s, no layout shift on Home, 60 fps scrolling, background
  canvas ≤ 5 % CPU and paused when the window is hidden or the game is running.
- Every list has loading / empty / error states. Every async action has a toast for success and failure, with the
  error text and a "Copy details" button.
- Keyboard: full tab order and visible red focus ring. `Ctrl+K` command palette (jump to a profile, page or setting).
- i18n-ready strings (`i18next`), English first.
- Logs: launcher log at `userData/logs/launcher.log`, rotating, linked from Settings → Advanced.
- Crash safety: `process.on('uncaughtException')` and renderer error boundaries show a "Something went wrong" screen
  with "Copy report" instead of a white window.

---

## 9. Tests and CI (this is what would have caught every agent-5 bug)

- **Unit (Vitest)**: rule evaluation, argument templating, `inheritsFrom` merge, natives filtering by arch, Modrinth
  version filtering, settings migration. Fixtures are real saved JSON from Mojang and Fabric.
- **Integration**: download + launch vanilla 1.21.x and Fabric 1.21.x headlessly in CI. Assert the process stays
  alive for 20 s and the log contains `Setting user:` / `Backend library: LWJGL`. Use `xvfb-run` on Linux.
- **E2E (Playwright `_electron`)**: launch the **packaged** app; assert the window shows, `window.lifea` exists, Home
  renders the background image (natural width > 0), the theme switch changes the image, Settings persist across restart.
- GitHub Actions matrix: windows-latest, macos-latest, ubuntu-latest. Build installers as **Release artifacts** only.
- `npm run check` = `tsc` (both projects) + ESLint + Vitest. Required before every commit.

---

## 10. Milestones (do them in order and demo each one)

1. **Boot fix**: fix P0-1…P0-5 and P1-1 from `BUG_REPORT.md`. Packaged app opens, art loads, `window.lifea` works. Add the Playwright smoke test.
2. **Launch core**: §3 for vanilla (client jar, natives, jvm args, auto Java). Vanilla 1.21.x and 1.8.9 reach the title screen.
3. **Loaders**: Fabric + Quilt via profile JSON, then Forge/NeoForge. Fabric 1.21.x with Sodium launches.
4. **Accounts**: MS login + offline accounts, account switcher, skin in the launcher.
5. **Redesign**: §2 shell, Home, Profiles, Settings in the red Dawn-style layout. Remove every dead button.
6. **Modrinth & profiles**: filtered install, dependency resolution, toggles, updates, `.mrpack` import/export, built-in Lifea profiles.
7. **`lifea-core` mod v1**: mod menu, HUD editor, FPS/CPS/Keystrokes/Armor/Potions/Coords, zoom, freelook, toggle sprint, crosshair.
8. **Backend + cosmetics + social**: capes/wings/hats, emotes, friends + presence + DMs in launcher and in game.
9. **Polish**: auto-update, crash helper, screenshots gallery, command palette, perf budget, code signing.

At the end of each milestone, reply with: what changed (files), how you verified it (commands + log excerpts +
screenshot paths), known gaps, and the next milestone's plan.
