# LifeaLauncher — The Complete Build Prompt

> Paste everything below the line into your coding agent (Claude Code, Cursor, Codex…).
> Start from the `agent-5` source (`cravewhoo/lifealauncher-agent1-shells`) or this repo, and keep `BUG_REPORT.md`
> open next to it. Bug IDs like P0-1 and P1-3 refer to that report.
> This one prompt covers everything: fixing every bug, a premium blood-red redesign, top-tier performance, and the
> Lunar Client / Dawn feature set (in-game mod, cosmetics, friends, Microsoft login).

---

## Who you are and what "done" means

You are a senior Electron + Minecraft-launcher engineer who has shipped clients like Lunar, Feather/Dawn and Prism.
You are building **LifeaLauncher**, a Windows-first (also macOS and Linux) Minecraft Java client.
- **Look:** Dawn's clean, modern layout with a subtle pixel flavour, in **blood-red**.
- **In-game:** what people expect from Lunar Client and Dawn (built-in performance, HUD mods, zoom, freelook,
  cosmetics, friends, one-click profiles).
- **Launcher:** what Prism does (any version, any loader, Modrinth, modpacks).

Five earlier agents each said "done" because TypeScript compiled. In reality the packaged app never opened and
Minecraft never launched. You must make it **actually work**, **look premium** and **feel instant**.

Rules you never break:

1. **Compiling is not done.** Something is done only when all of these hold:
   - `npm run check` (types + lint + unit tests) is green;
   - you built the **packaged** app (`npm run pack`), started it, and used the feature;
   - for anything touching launch, Minecraft reached the title screen, with the proof lines pasted:
     `Setting user:`, `Backend library: LWJGL`, `Created: … minecraft:textures/atlas/…`.
2. **Verify field names against live data.** Before coding against Mojang, Fabric, Quilt, Modrinth, Adoptium or
   Microsoft JSON, fetch a real response, save it to `test/fixtures/`, and write the parser and its unit test against
   that fixture. Never code an API from memory.
3. **No dead UI.** Every visible control does something. If a feature isn't built, the control doesn't exist. No stubs,
   no "coming soon".
4. **One source of truth** for IDs and constants: `src/shared/constants.ts` (theme IDs, routes, IPC channels,
   defaults) and `src/shared/schemas.ts` (zod), imported by main, preload and renderer.
5. **Never block the main process:** no `execSync`, `readFileSync` or `writeFileSync` in IPC handlers or hot paths.
   Use async fs, streams and `worker_threads` for hashing and unzipping.
6. **Small commits** named after what they fix (`fix(P0-6): download client jar and add to classpath`), plus a short
   `WORKLOG.md` entry for each meaningful chunk.
7. **Legal and fair play:** download game files from Mojang at runtime and never bundle them. Mods come from Modrinth
   with attribution. **No cheats** (no reach, killaura, x-ray, autoclicker, or anything that breaks server rules).
   Don't copy Lunar's or Dawn's names, logos, art or code; take feature ideas and layout patterns only. Cosmetic art
   is original.
8. **Never put binaries in git.** Installers go to GitHub Releases or workflow artifacts.

Whenever you report progress, include: **changed files**, **how you verified** (commands, output excerpts, screenshot
paths), **performance numbers** where relevant, and **known gaps**.

---

## Repository layout

```
/          Electron launcher (main / preload / renderer)
/mod       lifea-core — Fabric mod (Gradle + Fabric Loom, Java 21, Mixin)
/server    Lifea backend — Fastify + PostgreSQL (SQLite for dev/tests)
/e2e       Playwright _electron tests against the packaged app
/test      Vitest unit tests + fixtures
```

---

## Stack, build and boot (fixes P0-1 … P0-5)

**Stack:** Electron 30+, React 18 + TypeScript strict, Vite 5, Tailwind 3, Zustand, TanStack Query, lucide-react,
skinview3d, zod, p-limit. Dev tools: vitest, @playwright/test, eslint + @typescript-eslint +
eslint-plugin-react-hooks.

**Scripts:**
```json
"check": "tsc --noEmit && tsc -p tsconfig.electron.json --noEmit && eslint . && vitest run",
"build": "tsc --noEmit && vite build",
"pack":  "npm run build && electron-builder --dir",
"dist":  "npm run build && electron-builder",
"e2e":   "playwright test",
"analyze": "vite build --mode analyze"
```
`tsc -p tsconfig.electron.json` is for type checking only. It must not emit a second copy into `dist-electron/src`.

