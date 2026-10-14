# Master Fix Prompt — LifeaLauncher: fix every bug, redesign, top-tier performance

> Paste everything below the line into your coding agent (Claude Code, Cursor, Codex…), run it inside a clone of
> `cravewhoo/lifealauncher-agent1-shells` on branch `agent-5`, and keep `BUG_REPORT.md` open next to it.
> Bug IDs (P0-1, P1-3 …) refer to that report. This prompt **fixes and polishes the existing app**. New features like
> the in-game mod, cosmetics backend and Microsoft login are in `LAUNCHER_PROMPT.md` and come after this.

---

## 0. Role, rules, definition of done

You are a senior Electron + Minecraft-launcher engineer doing a **rescue and polish** pass on LifeaLauncher, a
red-themed Minecraft Java launcher (Electron 30, React 18, TypeScript strict, Vite 5, Tailwind 3, Zustand, TanStack
Query). Five previous agents each said "done" because TypeScript compiled. In reality the packaged app never opened
and Minecraft never launched. Your job is to make it **actually work**, **look premium** and **feel instant**.

Non-negotiable working rules:

1. **Compiling is not done.** A task is done only when you have:
   - (a) run `npm run check` (types + lint + unit tests), all green;
   - (b) built the **packaged** app (`npm run pack`), started it, and exercised the feature;
   - (c) for launch work, started Minecraft and seen the title screen, with the log lines pasted as proof
     (`Setting user:`, `Backend library: LWJGL`, `Created: 1024x1024x4 minecraft:textures/atlas/...`).
2. **Fix in phase order** (§1 → §8). Do not start the redesign while any P0 is open.
3. **One commit per bug or small group**, message `fix(P0-6): download client jar and add to classpath`. Append a
   short entry to `WORKLOG.md` per phase.
4. **Verify field names against live data.** Before coding against Mojang, Fabric, Modrinth or Adoptium JSON, fetch
   a real response, save it to `test/fixtures/`, and write the parser and its unit test against that fixture.
5. **No dead UI.** Every visible control does something. If a feature isn't built, remove the control. Don't stub it.
6. **One source of truth** for IDs and constants: `src/shared/constants.ts` (theme IDs, route paths, IPC channel
   names, default settings), imported by main, preload and renderer.
7. **No blocking the main process.** No `execSync`, `readFileSync` or `writeFileSync` inside IPC handlers or hot paths.
   Use async fs, streams and worker threads for hashing/unzipping large files.
8. Stay legal: download game files from Mojang at runtime, never bundle them. Mods come from Modrinth with
   attribution. No cheat features.

When you finish each phase, reply with:
- **Changed files**
- **How verified** (commands + output excerpts + screenshot paths)
- **Before/after metrics** (for §6)
- **Known gaps**

---

## 1. Phase 0 — Safety net first (so bugs can't sneak back)

Do this **before** fixing anything. It will fail at first, which is the point.

1. Add dev dependencies: `vitest`, `@playwright/test`, `eslint` + `@typescript-eslint` + `eslint-plugin-react-hooks`,
   `zod`, `p-limit`.
2. Scripts in `package.json`:
   ```json
   "check": "tsc --noEmit && tsc -p tsconfig.electron.json --noEmit && eslint . && vitest run",
   "pack": "npm run build && electron-builder --dir",
   "e2e": "playwright test"
   ```
   Remove the `tsc -p tsconfig.electron.json` emit from `build`. It writes an unused second copy to
   `dist-electron/src/...`. Keep it for `--noEmit` type checking only.
