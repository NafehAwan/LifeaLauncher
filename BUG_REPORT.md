# LifeaLauncher (agent-5) — Bug & Root-Cause Report

Source reviewed: `cravewhoo/lifealauncher-agent1-shells`, branch `agent-5`, commit `63f6de4`.
Method: read the whole `src/` tree, ran `npm ci` + `vite build` + both `tsc` checks, inspected the
built `dist-electron/` bundles. TypeScript passes with zero errors — **every bug below is a runtime
bug that the type checker cannot see**, which is why five agents each reported "done".

Severity: **P0** = app/game cannot start · **P1** = headline feature broken · **P2** = wrong behaviour / UX · **P3** = cleanup.

---

## P0 — The installed `.exe` cannot open a working window

These four stack on top of each other. Any one alone is enough to make the installer useless.

### P0-1 Infinite recursion on startup (`src/main/store.ts`)
```
lifeaDir() → readSettings() → settingsStore() → ensureLifeaDirs() → lifeaDir() → readSettings() → …
```
`_settingsStore` is only assigned *after* `ensureLifeaDirs()` returns, so the cycle never ends →
`RangeError: Maximum call stack size exceeded` inside `bootstrap()`. Because `bootstrap()` is awaited
before `createWindow()`, **the window is never created**. The app starts and exits silently.
**Fix:** settings must live at a fixed path (`app.getPath('userData')` or `~/.lifea`) that does not depend
on settings. Only *game data* folders may honour `settings.dataDir`.

### P0-2 Main process is built as ESM but uses `__dirname`
`package.json` has `"type": "module"`, so `vite-plugin-electron` outputs `dist-electron/main/index.js` as an
ES module (`import { app } from "electron"`). The bundle then calls `join(__dirname, …)` with no shim →
`ReferenceError: __dirname is not defined in ES module scope`.
**Fix:** either build main/preload as CJS (`build.lib.formats: ['cjs']`, output `.cjs`), or define
`const __dirname = path.dirname(fileURLToPath(import.meta.url))`.

### P0-3 Preload is ESM in a `.js` file → `window.lifea` is undefined
`dist-electron/preload/index.js` starts with `import { contextBridge } from "electron"`. Electron only loads
ESM preloads with a **`.mjs`** extension; a `.js` preload is parsed as CommonJS and throws
`Cannot use import statement outside a module`. Result: `window.lifea` never exists, so **every hook**
(`tryLifea()!.instances.list()` etc.) throws, and every page is empty or crashes.
**Fix:** emit preload as CJS (`preload.cjs`) and point `webPreferences.preload` at it.

### P0-4 Production loads a file that does not exist (`src/main/index.ts:42`)
```ts
win.loadFile(join(__dirname, '../renderer/index.html'));   // → dist-electron/renderer/index.html
```
Vite writes the renderer to `dist/index.html`. There is no `renderer` folder → blank window.
**Fix:** `join(__dirname, '../../dist/index.html')` (or `app.getAppPath() + '/dist/index.html'`).

### P0-5 Public assets use absolute `/…` paths → 404 under `file://`
`/scenes/...`, `/sprites/...`, `/icons/logo.svg`, `/skins/default.png` are hard-coded. In production the page is
`file:///C:/…/app.asar/dist/index.html`, so `/scenes/x.png` resolves to `file:///scenes/x.png`.
Backgrounds, character, logo and 3D skin all fail to load.
**Fix:** use `import.meta.env.BASE_URL + 'scenes/…'` (with `base: './'`) or serve the app through a custom
`app://` protocol.

---

## P0 — Even with a window, Minecraft can never launch

### P0-6 The Minecraft client JAR is never downloaded or put on the classpath
`launch.ts` downloads assets + libraries, but nothing reads `versionJson.downloads.client`.
`resolveClasspath()` only returns libraries. Java exits immediately with
`Could not find or load main class net.minecraft.client.main.Main`.
**Fix:** download `downloads.client.url` (SHA-1 verify) to `versions/<id>/<id>.jar` and append it to the classpath.