**Main and preload are CommonJS.** `package.json` keeps `"type": "module"` for the renderer, so emit main/preload as
`.cjs`. Otherwise `__dirname` is undefined in main (P0-2), and Electron refuses the ESM preload, leaving
`window.lifea` undefined (P0-3):
```ts
electron([
  { entry: 'src/main/index.ts',
    vite: { build: { outDir: 'dist-electron/main',
      rollupOptions: { external: ['electron'], output: { format: 'cjs', entryFileNames: '[name].cjs' } } } } },
  { entry: 'src/preload/index.ts', onstart({ reload }) { reload(); },
    vite: { build: { outDir: 'dist-electron/preload',
      rollupOptions: { external: ['electron'], output: { format: 'cjs', entryFileNames: '[name].cjs', inlineDynamicImports: true } } } } },
]),
```
- `"main": "dist-electron/main/index.cjs"`, `preload: join(__dirname, '../preload/index.cjs')`.
- Check `head -1` of both bundles: it must show `"use strict"` / `require(`, never `import`.
- `contextIsolation: true`, `nodeIntegration: false`, **`sandbox: true`**, `v8CacheOptions: 'bypassHeatCheck'`.

**Settings never depend on settings (P0-1).** Settings live at `app.getPath('userData')/settings.json`, a fixed path.
`gameDir()` = `settings.gameDir || ~/.lifea` and only *reads* the cached settings, so there are no cycles.
- Validate with zod.
- A corrupt file is backed up as `settings.corrupt-<ts>.json` and reset to defaults with a toast.
- Writes are atomic (`.tmp` + `rename`), debounced 300 ms in main, and **merge** patches. The old shared renderer
  debounce dropped earlier patches.
- Migrations: hyphen theme IDs → underscore IDs, `dataDir` → `gameDir`.
- A unit test proves `ensureGameDirs()` returns on an empty userData folder.

**Serve the renderer from a custom protocol (P0-4, P0-5):**
```ts
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
// after ready:
const distRoot = join(app.getAppPath(), 'dist');
protocol.handle('app', (req) => {
  const { host, pathname } = new URL(req.url);
  const base = host === 'wardrobe' ? join(gameDir(), 'wardrobe') : distRoot;
  const file = normalize(join(base, decodeURIComponent(pathname)));
  if (!file.startsWith(base + sep)) return new Response('Forbidden', { status: 403 });
  return net.fetch(pathToFileURL(existsSync(file) ? file : join(distRoot, 'index.html')).toString());
});
win.loadURL(isDev ? 'http://localhost:5173' : 'app://lifea/index.html');
```
- Vite `base: './'`. All public assets go through an `asset('scenes/…')` helper. A grep for `src="/`, `` `/scenes``,
  `` `/sprites``, `'/icons` or `'/skins` in `src/` must return nothing.
- Fonts are bundled locally (`@fontsource/inter`, `@fontsource/jetbrains-mono`, Monocraft). No Google Fonts.
- CSP: `default-src 'self' app:; img-src 'self' app: data: https://cdn.modrinth.com https://textures.minecraft.net https://mc-heads.net; connect-src 'self'`.
  All network goes through main. Local SVG instance icons replace `placehold.co`.

**Crash-proof startup:**
- Create the window first (`show:false`, `backgroundColor:'#0b0607'`, show on `ready-to-show`).
- Then run bootstrap (dirs, default profiles, Java scan, updater). Each step gets its own try/catch and sends an
  `app:error` banner instead of killing the app.
- `uncaughtException` / `unhandledRejection` go to `userData/logs/main.log` (rotating 5×1 MB).
- The renderer has a top-level ErrorBoundary ("Something broke" + Copy report + Reload).
- If `window.lifea` is missing, show a full-screen diagnostic, not an empty UI.

**Security:**
- Validate every IPC payload with zod in main.
- `setWindowOpenHandler` opens http/https externally and denies everything else.
- `will-navigate` is blocked except for the app origin.
- No generic `openPath(anyString)` on the bridge. Folder-opening IPCs take an instance ID and resolve the path in main.

---

## Launch engine — `src/main/game/` (fixes P0-6 … P0-10, P1-6, P1-7)

One module per concern, each unit-tested against fixtures. Using `@xmcl/core` + `@xmcl/installer` is allowed, but
every point below must still hold.

**Downloads (`download.ts`), used by everything:**
- Stream `net.fetch` → `dest.part` through an in-stream SHA-1 hash, check size and hash, then `rename`.
  Never `Buffer.from(await res.arrayBuffer())` for big files.
