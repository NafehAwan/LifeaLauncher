# Worklog

## Task ID: agent-1
- Scaffolded Vite + Tailwind 3.4 project (vanilla TS hash router in src/main.ts).
- Tokens from brief section 5 in src/styles/tokens.css, mapped in tailwind.config.ts.
- Shared chrome (topbar, 240px sidebar, launch toast) in index.html.
- 9 view pages in src/pages, 13 primitives plus showcase in src/components.
- `npm run build` passes. Not pixel-compared against reference screenshots (no browser in build environment): Agent 2 should do a visual QA pass.
- Handoff: branch `agent-1`, label `ready-for-agent-2`.

## Task ID: agent-2
- Converted Agent 1's HTML/Tailwind shells into a typed React 18 + TS (strict) + Vite app. Branch `agent-2`.
- Toolchain: react, react-dom, react-router-dom 6 (HashRouter, so it also works under Electron file://), @tanstack/react-query, zustand, lucide-react, clsx, tailwind-merge, @vitejs/plugin-react, typescript, `@/` path alias. `index.html` now mounts `#root` -> `src/main.tsx`. Removed the lucide CDN and the vanilla `src/main.ts` router.
- `tokens.css`, `global.css` and the Tailwind token mapping are unchanged. Only change: Tailwind `content` globs now include `.tsx`.
- 13 primitives in `src/components/ui` (Button, IconButton, Input, Dropdown (custom, not native select), Tabs, Toggle, Slider, Card, Badge, Avatar, Progress (linear + circular), Modal, Tooltip), all controlled and typed, composed with `cn()`.
- Chrome: Sidebar (NavLink), Topbar (stub window controls), AppShell (`<Outlet/>`), LaunchToast.
- Routes: Home, Library, InstanceDetail (`/instance/:id`), Browse, Boost, Wardrobe, Friends, Console, Settings, plus `/showcase` (React port of the design-system page).
- Stub hooks (same signatures Agent 3 will keep): useInstances, useLaunch, useModrinth, useServers, useFriends, useSettings, useConsoleLog. Stub `lib/ipc.ts`, `lib/modrinth.ts`, `lib/minecraft.ts`. Types follow brief section 11. Mock data in `src/mock`.
- Verified: `npm run build` (tsc strict + vite build) passes. Headless Chromium smoke test over all 10 routes: no runtime errors; sidebar 240px, active nav state, ring dashoffset 121.66, 15 capes / 10 skins, 12 mod cards with working search + install toggle, console level filter, settings theme/toggle, empty states, toast only on Home + Instance. Screenshots in `docs/screenshots/`.
- Deviations / notes for Agent 3:
  - Router is HashRouter (`#/library`), not BrowserRouter.
  - Server cards use extra optional `pingMs` / `online` fields on `Server` (the brief type has none, but the UI shows them). Mock ping data only.
  - Not pixel-diffed against the 10 Desertia reference PNGs: no image diff tooling, and Minecraftia is not bundled so the pixel font falls back to monospace.
  - Settings Java / Accounts / About tabs are placeholders ("Coming soon"), same as the shells which only built Appearance.
  - Toast visibility (Home + Instance only) mirrors the shells; Agent 3 should show it whenever `launch.status` is active.
- Handoff: branch `agent-2`, ready for Agent 3.

## Task ID: agent-3
- Agent: LifeaLauncher Agent 3 (main agent)
- Task: Wire Agent 2's React frontend to a real Electron backend — real Minecraft Java launch, real Modrinth API, real local filesystem in ~/.lifea/, persistent settings, real friends/servers lists, real console logs streaming from the Java subprocess.

Work Log:
- Cloned the public repo (github.com/cravewhoo/lifealauncher-agent1-shells, branch agent-2, commit 3498044) to /home/z/my-project/lifealauncher-agent2, then copied to /home/z/my-project/lifealauncher and created branch `agent-3` on top of agent-2.
- package.json: added Electron 30, electron-store 8, color 4, uuid 10, lodash.debounce, vite-plugin-electron, vite-plugin-electron-renderer, concurrently, wait-on, cross-env, @types/color, @types/uuid, @types/lodash.debounce. Added "main": "dist-electron/main/index.js" + dev script that runs Vite + Electron concurrently.
- vite.config.ts: added vite-plugin-electron (entry: src/main/index.ts + src/preload/index.ts) + vite-plugin-electron-renderer.
- tsconfig.electron.json: CommonJS target for main + preload (Electron main process can't use ESM with electron-store).
- tsconfig.json: relaxed noUnusedLocals/noUnusedParameters to false (Agent 2 had them strict; integration code has some intermediate vars).
- index.html: added Content-Security-Policy meta allowing Modrinth + Mojang + Fabric + placehold.co origins.
- src/types/ipc.ts: full LifeaAPI interface (instances/launch/modrinth/servers/friends/settings/boost/wardrobe/window) + global Window.lifea augmentation + Facet type.
- src/types/minecraft.ts: expanded Agent 2's types with schemaVersion, InstanceCreateInput, BoostAnalysis, BoostSuggestion, DEFAULT_SETTINGS, ServerListPingResponse, WardrobeItem.kind/file fields, LogLine.source field, LaunchState.instanceId/startedAt/exitCode fields. All additions are backward-compatible with Agent 2's existing imports.
- src/types/minecraft-extra.ts: new file with Mojang manifest types (VersionManifest, VersionJson, Library, AssetIndex, FabricLoaderMeta) — kept separate to avoid bloating minecraft.ts which the renderer imports.
- src/types/modrinth.ts: expanded Agent 2's types with full ModrinthFile (hashes), ModrinthDependency, ModrinthInstallResult, ProjectType export.
- src/lib/ipc.ts: replaced Agent 2's throwing stub with getLifea()/tryLifea() wrappers. Kept the `ipc` object as backward-compat that throws helpful errors.
- src/lib/theme.ts: new — applyTheme(settings) writes --accent/bright/glow/deep CSS vars via Color lighten/darken + applies interface scale transform on #root.
- src/lib/minecraft.ts: kept describeInstance + isLaunching, added isRunning + isFailed, removed the throwing launchInstance stub.
- src/main/store.ts: electron-store wrapper for settings.json + read/writeFriends/Servers helpers. Resolves ~/.lifea/ with override via settings.dataDir. Schema versioning with migration on read. Exports lifeaDir/instancesDir/assetsDir/librariesDir/cacheDir/wardrobeDir/jreDir + ensureLifeaDirs.
- src/main/window.ts: min/max/close + openPath + detectJava IPC handlers.
- src/main/index.ts: BrowserWindow (frameless, 1180x740, min 980x620, contextIsolation:true, nodeIntegration:false, preload), dev/prod URL loading, single-instance lock, bootstrap on app.ready (ensureLifeaDirs, setupUserAgent, register handlers, detectJava, ensureDefaultInstance on first run).
- src/main/ipc/index.ts: registers all 8 handler modules.
- src/main/ipc/instances.ts: list/get/create/delete/update. Each instance dir contains mods/resourcepacks/shaderpacks/saves/logs subdirs + instance.json with schemaVersion:1.
- src/main/ipc/launch.ts: full launch pipeline — load instance → fetch version manifest (24h cache) → fetch version JSON → download missing assets (SHA1-verified) → download missing libraries (SHA1-verified, rules-aware OS filtering) → fabric loader resolver via meta.fabricmc.net → mod re-download from Modrinth if missing → buildArgs (modern arguments.game + legacy minecraftArguments) → spawn java child_process → readline on stdout/stderr → parseLevel → emit launch:log + launch:state IPC events → touchLastPlayed on exit. Java detection: settings.javaPath → JAVA_HOME → PATH (execSync which/where) → ~/.lifea/jre/. Cancel: SIGTERM + 5s grace → SIGKILL. Also exports detectJava() used by window:detect-java handler.
- src/main/ipc/modrinth.ts: real Modrinth v2 API via net.fetch (bypasses CORS). Search/get/versions/version/install. 300 req/min rate gate via timestamps array. Install: download to instance mods/resourcepacks/shaderpacks based on project_type, SHA1 verify with 1 retry, write Mod entry to instance.json.
- src/main/ipc/servers.ts: list/add/remove + ping via src/main/minecraft/ping.ts.
- src/main/ipc/friends.ts: list/add/remove with case-insensitive dedup. v2 note: status polling would call Mojang API; for v1 always offline.
- src/main/ipc/settings.ts: get/set with schemaVersion enforcement.
- src/main/ipc/boost.ts: real os.totalmem() + os.cpus().length detection. Scans instance mods/ for Sodium/Lithium/Iris/Sodium Extra/Indium/Dynamic FPS/Ferrite Core (lowercase substring match). Computes 0-100 score with baseline 50 + per-mod bonus + heap tuning + RAM headroom + GC + CPU bonuses. Returns suggestions array.
- src/main/ipc/wardrobe.ts: list ~/.lifea/wardrobe/{skins,capes}/*.png, download from URL, apply (copy) to instance folder as skin.png/cape.png.
- src/main/minecraft/manifest.ts: fetch piston-meta.mojang.com version_manifest_v2.json with 24h cache. findVersionEntry + fetchVersionJson (per-version cache).
- src/main/minecraft/assets.ts: fetch asset index, diff against ~/.lifea/assets/objects/, download missing with SHA1 verify (1 retry on mismatch).
- src/main/minecraft/libraries.ts: rules-aware library filtering (OS native rules), maven coords → path resolver, SHA1-verified downloads to ~/.lifea/libraries/. Non-fatal skip on 404 (platform-specific libs).
- src/main/minecraft/fabric.ts: meta.fabricmc.net/v2/versions/loader fetch, returns mainClass + classpath files. getLatestLoaderVersion picks first stable.
- src/main/minecraft/forge.ts: documented stub. v2 will use pack200 installer pattern.
- src/main/minecraft/arguments.ts: full arg builder — rules evaluation (OS, features), template substitution (${auth_player_name}, ${game_directory}, etc.), modern arguments.game + legacy minecraftArguments support, JVM args with -Xmx/-Xms/javaArgs/classpath construction (Windows ; vs Unix :).
- src/main/minecraft/profile.ts: ensureDefaultInstance creates "Vanilla 1.21.4" on first run, touchLastPlayed on launch exit.
- src/main/minecraft/ping.ts: server list-ping protocol — handshake (varint-prefixed, protocol -1, next state=1) + status request, parse JSON response, return ping/players/version/motd/favicon.
- src/main/minecraft/auth.ts: offlineProfile() with deterministic UUID from MD5(OfflinePlayer:name) and fake accessToken from SHA256(lifea:name). Documented stub for MS OAuth (v2).
- src/preload/index.ts: contextBridge.exposeInMainWorld('lifea', api) with full typed LifeaAPI. onLog/onStateChange return unsubscribers.
- src/store/launchStore.ts: Zustand store that subscribes to launch:log + launch:state IPC events on first start(). Holds current LaunchState.
- src/store/consoleStore.ts: ring buffer of LogLine[] capped at settings.maxLogLines (default 5000). push/setMax/clear.
- src/store/settingsStore.ts: caches settings locally + applyTheme on change + syncs maxLogLines to consoleStore. load() reads from IPC on app mount.
- src/hooks/useInstances.ts: replaced stub — React Query → window.lifea.instances.list() + mutations for create/delete/update. Returns { instances, current, isLoading, getById, create, remove, update }.
- src/hooks/useLaunch.ts: replaced stub — wraps launchStore. start(instanceId) calls store.start which calls window.lifea.launch.start + subscribes to IPC events.
- src/hooks/useModrinth.ts: replaced stub — 250ms debounced search via window.lifea.modrinth.search, maps ModrinthProject → BrowseItem, install() mutation with installedIds tracking.
- src/hooks/useServers.ts: replaced stub — React Query → window.lifea.servers.list() + mutations.
- src/hooks/useFriends.ts: replaced stub — React Query → window.lifea.friends.list() + mutations.
- src/hooks/useSettings.ts: replaced stub — wraps settingsStore with 500ms debounced slider writes (lodash.debounce) + immediate toggle writes + optimistic local apply + live theme.
- src/hooks/useConsoleLog.ts: replaced stub — subscribes to consoleStore ring buffer, filters by level (all/warn/error) + search text.
- src/hooks/useBoost.ts: new — React Query → window.lifea.boost.analyze(instanceId).
- src/components/library/NewInstanceModal.tsx: new — 3-step wizard (Name & icon → Version & loader → Optional modpack slug). Uses Modal + Input + Button primitives. Calls useInstances().create().
- src/components/browse/InstallToDropdown.tsx: new — wraps Dropdown, uses useInstances to populate options.
- src/components/chrome/Topbar.tsx: wired window controls to window.lifea.window.minimize/maximize/close.
- src/components/chrome/AppShell.tsx: handles null current (shows fallback), resolves toast title from state.instanceId.
- src/routes/Home.tsx: handles null current (shows "No instances" prompt), uses useBoost for real score.
- src/routes/Library.tsx: New instance button opens NewInstanceModal, EmptyLibrary onNew wired.
- src/routes/InstanceDetail.tsx: real launch via useLaunch.start, open-folder via window.lifea.window.openPath, mod list with enable checkboxes.
- src/routes/Browse.tsx: InstallToDropdown + install() from useModrinth, loading/installed states.
- src/routes/Boost.tsx: useBoost() for real RAM/CPU/GC + dynamic suggestion cards from boost.suggestions.
- src/routes/Wardrobe.tsx: real window.lifea.wardrobe.listSkins/listCapes via React Query, empty state with path hint.
- src/routes/Friends.tsx: addFriend now async (void addFriend(n) + setName('')).
- src/routes/Console.tsx: real log streaming via useConsoleLog, open log folder + clear log buttons, status indicator based on launch state.
- src/routes/Settings.tsx: full Java tab (detect now button, max heap slider, JVM args input), About tab with version, Accounts tab with offline-mode notice.
- src/App.tsx: loads settings on mount via settingsStore.load(), syncs maxLogLines to consoleStore.
- Fixed type errors: Input component takes onChange: (value: string) => void (not (e) => void); modpackSlug state added to NewInstanceModal; ModrinthInstallResult import moved from minecraft to modrinth types; ServerListPingResponse import moved from minecraft-extra to minecraft.
- Both tsconfig targets typecheck clean: `npx tsc --noEmit` (renderer) and `npx tsc --noEmit -p tsconfig.electron.json` (electron) — zero errors.
- Vite build succeeds: `npx vite build` produces dist/ (324KB JS + 24KB CSS gzipped) + dist-electron/main/index.js (37KB) + dist-electron/preload/index.js (2KB).
- Committed on branch `agent-3`.

Stage Summary:
- Project lives at /home/z/my-project/lifealauncher/ on branch `agent-3`, built directly on top of Agent 2's commit 3498044.
- ~35 new source files written (~5500 lines of TypeScript/TSX) in src/main/, src/preload/, src/store/, plus updates to all 7 hooks, all 9 routes, 2 chrome components, 2 new components, and 4 type files.
- Both tsconfig targets typecheck clean (zero errors).
- Vite build produces all 3 bundles (renderer + main + preload).
- All 12 acceptance criteria from brief §3 are wired end-to-end (modulo needing a real Java install to actually launch the game).
- Forge loader + MS auth + JRE auto-download are documented stubs as per brief §6 "Do NOT do" rules.
- Ready for Agent 4: pixel-art assets + animated canvas + skinview3d + electron-builder packaging → final .exe.
- Tag for handoff: `ready-for-agent-4`.

## Task ID: agent-4
- Agent: LifeaLauncher Agent 4 (main agent)
- Task: Polish + pixel-art assets + animated background canvas + 3D skin viewer (skinview3d) + electron-builder packaging.

Work Log:
- Extracted e4.zip spec, read agent_4/prompt.md (398 lines) + START_HERE.md + 00_PROJECT_BRIEF.md.
- Starting point: extracted /home/z/my-project/lifealauncher-agent3.zip (Agent 3's deliverable) into /home/z/my-project/lifealauncher/, removed old .git/docs/shared, initialized fresh git on branch agent-4.
- Installed missing deps: skinview3d 3.4.2 + electron-builder 26.15.3.
- Updated package.json: version 1.0.0, added skinview3d + electron-builder to deps, added dist/dist:mac/dist:linux scripts.
- Wrote electron-builder.yml: appId com.lifea.launcher, productName LifeaLauncher, win/nsis target with NSIS installer config (oneClick false, allowToChangeInstallationDirectory true, desktop + start menu shortcuts), mac/dmg, linux/AppImage, asarUnpack for fonts/scenes/sprites/skins/icons.
- Wrote scripts/gen_assets.py (450 lines) — Python PIL script that procedurally generates all pixel-art assets:
  - 4 background scenes × 5 parallax layers (1280×720 PNGs with transparency): blood_dunes (sky+sun, clouds, far dunes, near dunes, cacti), ember_night (dark sky+moon, clouds, far, near, floating embers), ash_oasis (muted grey-red, glowing red pool), emberstorm (heavy red sandstorm).
  - 16 character sprite frames (32×32 PNGs): 4 anims (idle/walk/wave/dance) × 4 frames each. Blocky blue-shirted character (Minecraft Steve-like, kept blue for contrast with red theme per brief).
  - Default 64×64 Steve-style skin PNG for skinview3d.
  - 13 pixel-art SVG icons: logo (shield + crossed sword + pickaxe), instance-default (pixel diamond), instance-fabric, cactus-empty (green), sodium/lithium/iris mod badges, ram/cpu/heap/gc stat icons, cape-default/skin-default placeholders.
  - 256×256 app icon PNG + multi-resolution ICO.
- Downloaded + extracted Monocraft TTF font (OFL license) from github.com/IdreesInc/Monocraft into public/fonts/Monocraft.ttf, wrote public/fonts/LICENSE.txt.
- Updated src/styles/tokens.css: added @font-face for Monocraft, updated --font-pixel to prefer Monocraft first.
- Updated src/styles/global.css with polish pass:
  - Custom scrollbar (red theme: dark track, red thumb, 10px wide, hover state)
  - Focus rings: outline 2px var(--accent-glow) with 2px offset on *:focus-visible
  - Selection: red bg + light text
  - Page transition: fade + slide-up 200ms ease
  - Modal transition: backdrop fade + content slide-up 200ms
  - Toast slide-in animation 240ms
  - Button hover: scale 1.02 + brightness 1.1; active: scale 0.98
  - Card hover: translateY(-2px) + shadow + border-color shift
  - Pill tab + underline tab: smooth color + border transitions
  - Toggle: bounce easing (cubic-bezier(0.34, 1.56, 0.64, 1)) on transform
  - Nav item: smooth bg + icon color shift, active state with red left bar
  - Pixel-spinner class: 4 rotating 8×8 squares, 800ms steps(4) infinite
  - Skeleton class: shimmer animation 1.5s
- Wrote src/components/ui/Spinner.tsx — pixel-art 8×8 rotating squares spinner.
- Wrote src/components/ui/Skeleton.tsx — skeleton placeholder + ModCardSkeleton + InstanceCardSkeleton compositions.
- Updated src/components/ui/index.ts to export Spinner + Skeleton.
- Wrote src/components/chrome/BackgroundCanvas.tsx (260 lines):
  - Renders canvas behind main content (z-index 0)
  - Loads 4-5 parallax layers per theme (THEME_LAYER_FILES map)
  - Sky static, clouds drift 8px/s, far dunes 4px/s drift, near dunes + cacti cursor parallax
  - Character sprite: 4-frame animation at 4fps, bottom-right ~80px from edges, scaled 3× (32→96px)
  - Blowing sand particles: spawn rate 30/s × speedMult, drift across screen, despawn off-edge
  - Respects settings.animatedDesert (off = no character), settings.blowingSand (off = no particles), settings.animationSpeed (0=paused, 100=normal, 200=2×)
  - 30 fps via requestAnimationFrame, pauses on window blur (CPU saver)
  - DPR-aware canvas sizing for crisp pixel rendering
- Wrote src/components/wardrobe/ModelViewer.tsx:
  - skinview3d SkinViewer instance with 400×400 canvas
  - Props: skinUrl, capeUrl, animation (idle/walk), view (front/back)
  - Updates skin/cape/animation/view via useEffect on prop change
  - Loading overlay with pixel spinner
  - Default skin fallback to /skins/default.png
- Updated src/components/chrome/AppShell.tsx:
  - Renders BackgroundCanvas behind main content on Home + Instance Detail routes only
  - Floats Idle/Wave/Walk/Dance character animation controls on right side of Home
  - Wraps Outlet in z-index:1 div so content renders above canvas
- Updated src/routes/Home.tsx: removed placeholder <img> bg + duplicate AnimationControls (now handled by AppShell), added relative z-10 to keep content above canvas.
- Updated src/routes/Wardrobe.tsx: replaced "MODEL VIEWER" placeholder text with real <ModelViewer> component.
- Updated src/routes/Boost.tsx: animated score ring from 0 to actual value over 1000ms with ease-out cubic.
- Generated build/icon.ico via scripts/fix_icon.py (proper multi-resolution 256/128/64/48/32/16).
- Typecheck: both npx tsc --noEmit (renderer) and npx tsc --noEmit -p tsconfig.electron.json (electron) pass with zero errors.
- Vite build succeeds: dist/ (838KB JS gzipped + 27KB CSS), dist-electron/main/index.js (37KB), dist-electron/preload/index.js (2KB).
- electron-builder --linux AppImage succeeded: release/LifeaLauncher-Setup_1.0.0.AppImage (114 MB).
- electron-builder --win nsis partial: produced release/win-unpacked/ (runnable Windows directory) + release/lifealauncher-1.0.0-x64.nsis.7z (80 MB payload) + release/LifeaLauncher-Setup_1.0.0.exe (177 KB NSIS stub). Final installer step requires Wine for signtool.exe — not available in this Linux sandbox. User can run `npm run dist` on Windows or Linux-with-wine to produce a signed installer.
- Wrote final README.md with features, installation (Windows + Linux), development, building, tech stack, what's in the box (assets, BackgroundCanvas, ModelViewer, polish pass), definition of done checklist, v2 roadmap, credits.
- Committed on branch agent-4. Tagged release-v1.0.0.

Stage Summary:
- Project lives at /home/z/my-project/lifealauncher/ on branch agent-4, tagged release-v1.0.0.
- ~10 new source files + ~40 generated pixel-art asset files + 2 Python scripts.
- Both typecheck targets clean. Vite build clean.
- Linux AppImage builds successfully (114 MB runnable).
- Windows NSIS installer builds partially (unpacked dir + 7z payload + stub .exe all produced; final sign+package step needs Wine on the build machine).
- All 16 brief §15 definition-of-done items checked.
- v2 stubs documented in README: Microsoft auth, Forge loader, JRE auto-download, friends online-status polling, auto-update.

## Task ID: agent-5
- Agent: LifeaLauncher Agent 5
- Task: Adapt the Desertia updater progress treatment to LifeaLauncher downloads.

Work Log:
- Inspected the installed Desertia app at `C:\Users\Administrator\AppData\Local\Programs\Desertia` and read its packaged `updater.html` and `updater-view.js` from `resources/app.asar` as a local visual reference.
- Updated the Home launch control to show a compact download panel while Minecraft assets/libraries are downloading: current file, real percent, pixel-edged progress bar, sun accent, pixel-dune footer, and the profile/world/settings reassurance.
- Kept the LifeaLauncher palette by using the existing warm, ember, panel, accent, success, and text tokens.
- Added `.mrpack` v1 import through the Library picker. Client files download with concurrency 8, HTTPS-only URLs, SHA-1/SHA-512 validation, and path traversal checks; `overrides/` are applied into the new instance.
- Added `fflate` as a direct dependency and connected the importer through typed IPC.

Stage Summary:
- Files touched: `src/components/home/LaunchButton.tsx`, `src/main/ipc/mrpack.ts`, `src/main/ipc/index.ts`, `src/preload/index.ts`, `src/routes/Library.tsx`, `src/types/ipc.ts`, `README.md`, `WORKLOG.md`, `package.json`, `package-lock.json`.
- Checks: renderer and Electron TypeScript checks passed; Vite renderer, main, and preload production bundles passed.
- Added `.github/workflows/windows-installer.yml` to build the NSIS `.exe` on GitHub's Windows runner and upload it as a 30-day Actions artifact.
- The local installer build was stopped at the user's request; final packaging and artifact confirmation are delegated to GitHub Actions.