### P0-7 No Java version matching
1.21.x needs Java 21, 1.18–1.20.4 need Java 17, ≤1.16 need Java 8. The launcher uses whatever `java` is on
PATH and ignores `versionJson.javaVersion.majorVersion`. Most users get `UnsupportedClassVersionError`
or a JVM that refuses the args. JRE auto-download is listed as "v2".
**Fix:** download the Mojang runtime (`piston-meta` `java-runtime` manifest) or Adoptium Temurin per major
version into `~/.lifea/runtimes/<major>/` and pick it automatically.

### P0-8 Natives are never extracted
JVM gets `-Djava.library.path=<instance>/natives`, but nothing creates that folder, and the
`${natives_directory}` template returns `''`. Versions older than 1.19 (1.18.2, 1.16.5, 1.12.2 — all offered in
the New Instance wizard) keep native DLLs in `classifiers` that must be unzipped → `UnsatisfiedLinkError: no lwjgl`.
Also `downloads.classifiers` / `natives` are ignored entirely, and arch-specific natives (x86 / arm64) are not filtered.

### P0-9 `arguments.jvm` from the version JSON is ignored
Only a hand-written JVM list is used. This drops `-XstartOnFirstThread` (macOS — window never opens),
`-Dos.name`/`-Xss` rules, launcher brand args and every JVM arg that Fabric/Forge profiles add.

### P0-10 Fabric install is completely broken (`src/main/minecraft/fabric.ts`)
The Fabric meta API returns **`launcherMeta`** (camelCase) and its `libraries` is an object
`{ client, common, server }`, not an array. The code reads `meta.launcher_meta.libraries` →
`TypeError: Cannot read properties of undefined`. It also never downloads the **loader** and
**intermediary** jars themselves (they live in `loader.maven` / `intermediary.maven`), so even with the
field name fixed, Fabric would fail.
**Fix:** use `GET /v2/versions/loader/{mc}/{loader}/profile/json` — it returns a ready version JSON
(`inheritsFrom`, `mainClass`, full `libraries` with maven URLs, `arguments.jvm`). Merge it onto the vanilla JSON.

---

## P1 — Headline features that do not work

| # | Where | Bug | Cause / fix |
|---|---|---|---|
| P1-1 | `routes/Settings.tsx` vs `BackgroundCanvas.tsx` | Background is black for **every** theme, even in dev | Settings store `blood-dunes` (hyphen); canvas folders are `blood_dunes` (underscore). Use one ID set. |
| P1-2 | `hooks/useModrinth.ts` | "Install" installs the **wrong file** | Takes `versions[0]` with no `game_versions`/`loaders` filter → newest build for any MC version/loader (often NeoForge jar into a Fabric 1.21.4 instance, or mods into a *vanilla* instance where they do nothing). No dependency resolution (Sodium-extra without Sodium, Fabric API never pulled). |
| P1-3 | `routes/InstanceDetail.tsx:32` | "Folder" button does nothing | Passes the bare instance id to `shell.openPath`. Main must resolve `instancesDir()/id`. |
| P1-4 | `routes/InstanceDetail.tsx:78` | Mod enable/disable can't be toggled | Checkbox is `readOnly`; nothing renames `.jar` ↔ `.jar.disabled`. Resource packs / shaders / worlds tabs always show the mods list. |
| P1-5 | `routes/Wardrobe.tsx:39` | Wardrobe never shows your skin; selecting a cape renders the **skin PNG as a cape** | Hard-coded `/skins/default.png`. Thumbnails use `lifea://` but that protocol is never registered → all broken images. In offline mode the game never sees the skin anyway (no skin server / CustomSkinLoader). |
| P1-6 | `ipc/launch.ts` | Launch can be started twice; Cancel does nothing during download | No "already running" guard; the child is only stored after spawn, so cancel during the (long) download phase is a no-op and the renderer flips to `idle` while main keeps downloading. |
| P1-7 | `assets.ts` / `libraries.ts` | First launch takes many minutes | ~4 000 assets downloaded **one at a time**, each broadcasting an IPC state update (thousands of React renders). Use a concurrency pool (16–32) and throttle progress events to ~10/s. |
| P1-8 | `ipc/launch.ts` | Username is always `LifeaPlayer` | Hard-coded; no account/username setting. No Microsoft login → cannot join online-mode servers (Hypixel etc.). |
| P1-9 | Friends | Friends are always "offline" | No backend at all; purely a local list. |
| P1-10 | Library modal | Step 3 "modpack slug" is collected and thrown away | `modpackSlug` state never used. |