- Skip when the file exists and the size matches. Full hash check only on a size mismatch or "Repair".
- 3 retries with backoff (0.5 / 1.5 / 4 s). A bad hash deletes the `.part`.
- One shared `p-limit` pool, default **24**, configurable 4–64 in Settings → Downloads.
- Every call takes an `AbortSignal`, so Cancel works in every phase.
- Progress aggregates files and bytes, is throttled to **≤ 1 event / 100 ms**, and includes MB/s (3 s average) and ETA.

**Versions (`versions.ts`):**
- Manifest `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`, cached 1 h, with the cache used offline.
- Version JSONs go in `versions/<id>/<id>.json`, SHA-1 checked against the manifest.
- `resolveVersion(id)` follows `inheritsFrom` recursively:
  - child libraries come first, de-duplicated by `group:artifact[:classifier]` (child wins);
  - the child's `mainClass` wins;
  - `arguments` are parent + child;
  - `assetIndex`, `downloads` and `javaVersion` are inherited when missing.
- The New Profile version picker is populated from this manifest (releases by default, a snapshots toggle, search).
  No hard-coded list.

**Client jar (P0-6):** `downloads.client` → `versions/<id>/<id>.jar` (SHA-1), appended **last** on the classpath.
Test: the 1.21.4 classpath ends with `versions/1.21.4/1.21.4.jar`.

**Libraries and natives (P0-8):**
- Rules: `os.name` (`windows`/`osx`/`linux`), **`os.arch`** (`x86`, `arm64`), `os.version` regex, `features`. Allow
  when there are no rules. The last matching rule wins.
- Artifact: `downloads.artifact`. Otherwise use the Maven path from `name` + the library `url` (Fabric) or
  `https://libraries.minecraft.net/`.
- Legacy natives: `natives[os]` (replace `${arch}` with 32/64) → `downloads.classifiers[key]`.
- Modern natives (`…:natives-windows`, `-arm64`, `-x86`): keep only the one matching `process.arch`.
- Extract natives in a worker thread (respect `extract.exclude`, always skip `META-INF/`) to `versions/<id>/natives/`.
  Both `${natives_directory}` and `-Djava.library.path` point there.

**Assets (P1-7):**
- Index → `assets/indexes/<id>.json`; objects go through the shared pool.
- Targets: 1.21 fresh **< 60 s at 100 Mbps**; re-launch check **< 2 s**.
- Legacy: if `map_to_resources`, copy to `<instance>/resources/`; if `virtual`, copy to `assets/virtual/legacy/`.

**Java runtimes (P0-7):**
- Required major = `javaVersion.majorVersion ?? 8`; use `runtimes/<major>/` if present.
- Otherwise download from the Mojang runtime manifest
  `https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json`.
  Platform keys: `windows-x64`, `windows-arm64`, `mac-os`, `mac-os-arm64`, `linux`. The component comes from
  `javaVersion.component`. Files are SHA-1 checked; set the exec bit on posix.
- Fallback: Adoptium `https://api.adoptium.net/v3/binary/latest/<major>/ga/<os>/<arch>/jre/hotspot/normal/eclipse`.
- Use `javaw.exe` on Windows.
- A per-profile override is allowed. Probe `java -version` with async `execFile`, and warn in red on a major-version
  mismatch.

**Arguments (P0-9):**
- Order: `arguments.jvm` (legacy default `-Djava.library.path=${natives_directory} -cp ${classpath}`) with full rule
  evaluation → `-Xmx`/`-Xms` → user JVM args → `mainClass` → `arguments.game` or legacy `minecraftArguments`.
- Templates: `auth_player_name, auth_uuid, auth_access_token, auth_xuid, clientid, user_type (msa|legacy),
  user_properties, version_name, version_type, game_directory, assets_root, game_assets, assets_index_name,
  natives_directory, library_directory, classpath, classpath_separator, launcher_name, launcher_version,
  resolution_width, resolution_height, quickPlayPath, quickPlayMultiplayer, quickPlaySingleplayer`.
  An unknown variable is a logged warning, never a silent empty string.
- Features: `has_custom_resolution`, `is_quick_play_multiplayer` / `_singleplayer`. Never demo.
- User JVM args are parsed **shell-style**, never split on spaces.
- GC presets by Java version:
  - **17/21:** `-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=50 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15`.
    Option: "Generational ZGC (Java 21, 16 GB+ RAM)": `-XX:+UseZGC -XX:+ZGenerational`.
  - **8:** `-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M`.
  - `-Xms = -Xmx` only with AlwaysPreTouch, else half. Risky flags only behind an "Advanced" toggle.