3. **Packaged smoke test** (`e2e/smoke.spec.ts`) using Playwright `_electron.launch({ executablePath: <release/*-unpacked/LifeaLauncher(.exe)> })`. Assert:
   - a window appears within 5 s and its URL is not `about:blank` / `chrome-error://`;
   - `await page.evaluate(() => typeof window.lifea)` equals `'object'`;
   - the Home background `<canvas>` has drawn (sample a pixel that isn't `#000000`), or the first scene `<img>` has `naturalWidth > 0`;
   - switching the theme in Settings changes the background;
   - no `console.error` and no `pageerror` events during the run.
4. CI (`.github/workflows/ci.yml`): matrix `windows-latest`, `ubuntu-latest` (with `xvfb-run`) and `macos-latest`.
   Run `npm ci` → `npm run check` → `npm run pack` → `npm run e2e`. Upload installers as **workflow artifacts / GitHub
   Release assets only**.
5. **Delete** the step in `windows-installer.yml` that commits the `.exe` into git. Delete `releases/*.exe` from the
   tree. Tell the user that purging it from history needs `git filter-repo` and a force-push, and that you won't do
   that without their permission.

---

## 2. Phase 1 — Make the packaged app boot (P0-1 … P0-5)

### 2.1 Build main + preload as CommonJS (P0-2, P0-3)
`package.json` keeps `"type": "module"` for the renderer, so emit main/preload with an explicit `.cjs` extension:

```ts
// vite.config.ts (electron entries)
electron([
  {
    entry: 'src/main/index.ts',
    vite: { build: { outDir: 'dist-electron/main',
      rollupOptions: { external: ['electron', 'electron-store'],
        output: { format: 'cjs', entryFileNames: '[name].cjs' } } } },
  },
  {
    entry: 'src/preload/index.ts',
    onstart({ reload }) { reload(); },
    vite: { build: { outDir: 'dist-electron/preload',
      rollupOptions: { external: ['electron'],
        output: { format: 'cjs', entryFileNames: '[name].cjs', inlineDynamicImports: true } } } },
  },
]),
```
- Set `"main": "dist-electron/main/index.cjs"` in `package.json`.
- In `createWindow`: `preload: join(__dirname, '../preload/index.cjs')`.
- **Verify:** `head -1 dist-electron/main/index.cjs` shows `"use strict"` / `require(`, **not** `import`. Same for preload.
- Turn on `sandbox: true`. The preload only uses `contextBridge` and `ipcRenderer`, which is allowed in sandboxed preloads.

### 2.2 Settings path must not depend on settings (P0-1)
Rewrite `src/main/store.ts`:
- `settingsFile = join(app.getPath('userData'), 'settings.json')`. This is fixed and never derived from settings.
- `gameDir()` returns `settings.gameDir || join(app.getPath('home'), '.lifea')`. Rename the setting
  `dataDir` → `gameDir`, with a migration.
- Build the store **once** at module load after `app.whenReady()`. `ensureGameDirs()` calls `gameDir()`, which calls
  `readSettings()`, which only reads the store. **No cycles.** Add a unit test that calls `ensureGameDirs()` with an
  empty userData folder and asserts it returns.
- Validate settings with a `zod` schema. If the file is corrupt, back it up to `settings.corrupt-<ts>.json`, reset to
  defaults, and show a toast. Never crash.
- Cache settings in memory. Writes are atomic (write `*.tmp` then `rename`) and debounced to 300 ms in **main**
  (fixes the renderer's single-debounce bug that dropped earlier patches: merge patches, don't replace them).

### 2.3 Serve the renderer through a custom protocol (P0-4, P0-5, wardrobe `lifea://`)
```ts
// before app.ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

// after ready
const distRoot = join(app.getAppPath(), 'dist');           // works inside app.asar
protocol.handle('app', (req) => {
  const { host, pathname } = new URL(req.url);
  const base = host === 'wardrobe' ? join(gameDir(), 'wardrobe') : distRoot;   // app://lifea/... or app://wardrobe/...
  const file = normalize(join(base, decodeURIComponent(pathname)));
  if (!file.startsWith(base + sep)) return new Response('Forbidden', { status: 403 });
  return net.fetch(pathToFileURL(existsSync(file) ? file : join(distRoot, 'index.html')).toString());
});
win.loadURL(isDev ? 'http://localhost:5173' : 'app://lifea/index.html');
```
- Vite `base: './'`. In the renderer, **never** write `/scenes/...`. Use a helper
  `asset('scenes/blood_dunes/sky.png')` → `${import.meta.env.BASE_URL}scenes/...`. Grep must return zero hits for
  `src="/` and `` `/scenes`` / `` `/sprites`` / `'/icons` / `'/skins` in `src/`.
- Bundle Inter + JetBrains Mono locally (`@fontsource/inter`, `@fontsource/jetbrains-mono`) and remove the Google
  Fonts links, so the app works offline and starts faster.
- Tighten the CSP: `default-src 'self' app:; img-src 'self' app: data: https://cdn.modrinth.com https://textures.minecraft.net https://mc-heads.net; connect-src 'self'`
  (all network goes through main). Remove `placehold.co` and use local SVG instance icons.

### 2.4 Crash-proof startup
- `createWindow()` runs **first**, with `show: false` and `backgroundColor: '#0b0607'`, shown on `ready-to-show`. Run
  `bootstrap()` work (dirs, Java detect, default profile) **after** the window exists, and make it non-fatal: wrap
  each step in try/catch, log it, and send an `app:error` event to show a banner.
- `process.on('uncaughtException' | 'unhandledRejection')` writes to `userData/logs/main.log` (rotating, 5×1 MB).
- Renderer: a top-level React `ErrorBoundary` with a red "Something broke" screen, "Copy report" and "Reload" buttons.
- `lib/ipc.ts`: if `window.lifea` is missing, render a full-screen diagnostic (not an empty UI), and log it loudly.

**Phase 1 exit:** the Playwright smoke test passes on all three OSes from the **packaged** build.

---

## 3. Phase 2 — Launch engine that really launches (P0-6 … P0-10, P1-6, P1-7, P1-8)

Rewrite `src/main/minecraft/` as `src/main/game/`, one module per concern, each with fixture-based unit tests.
(Alternative: adopt `@xmcl/core` + `@xmcl/installer`. Either way, all items below must hold.)

### 3.1 Download engine (`download.ts`), used by everything
- `downloadFile({ url, dest, sha1?, size?, signal })`: **stream** to `dest.part` with `net.fetch` + `Readable.fromWeb`
  piped through a `crypto.createHash('sha1')` passthrough, check size + hash, then `rename` to `dest`. Don't buffer whole
  files in memory.
- Skip a file if it exists **and** the size matches. Verify the hash only when the size differs or on "Repair".
- Retries: 3 tries with exponential backoff (500 ms, 1.5 s, 4 s). A failed hash deletes the `.part` file.
- Concurrency: one shared `p-limit` pool, default **24**, configurable 4–64 in Settings → Downloads.
- Every download takes an `AbortSignal`, so cancel works in **every** phase (P1-6).
- Progress: aggregate bytes + files across the job, and emit to the renderer **at most every 100 ms** (throttle). Also
  send speed (MB/s, 3 s moving average) and ETA.

### 3.2 Version resolution (`versions.ts`)
- Manifest `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`, cached 1 h. Fall back to the cache
  when offline.
- Version JSON saved to `versions/<id>/<id>.json` (verify `sha1` from the manifest entry).
- `resolveVersion(id)` follows `inheritsFrom` recursively and merges:
  - child libraries **first**, then parent, de-duplicated by `group:artifact[:classifier]` (child wins);
  - `mainClass` from the child;
  - `arguments.game` / `arguments.jvm` as parent + child;
  - `assetIndex`, `downloads` and `javaVersion` inherited when missing.

### 3.3 Client jar (P0-6)
Download `downloads.client` to `versions/<id>/<id>.jar` (SHA-1) and append it **last** on the classpath. Unit test:
the classpath for 1.21.4 ends with `versions/1.21.4/1.21.4.jar`.

### 3.4 Libraries + natives (P0-8)
- Rule evaluation supports `os.name` (`windows`/`osx`/`linux`), **`os.arch`** (`x86`, `arm64`), `os.version` regex,
  and `features`. Default allow if there are no rules. The last matching rule wins.
- Artifact: `downloads.artifact`. If it's missing, derive the Maven path and use the library's `url` (Fabric) or
  `https://libraries.minecraft.net/`.
- Legacy natives: `natives[osName]` with `${arch}` replaced by `32`/`64` gives the classifier key, then
  `downloads.classifiers[key]`.
- Modern natives (1.19+): artifacts named `…:natives-windows` / `natives-windows-arm64` / `natives-windows-x86`.
  Keep **only** the one matching `process.arch`.
- Extract native jars (respecting `extract.exclude`, always skipping `META-INF/`) to
  `versions/<id>/natives/` using `yauzl`/`fflate` in a **worker thread**. Re-extract if the folder is missing.
- `${natives_directory}` and `-Djava.library.path` both point there.

### 3.5 Assets (P1-7)
- Asset index → `assets/indexes/<id>.json`. Objects go through the shared pool (24 parallel). 1.21 has about 4 000
  objects; target **< 60 s on 100 Mbps**, and **< 2 s on re-launch** (size check only).
- Legacy indexes: if `map_to_resources` is set, copy to `<instance>/resources/`. If `virtual` is set, copy to
  `assets/virtual/legacy/`.

### 3.6 Java runtimes (P0-7)
- Required major = `resolved.javaVersion?.majorVersion ?? 8`.
- Look in `runtimes/<major>/` first. If it's missing, download from the **Mojang runtime manifest**
  `https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json`
  (platform key `windows-x64` / `windows-arm64` / `mac-os` / `mac-os-arm64` / `linux`, component from
  `javaVersion.component`). That manifest lists files with SHA-1; download them with the shared pool and set the
  executable bit on posix. Fallback is Adoptium:
  `https://api.adoptium.net/v3/binary/latest/<major>/ga/<os>/<arch>/jre/hotspot/normal/eclipse`.
- Use `javaw.exe` on Windows, so no console window pops up.
- User override per profile is allowed. Run `java -version` asynchronously (`execFile`, never `execSync`), parse the
  major version, and warn in red if it doesn't match.

### 3.7 Arguments (P0-9)
- Build JVM args from `arguments.jvm` (or the legacy default
  `-Djava.library.path=${natives_directory} -cp ${classpath}`), with full rule evaluation. Then add
  profile `-Xmx`/`-Xms` and user JVM args, then `mainClass`, then game args.
- Template map must include: `auth_player_name, auth_uuid, auth_access_token, auth_xuid, clientid, user_type
  (msa|legacy), user_properties ({}), version_name, version_type, game_directory, assets_root, game_assets,
  assets_index_name, natives_directory, library_directory, classpath, classpath_separator, launcher_name,
  launcher_version, resolution_width, resolution_height, quickPlayPath, quickPlayMultiplayer, quickPlaySingleplayer`.
  Unknown variables become a logged warning, not a silent empty string.
- `features`: `has_custom_resolution` true when the profile sets one; `is_quick_play_multiplayer` when launching
  into a server. Never set demo.
- **Never split user JVM args on spaces.** Parse them shell-style so quoted values with spaces survive.

### 3.8 Loaders (P0-10)
- **Fabric:** `GET https://meta.fabricmc.net/v2/versions/loader/{mc}` (pick the first `loader.stable`), then
  `GET https://meta.fabricmc.net/v2/versions/loader/{mc}/{loader}/profile/json`. Save it as
  `versions/fabric-loader-{loader}-{mc}/fabric-loader-{loader}-{mc}.json` and launch that ID through §3.2
  (`inheritsFrom` handles vanilla). Delete the old `launcher_meta` code.
- **Quilt:** same pattern with `https://meta.quiltmc.org/v3/versions/loader/{mc}/{loader}/profile/json`.
- **Forge / NeoForge:** download the official installer jar and run it headless with the managed Java
  (`--installClient <gameDir>`; it needs a `launcher_profiles.json` stub). Then launch the version ID it produced.
  Show the installer's output in the console.
- Imported `.mrpack` profiles now launch for every loader they declare.

### 3.9 Process + state machine (P1-6, P1-8)
- One `LaunchJob` per profile: `idle → preparing → downloading → launching → running → exited | crashed | cancelled`.
  Reject a second start for the same profile with a toast ("Already running").
- Spawn with `cwd = instanceDir`, `detached: false`, `windowsHide: true`.
- Logs: read stdout/stderr line by line and parse log4j XML/plain levels. **Batch** lines and send to the renderer
  every 50 ms (max 500 lines per batch). Also write `instance/logs/launcher-<ts>.log`.
- Mark `running` on the first line matching `/Setting user:|Backend library:|LWJGL Version/`, or after 15 s alive.
- Cancel: abort the job's `AbortController`. If the process is running, `child.kill()`, then on Windows
  `taskkill /pid <pid> /T /F` after 5 s (signals don't work there).
- Username / UUID come from the selected account. Add an **offline account** creation flow (validate the name
  `^[A-Za-z0-9_]{3,16}$`) with `user_type=legacy`. Remove the hard-coded `LifeaPlayer`.
- Launcher behaviour setting: on game start **hide** (default), **minimize** or **stay open**. Restore on exit. While
  the game runs, pause all renderer animation and stop background queries (see §6).
- **Crash helper:** on a non-zero exit, scan the last 300 log lines + the newest `crash-reports/*.txt` for known
  patterns (`UnsupportedClassVersionError`, `requires .* fabric-api`, `OutOfMemoryError`, `Could not reserve enough
  space`, `GLFW error 65542`, mod-conflict lines). Show a plain-English banner with a one-click fix where possible.

**Phase 2 exit, on a clean Windows VM with no Java:** vanilla **1.21.4**, **1.20.1**, **1.16.5**, **1.12.2**,
**1.8.9**, Fabric **1.21.4 + Sodium + Fabric API**, Quilt **1.20.1**, and NeoForge **1.21.1** all reach the title
screen. Paste the proof log lines for each. Cancel works during download and while running.

---

## 4. Phase 3 — Fix every remaining feature bug (P1 + P2)

| ID | Fix | Acceptance |
|---|---|---|
| P1-1 themes | Theme IDs live only in `constants.ts`: `blood_dunes, ember_night, ash_oasis, emberstorm`. Settings migration maps old hyphen IDs to the new ones. The canvas looks up layers by the same ID. | Each theme visibly renders in the packaged app (e2e screenshot per theme). |
| P1-2 Modrinth install | Install always passes `game_versions=[profile.version]` and `loaders=[profile.loader]` (shaders: `iris`/`optifine`, resourcepacks: `minecraft`). Pick the newest `release`, else `beta`. Resolve `dependencies` of type `required` recursively (skip ones already installed by project ID) and warn on `incompatible`. Block mod installs into vanilla profiles with the button "Convert to Fabric". Show per-card state: Install → Installing (spinner) → Installed ✓ / Update available. Work out installed state from the profile's files, not session memory. | Installing Sodium Extra into Fabric 1.21.4 also installs Sodium, both jars match 1.21.4. |
| P1-3 open folder | Add IPC `instances:open-folder(id, sub?)`. Main resolves the path and `shell.openPath`s it. Remove the generic `openPath(anyString)` from the bridge (security). | The button opens the right folder. |
| P1-4 toggles & tabs | Toggling renames `x.jar` ↔ `x.jar.disabled` and updates instance.json. The Resource Packs / Shaders / Worlds tabs list their real folders (worlds read from `saves/*/level.dat` name + last played). "Add file" opens a picker plus drag-and-drop onto the list, copied to the right folder. Use a watcher (`fs.watch`, debounced) so manual changes show up. | Disabled mod doesn't load in-game. Tabs show correct content. |
| P1-5 wardrobe | Thumbnails and viewer load `app://wardrobe/skins/<file>`. Skin selection feeds `ModelViewer.skinUrl`. Cape selection feeds `capeUrl`, and never the skin PNG. Validate PNG size (64×64 / 64×32 skins, 64×32 cape) before accepting. "Import skin" picker. Slim/classic model toggle. Remove the hard-coded `/skins/default.png`, except as the fallback. | Picking a skin/cape updates the 3D model instantly. |
| P1-6/7/8 | Covered in §3. | — |
| P1-9 friends | Until a backend exists: remove the fake presence UI and make it a local "Friends list" with avatars from `mc-heads.net` and username validation, **or** hide the page. No permanently "offline" dots. | No misleading status. |
| P1-10 modpack slug | Remove step 3 from the wizard. Modpacks install from Browse → Modpacks → "Install" (download the `.mrpack` and reuse the importer). | Installing a modpack from Browse creates a launchable profile. |
| Selected profile | Store `selectedInstanceId` in settings. Home PLAY launches it. The PLAY caret opens a profile switcher. Library cards get a "Select" action. | Selection persists across restart. |
| Version list | The wizard's version picker comes from the manifest (releases by default, toggle for snapshots), with a search box. Fabric/Quilt availability is checked live and incompatible loaders disabled. | 1.21.x latest appears without code changes. |
| Server ping | Resolve `_minecraft._tcp.<host>` SRV with `dns.promises.resolveSrv`. Support `[ipv6]:port`. Parse the MOTD from chat-component JSON (`extra[]`, colours) and render coloured text plus the favicon. Ping on view, refresh every 60 s only while the page is visible. "+ Add server" opens a modal (name, address) and syncs to each profile's `servers.dat` (NBT, using `prismarine-nbt`). | Hypixel-style address with SRV shows online + ping. |
| Boost | Use the selected profile's heap, not the global one. RAM recommendation: `min(max(2, floor(totalGB × 0.35)), 8)` GB for vanilla, up to 10 GB for big packs. Never more than 50 % of system RAM. "Install" on a suggestion uses the P1-2 installer for that profile. Label the score "Setup score" (it isn't measured FPS). | Suggestions install the correct-version mod. |
| Dead controls | Remove or wire: "0 players" badge, quick-launch chevron (→ profile switcher), "+ Add server" (→ modal), "Add file" (→ picker), custom accent "+" (→ colour input with a contrast check), About version (read `app.getVersion()`). | Grep the UI: every `<button>` / `onClick` target does something. |
| Double progress | Home shows the inline progress in the PLAY area only. The toast appears only on *other* pages. | One progress UI at a time. |
| Interface scale | Remove the CSS `transform` on `#root`. Use `webContents.setZoomFactor(scale)` via IPC. | Crisp text at 125 %, no scrollbars. |
| user_type | `msa` for Microsoft accounts, `legacy` for offline. | — |
| Security | Validate every IPC payload with zod in main. Restrict `will-navigate` / `setWindowOpenHandler` (open external links in the browser, http/https only). Turn off `webSecurity` nowhere. | — |

---

## 5. Phase 4 — Design overhaul ("premium, dark, blood-red")

Goal: it should feel like a paid client (Lunar / Dawn quality), keeping LifeaLauncher's identity: blood-red
accents, ember highlights, and a subtle pixel touch in headings and the background scenes.

### 5.1 Tokens (replace `tokens.css`, mirror them in `tailwind.config.ts`)
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
- Text contrast is at least WCAG AA (4.5:1) on `--bg-2`. Check `--text-2` and the accent-on-dark buttons with a contrast checker.
- Accent presets are all red-family (Crimson `#e11d2e`, Blood `#8b0000`, Ruby `#c2185b`, Scarlet `#ff2400`, Ember `#ff6a2b`) plus a custom picker that rejects colours under 3:1 contrast on `--bg-0`.
- Type scale: Inter 12/13/14/16/20/28/40, weights 400/500/600/700, `font-feature-settings:"tnum"` for numbers. Monocraft only for the logo wordmark, page titles (28/40) and percentages.
- Spacing on a 4 px grid. Content max-width 1200 px. Page padding 32 px (24 px in compact mode).

### 5.2 Layout
- **Title bar (40 px):** logo + "LIFEA" (Monocraft) on the left. Center: a global search / command palette trigger
  (`Ctrl+K`). Right: download indicator (ring + count when jobs run), then min/max/close (close turns `--danger` on hover).
- **Icon rail (72 px):** Home, Library, Browse, Boost, Wardrobe, Servers, Console, Settings. The active item gets a
  3 px accent bar, an accent icon and `--bg-3` fill. Tooltips (200 ms delay). Account avatar at the bottom (3D head
  render of the current skin) with a presence dot, opening the account menu.
- **Content area:** each page has a header row (title, subtitle, primary action right-aligned) and then content.
  Route change: 180 ms fade + 6 px rise, preserving scroll per route.

### 5.3 Home
- Full-bleed animated background (the existing parallax scenes), with a gradient scrim from left (`--bg-0` 85 %) to
  right (transparent) so text is always readable.
- Hero block bottom-left:
  - profile icon (56 px, rounded 12) + profile name (Monocraft 40);
  - chips: `1.21.4`, `Fabric 0.16.x`, `23 mods`, `Played 3h ago`;
  - **PLAY** button, 64 px tall × 300 px, `--accent` gradient to `--accent-lo`, inner highlight, glow on hover
    (`box-shadow 0 0 0 6px var(--accent-glow)`), press scale .98. The attached caret (64×64) opens the profile switcher;
  - while working, the button morphs into a progress bar of the same size: phase label ("Downloading assets"),
    `1 234 / 4 012 · 38.2 MB/s · 0:41 left`, percentage in Monocraft, with a **Cancel** text button beside it;
  - while running: "Playing · 12:41" with a **Stop** button.
- Right column (glass cards: `--bg-2` at 70 % + `backdrop-filter: blur(12px)`, only if §6 budgets allow it, else solid):
  **Servers** (favicon, coloured MOTD, ping bars, players, Join) and **Recent worlds** (Quick Play).
- Character animation controls move into a small floating pill in the bottom-right, auto-hidden after 3 s idle.

### 5.4 Library / Profile detail
- Cards 280×120: icon, name, version + loader chips, mod count, last played. Hover lifts 2 px and shows Play + ⋯ menu
  (Duplicate, Export `.mrpack`, Open folder, Delete with a confirm modal that names the profile).
- Detail page: large header with banner gradient, Play button, tabs (Content · Worlds · Screenshots · Logs · Settings).
  Content tab: segmented control Mods / Resource Packs / Shaders, search, sort (name, updated), multi-select toolbar
  (enable, disable, delete, update), row with icon, name, version, source badge, toggle switch, ⋯ menu.

### 5.5 Browse
- Left filter column: type (Mods / Modpacks / Resource Packs / Shaders), categories, loader, version, sort
  (relevance, downloads, updated). Results grid of 3–4 columns with infinite scroll (`offset` paging) and skeleton
  cards. Card: icon, title, author, 2-line description, downloads/follows, category chips, Install split-button
  (target profile dropdown pre-set to the selected profile, disabled with a tooltip when incompatible).
- Project modal: gallery, rendered markdown body (sanitised), versions table, dependencies.

### 5.6 Console, Settings, Wardrobe, Boost, Servers
- **Console:** monospace (JetBrains Mono 12.5), virtualised list, coloured level gutter, sticky toolbar (level
  segmented control, search with match count, Wrap, Auto-scroll, Copy, Upload to mclo.gs, Open logs folder). The
  crash banner pins at the top.
- **Settings:** left sub-nav, grouped cards with label + description on the left and the control on the right. Changes
  save instantly with a quiet "Saved" tick.
- **Wardrobe:** 3D viewer (440 px) with an orbit hint, animation pills, slim/classic, and a grid of skins/capes with
  hover zoom and a selected ring.
- **Boost:** score ring (animated once), system cards (RAM, CPU, GPU via `app.getGPUInfo('basic')`, Java), suggestion
  list with one-click install, recommended RAM slider marker.
- **Servers:** list with drag-to-reorder, add/edit modal, live ping.

### 5.7 States and micro-interactions (required everywhere)
- Loading uses **skeletons** shaped like the content. Empty states get an illustration (pixel cactus, etc.), one
  sentence and a primary action. Errors get a red inline card with the message, Retry and Copy details.
- Toasts in the bottom-right, max 3, 4 s, with an action slot ("Open folder", "Undo").
- Focus ring is 2 px `--accent-hi` with 2 px offset, keyboard only (`:focus-visible`). Full keyboard navigation;
  `Esc` closes modals; `Ctrl+K` palette (profiles, pages, settings, actions).
- Respect `prefers-reduced-motion` (disable parallax, morphs, glow pulses).
- Icon set: lucide only, 1.75 stroke, 18 px in nav, 16 px inline.
- Build a `/showcase` route (dev only) showing every component in every state. Use it for visual review and remove it
  from production builds.

---

## 6. Phase 5 — Performance: "top notch" with numbers

Measure **before and after** each item and report the numbers in a table. Budgets (packaged app, mid-range laptop):

| Metric | Budget |
|---|---|
| Cold start → window visible | **< 800 ms** |
| Cold start → Home interactive | **< 1.5 s** |
| Initial renderer JS (gzip) | **< 250 KB**; route chunks < 120 KB each |
| Idle CPU on Home with animation | **< 3 %**; **0 %** when hidden/minimised or while the game runs |
| Idle RAM (all processes) | **< 250 MB** |
| Page switch | **< 100 ms**, no dropped frames |
| Console with 20 000 lines | 60 fps scroll, append 1 000 lines/s without jank |
| Asset download 1.21 fresh (100 Mbps) | **< 60 s**; re-launch check **< 2 s** |
| Time from PLAY → game window (cached) | **< 6 s** on SSD |

### 6.1 Startup
- Create the window first and run everything else after `ready-to-show` (§2.4). No sync fs or `execSync` before the
  window shows.
- Lazy-load routes with `React.lazy` + `Suspense`. Preload the Library/Browse chunks on idle (`requestIdleCallback`).
- Lazy-load **skinview3d / three.js** only on the Wardrobe and account-avatar paths (it's the largest dependency).
  Render the sidebar avatar head as a cached 2D canvas crop of the skin, not three.js.
- Use `lucide-react` named imports only (check that tree-shaking works with `rollup-plugin-visualizer`; add
  `npm run analyze`).
- Fonts: local WOFF2 subsets, `font-display: swap`, preload Inter 400/600.
- Turn on V8 code caching for the renderer with `webPreferences.v8CacheOptions: 'bypassHeatCheck'`.

### 6.2 Renderer runtime
- **Zustand selectors** everywhere (`useStore(s => s.x)`) with `shallow` for objects. No component subscribes to the
  whole launch state. Split launch progress into its own tiny store so only the progress bar re-renders.
- **Console:** ring buffer that doesn't copy the whole array on every line (fixed-size circular buffer + version
  counter), lines batched from main (§3.9), rendered with `@tanstack/react-virtual`, filter computed in a
  `useDeferredValue`.
- TanStack Query: sensible `staleTime` (instances 30 s, Modrinth search 5 min, manifest 1 h),
  `refetchOnWindowFocus: false`, and pause all polling while the game runs or the window is hidden.
- Memoise list rows (`React.memo`), stable keys, no inline object props in hot lists. Debounce search inputs to 250 ms
  and cancel stale requests (`AbortSignal` through IPC: pass a request ID, main aborts the old one).
- Images: Modrinth icons `loading="lazy"` `decoding="async"` with fixed width/height (no layout shift), cached by
  Chromium. Instance icons are local SVG.
- Avoid expensive CSS on large areas: `backdrop-filter` only on small cards, and only when the GPU isn't blacklisted
  (check `app.getGPUFeatureStatus()`). Otherwise use solid surfaces. Animate only `transform` / `opacity`.

### 6.3 Background canvas
- Convert scene PNGs to **WebP** (lossless for pixel art) and pre-decode with `createImageBitmap`. Draw layers
  pre-scaled once to the canvas size (cache an offscreen canvas per layer on resize), with `imageSmoothingEnabled = false`.
- Cap at 30 fps with a time accumulator (not `setTimeout`). **Stop the loop entirely** when
  `document.visibilityState === 'hidden'`, the window is blurred for > 10 s, the game is running, the route isn't Home,
  or reduced motion is on. Throttle `mousemove` parallax to rAF.
- Particle pool: preallocate (max 120), no per-frame allocations. `ResizeObserver` instead of window resize, DPR capped at 2.
- Target: **< 2 ms** per frame on the main thread (measure with the Performance panel and log it in dev).

### 6.4 Main process
- All downloads stream to disk with hashing in-stream (§3.1). Never use `Buffer.from(await res.arrayBuffer())` for
  big files.
- Unzipping (natives, `.mrpack`) and SHA-512 of large files run in `worker_threads`. Don't use `unzipSync` on the main
  thread. Stream-unzip `.mrpack` with `yauzl` and verify entries without loading the whole archive into memory.
- IPC: throttled progress (100 ms), batched logs (50 ms), and structured-clone-friendly payloads only.
- Cache Modrinth GETs in memory (LRU, 5 min) plus respect `Retry-After` / `X-Ratelimit-Remaining` headers instead of
  the hand-made timestamp array.
- `backgroundThrottling: true` (the default). Keep it. When the game runs and the launcher is hidden, the renderer
  idles.

### 6.5 Minecraft in-game performance (what users actually feel)
- Default JVM args by Java version:
  - **Java 17/21:** `-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=50 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15`.
    Offer **"Generational ZGC (Java 21, 16 GB+ RAM)"** as an option: `-XX:+UseZGC -XX:+ZGenerational`.
  - **Java 8:** `-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M`.
  - `-Xms` equals `-Xmx` only when `AlwaysPreTouch` is on. Otherwise `-Xms` = half. Clamp heap to the recommendation in §4 (Boost).
- **"Optimize this profile" button** (Boost page and new Fabric profiles): installs the version-correct set from
  Modrinth: Sodium, Lithium, FerriteCore, EntityCulling, ImmediatelyFast, ModernFix, Dynamic FPS, MoreCulling
  (+ Fabric API as needed), skipping anything incompatible. Show the list before installing.
- Never add experimental or risky JVM flags by default. Put them behind an "Advanced" toggle with a warning.
- Launcher **hides on game start** and pauses itself (§3.9), so it never competes with the game for CPU or GPU.

---

## 7. Phase 6 — Packaging, updates, hygiene

- `electron-builder.yml`: `asar: true`. **Remove** `asarUnpack` for images/fonts (they're served via `app://` from
  the asar; unpacking only bloats the install). Add `compression: maximum`. Set the NSIS installer to per-user,
  no elevation needed. Configure code signing via env (`CSC_LINK`, `CSC_KEY_PASSWORD`) and document it in the README.
- `electron-updater` with the GitHub provider: check on startup + every 6 h, download in the background, and show
  "Restart to update" in the title bar.
- Delete dead code: `src/pages/*.html`, `src/components/*.html`, `src/mock/*` (unless used by tests),
  `docs-agent-4/` (duplicate of `shared/`), the `ipc` backward-compat stub in `lib/ipc.ts`.
- Single `APP_VERSION` from `app.getVersion()`, and a User-Agent `LifeaLauncher/<version> (github.com/<owner>/<repo>)`
  as Modrinth requires (a real contact, not `contact@lifea.local`).
- README: real install steps, data locations, troubleshooting (Java, antivirus, GPU drivers), how to build and sign,
  and licences (Monocraft OFL, Modrinth attribution).

---

## 8. Final acceptance checklist (all must be ✅ with proof)

- [ ] `npm run check` green; CI green on Windows, macOS and Linux; Playwright smoke passes on the **packaged** app.
- [ ] Fresh Windows VM, no Java: install → open → create an offline account → PLAY vanilla 1.21.4 → title screen.
- [ ] Fabric 1.21.4 + "Optimize this profile" → title screen with Sodium loaded (log line `Loading N mods` lists sodium).
- [ ] 1.8.9, 1.12.2, 1.16.5, 1.20.1, Quilt 1.20.1, NeoForge 1.21.1 → title screen.
- [ ] `.mrpack` import (Fabric pack) → launches. Browse → Modpack → Install → launches.
- [ ] Modrinth install picks version- and loader-correct files and pulls required dependencies.
- [ ] Cancel works during download and while running. Double-launch is blocked.
- [ ] All four themes render. Wardrobe shows the selected skin and cape. Folder buttons open the right folders.
- [ ] No dead buttons (list every interactive control and what it does in the final report).
- [ ] Performance table from §6 filled with before/after numbers, all within budget (or each miss explained with a plan).
- [ ] No binaries in git. Installer published as a Release/Artifact. Auto-update tested from N-1 → N.
- [ ] `WORKLOG.md` has an entry per phase. `BUG_REPORT.md` has each ID marked **Fixed in <commit>**.

Report format at the very end: a table with **Bug ID | Status | Commit | How verified**, the performance table, and
screenshots of Home (each theme), Library, Profile detail, Browse, Console, Settings and Wardrobe from the
**packaged** app.