## P2 — Wrong behaviour / UX

- **`current = instances[0]`** — the "selected" instance is just the most-recently-played one; there is no way to pick which profile LAUNCH starts.
- **Installer is unsigned** → Windows SmartScreen "unknown publisher" warning on every install.
- **Boost score** reads global `settings.maxHeap`, ignoring the instance's own heap; score is a hard-coded formula, not measured FPS.
- **Hard-coded UI stubs:** "0 players", "+ Add server" (no handler), quick-launch chevron (no menu), "Add file" (no handler), custom accent "+" (no picker), `placehold.co` remote icons (break offline), About says `v1.0.0-agent3`.
- **Two progress UIs at once** on Home (download panel + toast both show while `downloading`).
- **Interface scale** uses `transform: scale()` on `#root` while children use `h-screen` → overflow/blurry text. Use `webContents.setZoomFactor()`.
- **Debounced settings** — one shared debounce keeps only the *last* patch; moving two sliders within 500 ms loses the first.
- **Version list** is hard-coded to 8 versions; should come from the Mojang manifest.
- **`user_type: 'mojang'`** with a fake token → should be `legacy`/`msa`.
- **Server ping** splits `host:port` naively (breaks IPv6) and ignores SRV records (`_minecraft._tcp`), so many real servers show the wrong port/offline.
- **CSP** allows `placehold.co` but not `textures.minecraft.net` / `crafatar`, so future skin heads would be blocked.

## P3 — Repo / build hygiene

- CI **commits an 80 MB `.exe` into git on every push** (`releases/`). This bloats the repo forever; use GitHub Releases or Actions artifacts only.
- `build` script runs `tsc -p tsconfig.electron.json` which emits a *second*, unused CommonJS copy to `dist-electron/src/...`.
- `src/pages/*.html` and `src/components/*.html` (Agent 1 shells) are dead code shipped in the repo.
- `docs-agent-4/` duplicates `shared/`.
- No tests, no ESLint, no smoke test that actually starts Electron — which is how P0-1…P0-4 shipped.

---

## Why it happened (root causes)

1. **"Typecheck passes" was treated as "works".** No agent ever launched the packaged app or Minecraft.
2. **Five agents, no integration owner.** Agent 2 picked theme IDs, Agent 4 named folders differently; Agent 3 wrote CJS-style main code, the build emits ESM.
3. **Launcher internals were hand-rolled from memory** (Fabric field names, classpath, natives) instead of following the real Mojang/Fabric JSON specs or using a proven library (e.g. `@xmcl/core` + `@xmcl/installer`, or `minecraft-launcher-core`).
4. **Hard features postponed to "v2"** (Java runtime, MS auth, natives) are the exact things a launcher needs to launch.

## Minimum fix order to get a playable build
1. P0-1 → P0-4 (window opens, `window.lifea` exists).
2. P0-5, P1-1 (art loads).
3. P0-6 → P0-10 (vanilla + Fabric 1.21.x actually launch), with bundled Java 21.
4. P1-2, P1-6, P1-7 (installing mods + reliable launch).
5. Add an Electron smoke test in CI that boots the packaged app and asserts `window.lifea` exists.