**Loaders (P0-10):**
- **Fabric:** `GET https://meta.fabricmc.net/v2/versions/loader/{mc}` (first `loader.stable`), then
  `…/loader/{mc}/{loader}/profile/json`. Save it as `versions/fabric-loader-{loader}-{mc}/…json` and launch it through
  `inheritsFrom`. The old `launcher_meta` code is deleted.
- **Quilt:** same pattern via `https://meta.quiltmc.org/v3/versions/loader/{mc}/{loader}/profile/json`.
- **Forge / NeoForge:** run the official installer headless with the managed Java (`--installClient <dir>`, with a
  `launcher_profiles.json` stub). Launch the version ID it creates, and stream the installer output to the console.
- `.mrpack` profiles launch with whatever loader they declare.

**Process (`launch.ts`, P1-6):**
- One `LaunchJob` per profile with states `idle → preparing → downloading → launching → running → exited | crashed | cancelled`.
  A second start is rejected ("Already running").
- Spawn with `cwd = instanceDir`, `windowsHide: true`.
- stdout/stderr are read line by line with log4j levels parsed, **batched to the renderer every 50 ms** (≤ 500 lines),
  and also written to `instance/logs/launcher-<ts>.log`.
- `running` on `/Setting user:|Backend library:|LWJGL Version/`, or after 15 s alive.
- Cancel aborts the job's controller. A running game gets `child.kill()`, then `taskkill /pid <pid> /T /F` on Windows
  after 5 s.
- Launcher behaviour setting: on game start **hide** (default), minimize or stay open; restore on exit. While the
  game runs, the renderer pauses all animation and polling.
- Fabric profiles managed by Lifea get `lifea-core` injected plus `-Dlifea.bridge.port=<p> -Dlifea.bridge.token=<t>`.

**Crash helper (`crash.ts`):** on a non-zero exit, scan the last 300 lines + the newest `crash-reports/*.txt` for
known patterns. Show a plain-English banner with a one-click fix where possible. Patterns:
- `UnsupportedClassVersionError` → switch Java;
- `requires … fabric-api` → install it;
- `OutOfMemoryError` / `Could not reserve enough space` → adjust RAM;
- `GLFW error 65542` → GPU driver;
- duplicate/incompatible mod lines.

---

## Accounts

- **Microsoft login:** OAuth 2.0 auth-code + PKCE in a popup `BrowserWindow` (or device code). Chain: MSA → Xbox Live
  → XSTS → `login_with_xbox` → entitlement check → profile.
  - Tokens are encrypted with `safeStorage` and refreshed before launch.
  - The client ID comes from `LIFEA_MSA_CLIENT_ID`. A new Azure app ID must be **approved by Mojang** before the
    Minecraft API accepts it, so the UI says so plainly and offline mode keeps working.
- **Offline accounts:** name `^[A-Za-z0-9_]{3,16}$`, UUID = `md5("OfflinePlayer:"+name)` as v3,
  `user_type=legacy`, labelled "Offline". The hard-coded `LifeaPlayer` is gone (P1-8).
- Account switcher in the rail. The avatar head comes from the profile skin (2D canvas crop, not three.js).
- Skin changer: upload a PNG or pick from the library. For MSA accounts, set it on the real profile
  (`POST /minecraft/profile/skins`, slim/classic).

---

## Profiles, Modrinth and content

- **Built-in profiles**, always present and auto-updated: **Lifea 1.21** (latest supported), **Lifea 1.20.1**,
  **Lifea PvP 1.8.9**. Each is Fabric + performance pack + `lifea-core`.
- **User profiles:** any version, any loader (vanilla, Fabric, Quilt, Forge, NeoForge), or any Modrinth modpack
  (search, or import `.mrpack`). Duplicate, export `.mrpack`, delete with a confirm modal that names the profile.
- **Selected profile** is stored as `selectedInstanceId`. Home PLAY launches it; the PLAY caret is the switcher.
- **Modrinth install (P1-2):**
  - always filter `game_versions=[profile.version]` and `loaders=[profile.loader]` (shaders: `iris`/`optifine`;
    resource packs: `minecraft`);
  - newest `release`, else `beta`;
  - resolve **required** dependencies recursively (skip ones already installed by project ID), and warn on `incompatible`;
  - mods into a vanilla profile are blocked, with a "Convert to Fabric" action;
  - card states: Install → Installing → Installed ✓ / Update available, derived from the profile's files, not session memory;
  - Update-all via `POST /v2/version_files/update` (hash lookup);
  - LRU cache (5 min) + respect `X-Ratelimit-*` / `Retry-After`;
  - User-Agent `LifeaLauncher/<version> (github.com/<owner>/<repo>)`.
- **Modpacks:** Browse → Modpacks → Install downloads the `.mrpack` and uses the importer. The importer stream-unzips
  with `yauzl` in a worker, verifies SHA-1/SHA-512, guards against path traversal, and applies `overrides/` and
  `client-overrides/`. The useless "modpack slug" wizard step is removed (P1-10).
- **Content tabs (P1-4):** Mods / Resource Packs / Shaders / Worlds (from `saves/*/level.dat` + last played) /
  Screenshots / Logs.
  - Toggle = rename `x.jar` ↔ `x.jar.disabled`.
  - "Add file" picker + drag-and-drop, copied to the right folder.
  - `fs.watch` (debounced) picks up manual changes.
  - Multi-select enable/disable/delete/update.
- **Folder buttons (P1-3)** call `instances:open-folder(id, sub?)`.
- **Per-profile settings:** Java (auto or override), RAM (system-aware recommendation
  `min(max(2, floor(totalGB × 0.35)), 8)` GB, up to 10 GB for big packs, never > 50 % of RAM), resolution, JVM args,
  pre-launch command, "launch into server".
- **"Optimize this profile":** installs the version-correct performance set (Sodium, Lithium, FerriteCore,
  EntityCulling, ImmediatelyFast, ModernFix, Dynamic FPS, MoreCulling, + Fabric API) and shows the list first.
- **Servers:**
  - SRV lookup (`_minecraft._tcp`), `[ipv6]:port`, Server List Ping;
  - coloured MOTD from chat components, favicon, ping bars, player count;
  - add/edit/reorder, synced to each profile's `servers.dat` (`prismarine-nbt`);
  - **Join** launches with `--quickPlayMultiplayer`;
  - pings refresh every 60 s only while visible.
- **Wardrobe (P1-5):**
  - thumbnails and viewer use `app://wardrobe/…`; skin selection drives `skinUrl`, cape selection drives `capeUrl`
    (never the skin PNG);
  - PNG validation (skins 64×64 / 64×32, capes 64×32);
  - import picker, slim/classic toggle.
- **Screenshots** gallery across profiles (open, copy, delete).

---

## Design — premium, dark, blood-red

It should feel like a paid client, keeping LifeaLauncher's identity: blood-red accents, ember highlights, a subtle
pixel touch in headings and the parallax scenes.

**Tokens** (`tokens.css`, mirrored in `tailwind.config.ts`):
```css
:root{
  --bg-0:#0b0607; --bg-1:#110a0c; --bg-2:#181013; --bg-3:#21151a; --bg-4:#2b1b21;
  --line:#2e1c22; --line-strong:#3d252d;
  --text-1:#f6eef0; --text-2:#bfa9ae; --text-3:#7f666c;
  --accent:#e11d2e; --accent-hi:#ff3b4a; --accent-lo:#9b0f1c; --accent-glow:rgba(225,29,46,.40);
  --ember:#ff6a2b; --success:#3ddc84; --warning:#ffb020; --danger:#ff4d5e; --info:#5aa9ff;
  --r-sm:6px; --r-md:10px; --r-lg:14px; --r-xl:20px;
  --shadow-1:0 1px 0 rgba(255,255,255,.03) inset,0 4px 14px rgba(0,0,0,.35);
  --shadow-2:0 1px 0 rgba(255,255,255,.04) inset,0 12px 32px rgba(0,0,0,.55);
  --ease:cubic-bezier(.2,.8,.2,1); --dur-1:120ms; --dur-2:180ms; --dur-3:260ms;
}
```
- Text meets WCAG AA (4.5:1) on `--bg-2`.
- Accent presets: Crimson `#e11d2e`, Blood `#8b0000`, Ruby `#c2185b`, Scarlet `#ff2400`, Ember `#ff6a2b`, plus a
  custom picker that rejects colours under 3:1 contrast on `--bg-0`.
- Type: Inter 12/13/14/16/20/28/40 (tabular numbers for stats). Monocraft only for the wordmark, page titles and
  percentages. 4 px spacing grid, content max-width 1200 px, page padding 32 px (24 compact).
- Icons: lucide, 1.75 stroke, 18 px nav / 16 px inline.

**Window chrome:**
- Frameless window, min **1100×680**.
- **Title bar (40 px):** logo + "LIFEA" (Monocraft); centre `Ctrl+K` command-palette trigger; right side has the
  download ring + count, the update indicator, and min/max/close (close turns `--danger` on hover).
- **Icon rail (72 px):** Home, Library, Browse, Boost, Wardrobe, Friends, Servers, Screenshots, Console, Settings.
  - Active item: 3 px accent bar, accent icon, `--bg-3` fill.
  - Tooltips after 200 ms.
  - Account avatar at the bottom with a presence dot and the account menu.
- **Right Friends drawer (300 px):** collapsible, usable from any page (like Lunar's social panel).
- **Route change:** 180 ms fade + 6 px rise, keeping scroll position per route.

**Home:**
- Full-bleed parallax scene with a left-to-right scrim (`--bg-0` 85 % → transparent).
- Hero bottom-left:
  - profile icon (56 px) + name (Monocraft 40);
  - chips (version, loader, mod count, last played);
  - **PLAY**, 64×300 px, accent → accent-lo gradient, inner highlight, glow ring on hover, 0.98 press, attached 64 px
    caret for the profile switcher.
- While working, PLAY morphs into a same-size progress bar: phase label,
  `1 234 / 4 012 · 38.2 MB/s · 0:41 left`, Monocraft %, and a Cancel link.
- While running: "Playing · 12:41" + Stop.
- Only one progress UI is ever shown (the toast appears only on other pages).
- Right column: Servers (favicon, coloured MOTD, ping, Join), Recent worlds (Quick Play), News (JSON feed from the backend).
- Character animation controls are a small pill in the bottom-right that auto-hides.

**Library and Profile detail:**
- Cards 280×120 (icon, name, chips, mods, last played). Hover lifts 2 px and shows Play + ⋯ (Duplicate, Export, Open
  folder, Delete).
- Detail page: banner header + Play, then tabs (Content · Worlds · Screenshots · Logs · Settings).
- Content tab: segmented Mods / Packs / Shaders, search, sort, multi-select toolbar. Rows show icon, name, version,
  source badge, toggle and ⋯.

**Browse:**
- Left filters: type, categories, loader, version, sort.
- 3–4 column grid with infinite scroll and skeletons.
- Cards: icon, title, author, 2-line description, downloads/follows, chips, and an Install split-button pre-set to the
  selected profile, disabled with a reason when incompatible.
- Project modal: gallery, sanitised markdown body, versions, dependencies.

**Cosmetics / Wardrobe:**
- 3D skinview3d preview (drag-rotate, idle/walk/emote, front/back, slim/classic).
- Categorised grid: Capes, Wings, Hats, Bandanas, Pets, Emotes, each with Equip / Equipped.

**Friends:** presence ("In launcher", "Playing 1.21.4 on play.example.net", "Offline"), requests, DMs, Join, party invites.

**Boost:**
- Score ring labelled **"Setup score"**, animated once.
- System cards: RAM, CPU, GPU (`app.getGPUInfo('basic')`), Java.
- Real before/after FPS from `lifea-core`, a suggestions list with one-click install, and a RAM recommendation marker.

**Console:**
- JetBrains Mono 12.5, virtualised list, coloured level gutter.
- Sticky toolbar: level filter, search with match count, Wrap, Auto-scroll, Copy, Upload to mclo.gs, Open logs.
- Crash banner pinned on top.

**Settings:**
- Sections: General, Appearance, Java, Accounts, Downloads, Advanced, About.
  - General: language, launch behaviour, close-to-tray.
  - Appearance: theme, accent, animation, reduced motion, UI zoom via `webContents.setZoomFactor`, never a CSS
    transform.
  - Java: managed runtimes per major version, override.
  - Downloads: parallelism.
  - Advanced: game folder, clear caches, logs.
  - About: `app.getVersion()`, update check, licences.
- Changes save instantly with a quiet "Saved" tick.

**Everywhere:**
- Skeleton loading. Empty states get a pixel illustration, one sentence and a primary action. Errors get a red inline
  card with Retry + Copy details.
- Toasts in the bottom-right: max 3, 4 s, optional action.
- `:focus-visible` ring 2 px `--accent-hi` with 2 px offset. Full keyboard support: `Esc` closes modals, `Ctrl+K`
  palette (profiles, pages, settings, actions).
- `prefers-reduced-motion` disables parallax, morphs and glows.
- Themes: `blood_dunes`, `ember_night`, `ash_oasis`, `emberstorm` (P1-1: same IDs in settings and on disk).
- A dev-only `/showcase` route shows every component in every state.

---

## Performance — top notch, measured

Measure before and after, and report a table. Budgets for the packaged app on a mid-range laptop:

| Metric | Budget |
|---|---|
| Cold start → window visible | **< 800 ms** |
| Cold start → Home interactive | **< 1.5 s** |
| Initial renderer JS (gzip) | **< 250 KB**; route chunks < 120 KB |
| Idle CPU on Home with animation | **< 3 %**; **0 %** when hidden or while the game runs |
| Idle RAM (all processes) | **< 250 MB** |
| Page switch | **< 100 ms**, no dropped frames |
| Console, 20 000 lines | 60 fps scroll; append 1 000 lines/s smoothly |
| 1.21 assets, fresh / re-launch | **< 60 s** at 100 Mbps / **< 2 s** |
| PLAY → game window (cached) | **< 6 s** on SSD |

How:
- **Startup:**
  - window first, everything else after `ready-to-show`;
  - routes via `React.lazy` with idle preloading of Library/Browse;
  - **skinview3d/three.js** loaded only on Wardrobe;
  - named lucide imports (verify with the bundle visualizer);
  - local WOFF2 fonts with `font-display: swap`.
- **Renderer:**
  - Zustand selectors + `shallow`, with launch progress in its own tiny store so only the bar re-renders;
  - Console uses a fixed-size circular buffer (no array copy per line) + `@tanstack/react-virtual` + `useDeferredValue` filtering;
  - TanStack Query: sensible `staleTime`, `refetchOnWindowFocus:false`, everything paused while the game runs or the
    window is hidden;
  - memoised rows; 250 ms debounced search with stale requests cancelled via request IDs;
  - lazy, fixed-size images;
  - animate only transform/opacity; `backdrop-filter` only on small cards and only when GPU compositing is available.
- **Background canvas:**
  - WebP scenes (lossless) decoded with `createImageBitmap`, layers pre-scaled once per resize,
    `imageSmoothingEnabled=false`;
  - 30 fps time accumulator, stopped entirely when hidden, blurred > 10 s, off Home, game running, or reduced motion;
  - parallax on rAF; preallocated particle pool (≤ 120); `ResizeObserver`; DPR ≤ 2; **< 2 ms/frame**.
- **Main process:**
  - streamed downloads with in-stream hashing;
  - unzip and SHA-512 in `worker_threads` (never `unzipSync` on main);
  - progress throttled to 100 ms, logs batched at 50 ms;
  - Modrinth LRU cache; no sync IO on hot paths.
- **In-game:** GC presets above, "Optimize this profile", the launcher hides and idles while you play, and `lifea-core`
  adds no per-frame allocations.

---

## In-game features — `lifea-core` Fabric mod (`/mod`)

Gradle + Fabric Loom, Java 21, Mixin. It targets **1.21.4** first, then 1.20.1 and Legacy Fabric 1.8.9.
The launcher injects it into Lifea-managed Fabric profiles.

- **Mod menu** (Right-Shift) styled like the launcher (dark, blood-red), with a searchable grid of modules, each with a
  toggle and options.
- **HUD editor:** drag, snap-to-grid, scale, colour, background on/off; layout saved per profile in
  `config/lifea/hud.json`.
- **HUD modules:** FPS · CPS (L/R) · Keystrokes (WASD + mouse + space) · Ping · Coordinates + facing + biome · Armor
  status · Potion effects · Held-item durability · Clock · Server address · Memory · Speed · Combo counter · Saturation ·
  Day counter · Pack display · Scoreboard tweaks.
- **Quality of life (server-safe):**
  - Zoom (C, smooth, scroll to adjust);
  - Freelook (hold Alt; turns itself off on servers that signal they disallow it);
  - Toggle sprint/sneak with an indicator; crosshair editor; hit colour; block outline colour/width;
  - fullbright; client-side time/weather; chat tweaks (timestamps, stacking, longer history, copy);
  - nametag tweaks; particle multiplier;
  - waypoints + death waypoint; screenshot uploader to the launcher gallery;
  - 1.7 animations (1.8.9 build).
- **Launcher bridge:** a WebSocket to `127.0.0.1:${lifea.bridge.port}` authenticated with `${lifea.bridge.token}`.
  It sends FPS averages / 1 % lows for Boost, screenshot events and presence ("Playing on X").
- **Cosmetics:** fetch equipped cosmetics for nearby players (batch lookup, cached) and render capes, wings, hats,
  bandanas and pets with the mod's own model renderer. Players without Lifea see nothing (same as Lunar).
  An emote wheel (B) is synced over the backend WebSocket.
- **Social overlay:** friends list, presence, DMs, join friend, party invites.
- No module may give a gameplay advantage beyond what major servers allow.

---

## Backend — `/server`

Node 20 + Fastify + zod. PostgreSQL in production, SQLite for dev/tests, with migrations. Dockerfile + README.
- **Auth:** the client proves account ownership with its Minecraft access token. The server calls
  `https://api.minecraftservices.com/minecraft/profile` once and issues its own short-lived JWT. Mojang tokens are
  never stored server-side.
- **REST:** `GET /health`, `GET /news`, `GET /featured-servers`, `GET /cosmetics/catalog`, `GET/PUT /me/cosmetics`,
  `POST /cosmetics/lookup` (batch of UUIDs → equipped), `GET /friends`, `POST /friends/requests`,
  `POST /friends/requests/:id/accept`, `DELETE /friends/:uuid`.
- **WebSocket `/realtime`:** presence, DMs, emotes, party invites.
- Rate limiting, input validation, CORS locked down, nothing stored beyond UUID + username.

---

## Packaging, updates and hygiene

- `electron-builder`:
  - `asar: true`, no `asarUnpack` for art, `compression: maximum`;
  - per-user NSIS without elevation, plus DMG and AppImage;
  - signing via `CSC_LINK` / `CSC_KEY_PASSWORD`, documented in the README.
- `electron-updater` with the GitHub provider: check on start and every 6 h, background download, "Restart to update"
  in the title bar.
- Delete dead code: Agent 1 HTML shells, `src/mock`, `docs-agent-4/`, the old `ipc` stub, and the workflow step that
  commits the `.exe`. Purging old binaries from git history needs `git filter-repo` + a force-push, and only with the
  owner's permission.
- README: install steps, data locations, troubleshooting (Java, antivirus, GPU drivers), build and sign, licences
  (Monocraft OFL, Modrinth attribution).

---

## Tests and CI

- **Unit (Vitest), with fixtures:**
  - rules (os/arch/features), `inheritsFrom` merge, classpath ends with the client jar;
  - natives filtering by arch, argument templating (no unknown variables), shell-style arg parsing;
  - Fabric/Quilt profile parsing, Modrinth version filtering + dependency resolution;
  - settings migration + corruption recovery, crash patterns;
  - SRV / MOTD parsing, `servers.dat` round-trip, offline UUID.
- **E2E (Playwright `_electron`, packaged app):**
  - the window loads `app://lifea/index.html` and `typeof window.lifea === 'object'`;
  - the background canvas has drawn and switching theme changes it;
  - every route renders with no `console.error` / `pageerror`;
  - settings persist across restarts.
- **Integration (CI with network):** launch vanilla 1.21.x and Fabric 1.21.x under `xvfb-run`. The process must stay
  alive 20 s and log `Setting user:`.
- **Server:** API + WebSocket tests on SQLite. **Mod:** `gradle build`.
- **GitHub Actions** matrix windows / macos / ubuntu: `npm ci → npm run check → npm run pack → npm run e2e`, plus mod
  build and server tests. Installers are uploaded as artifacts / Release assets only.

---

## Acceptance checklist (every box needs proof)

- [ ] `npm run check` green; CI green on Windows, macOS and Linux; Playwright passes on the **packaged** app.
- [ ] Fresh Windows VM with **no Java**: install → open → offline account → PLAY vanilla 1.21.4 → title screen.
- [ ] 1.8.9, 1.12.2, 1.16.5, 1.20.1, Quilt 1.20.1, NeoForge 1.21.1 → title screen.
- [ ] Fabric 1.21.4 + "Optimize this profile" → title screen with Sodium and `lifea-core` loaded; Right-Shift opens
      the red mod menu; the HUD editor saves positions.
- [ ] `.mrpack` import and Browse → Modpack → Install both create profiles that launch.
- [ ] Modrinth installs pick version- and loader-correct files and pull required dependencies.
- [ ] Cancel works while downloading and while running; double-launch is blocked.
- [ ] All four themes render; Wardrobe shows the chosen skin and cape; folder buttons open the right folders.
- [ ] Microsoft login works with an approved client ID; offline mode works without one.
- [ ] Two Lifea clients see each other's equipped cape and presence through the backend.
- [ ] No dead buttons (the final report lists every control and what it does).
- [ ] Performance table filled, every budget met (or each miss explained with a plan).
- [ ] No binaries in git; installers on Releases; auto-update tested N-1 → N.
- [ ] `BUG_REPORT.md` has every ID marked **Fixed in <commit>**.

Final report: a table of **Bug ID | Status | Commit | How verified**, the performance table, and screenshots of Home
(each theme), Library, Profile detail, Browse, Wardrobe, Friends, Console and Settings from the packaged app.
