# LifeaLauncher — Master Project Brief

> Read this file FIRST. Every agent must follow this brief. Do not invent your own tech stack, theme tokens, or folder structure.

## 1. What we are building

**LifeaLauncher** is a desktop game launcher for **Minecraft Java Edition + mods + modpacks + resource packs + shaders + skins + capes**. It is a **1:1 visual and functional clone of the Desertia launcher** (https://github.com/shadowedaizen/Desertia-Releases) but with a **red blood + ember theme** instead of Desertia's gold/desert theme. Every view, every component, every interaction in Desertia must exist in LifeaLauncher with identical layout and behaviour — only the colour palette, font choice, and pixel-art assets change.

## 2. Tech stack (LOCKED — do not deviate)

| Layer | Choice | Reason |
|---|---|---|
| Shell | **Electron 30+** | Desktop .exe installer, full filesystem + child_process access for launching Minecraft |
| Renderer | **React 18 + TypeScript + Vite** | Fast HMR, modern, Electron-friendly |
| Styling | **Tailwind CSS 3.4 + CSS variables** | Pixel-perfect control, theme tokens via CSS vars |
| Icons | **lucide-react** (line set) | Matches Desertia's line-icon aesthetic |
| Pixel font | **Minecraftia / Monocraft** (community free version, `monocraft.ttf` placed in `/public/fonts`) | User explicitly picked this |
| Body font | **Inter** (fallback sans) | Readable body text |
| Monospace | **JetBrains Mono** | Console log view |
| State | **Zustand** + React Query | Local UI state + server cache for Modrinth API |
| Routing | **react-router-dom v6** | Multi-view navigation |
| Backend IPC | Electron `ipcMain` / `ipcRenderer` (TS-typed) | Spawn Java, read/write `~/.lifea/`, call Modrinth |
| Modrinth API | `https://api.modrinth.com/v2` (real HTTP) | User wants real Modrinth integration |
| Minecraft launch | **`mc-java-launcher-core`** pattern (manual implement) | Profile/launcher_profiles.json manipulation, version manifest fetch, asset download, `java -jar` |
| Installer build | **electron-builder** (NSIS, target=nsis) | Produces `LifeaLauncher-Setup_win.exe` |
| Local data dir | `~/.lifea/` (override-able in settings) | Profile storage, instances, mods cache |

## 3. The 10 Desertia views we must clone

Reference screenshots live in `shared/screenshots/`. All 10 are required views for v1.

| # | Screenshot | View name | Key features |
|---|---|---|---|
| 01 | `01_home_launch_dashboard.png` | **Home / Launch Dashboard** | Pixel-art desert bg, version header (`1.21.11 Fabric`), big LAUNCH button with progress, profile card, server cards grid, animation toggles (Idle/Wave/Dance) |
| 02 | `02_browse_modrinth.png` | **Browse / Modrinth Marketplace** | Tabs (Modpacks/Mods/Resource Packs/Shaders), search, filter dropdowns, mod cards with install button, "powered by Modrinth" branding |
| 03 | `03_settings_appearance.png` | **Settings / Appearance** | Theme selector cards (Golden Dunes/Desert Night/etc.), accent color swatches (must include RED), toggles (Animated desert, Blowing sand), interface scale slider |
| 04 | `04_console_log.png` | **Console / Launch Log** | Title + "Launching" green status, version dropdown, log level tabs (All/Warn+/Errors), filter search, copy/folder icon buttons, monospace amber log text on near-black |
| 05 | `05_friends_social.png` | **Friends / Social** | Big "Friends" pixel title, "0 online : 0 friends" stats, "Add friend by Minecraft name" input + Add button, online section, atmospheric desert bg empty state |
| 06 | `06_wardrobe_capes.png` | **Wardrobe / Capes** | 3D model preview (canvas), Idle/Walk toggle, Back/Front view toggle, Capes/Skin tabs, 5-col item grid, golden checkmark on selected, "Animated" badge |
| 07 | `07_wardrobe_skin.png` | **Wardrobe / Skin** | Same as 06 but Skin tab active |
| 08 | `08_boost_performance.png` | **Boost / Performance** | Big score ring "78 of 100", warning card (red — Missing Sodium), info card (green — Small win), 4 stat cards at bottom (RAM, CPU, Heap, GC) |
| 09 | `09_library_empty.png` | **Library / Instances (empty)** | Search bar, "Last played" dropdown, Import + New instance buttons, pixel cactus empty state, "It's quiet out here" headline, New instance / Browse modpacks CTAs |
| 10 | `10_instance_detail_launching.png` | **Instance Detail (Launching)** | Back breadcrumb, large hero icon + title, metadata badges, big LAUNCHING button (state changed), tab bar (Mods/Resource Packs/Shaders/Worlds/Settings), empty mods state, bottom-right progress toast |

## 4. Layout system

Every view shares this chrome:

```
+--------------------------------------------------------------+
| [Drag region]                                  [_] [□] [X]    |
+----------+---------------------------------------------------+
|          |  Page Title (pixel font, ~32px)                   |
|          |  Subtitle / status (muted, ~14px)                 |
| SIDEBAR  +---------------------------------------------------+
| ~240px   |                                                   |
|          |  VIEW CONTENT (scrollable)                        |
| - Home   |                                                   |
| - Library|                                                   |
| - Browse |                                                   |
| - Boost  |                                                   |
| - Wardr. |                                                   |
| - Friends|                                                   |
| - Console|                                                   |
| - Sett.  |                                                   |
|          |                                                   |
| [user]   |                                                   |
+----------+---------------------------------------------------+
| [Floating bottom-right: launch progress toast when active]   |
+--------------------------------------------------------------+
```

- **Window**: 1180×740 default, min 980×620, frameless (custom titlebar with min/max/close on the right, drag region across the top).
- **Sidebar**: Fixed 240px wide, full-height, dark red-tinted bg. Logo + nav items + user profile at bottom. Active item gets a 3px red left bar + red-tinted bg.
- **Content**: 32px padding. Page title in Minecraftia. Body in Inter.
- **Toast**: Floating bottom-right card, 360px wide, ~140px tall, shown when `launchState.status === 'launching' || 'downloading'`.

## 5. Color tokens — RED BLOOD + EMBER theme (LOCKED)

All colors MUST be defined as CSS variables on `:root` in `src/styles/tokens.css`. Tailwind extends these via `tailwind.config.ts`.

```css
:root {
  /* === SURFACES (dark, red-tinted) === */
  --bg-app:        #14080a;   /* deepest — main app bg */
  --bg-sidebar:   #1c0d0f;   /* sidebar */
  --bg-panel:     #211215;   /* cards, hero */
  --bg-panel-2:   #2b161a;   /* hover / nested panel */
  --bg-input:     #1a0a0c;   /* inputs */
  --bg-terminal:  #0a0405;   /* console log bg */

  /* === ACCENTS (blood + ember) === */
  --accent:       #8b0000;   /* blood red — PRIMARY */
  --accent-bright:#b71c1c;   /* hover / active */
  --accent-glow:  #ef4444;   /* focus ring, glow */
  --accent-deep:  #5d0000;   /* pressed, deep */
  --ember:        #ff4500;   /* secondary accent — ember orange */
  --ember-bright: #ff6b35;   /* ember hover */
  --warm:         #ffc107;   /* warm accent — used SPARINGLY for badges/impact tags */

  /* === TEXT === */
  --text:         #f5e6e6;   /* primary text */
  --text-muted:   #a08585;   /* secondary */
  --text-dim:     #6b5353;   /* tertiary */

  /* === STATUS === */
  --success:      #4ade80;
  --warning:      #fbbf24;
  --danger:       #ef4444;   /* same as accent-glow */
  --info:         #60a5fa;

  /* === BORDERS === */
  --border:       rgba(255, 255, 255, 0.06);
  --border-strong:#3d2226;
  --border-accent: var(--accent);

  /* === TYPOGRAPHY === */
  --font-pixel:   'Minecraftia', 'Monocraft', 'Press Start 2P', monospace;
  --font-body:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Cascadia Code', monospace;

  /* === RADIUS === */
  --r-sm: 4px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-xl: 16px;
  --r-pill: 999px;

  /* === SPACING (8pt grid) === */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px;

  /* === MOTION === */
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 120ms; --dur: 200ms; --dur-slow: 400ms;

  /* === SHADOWS === */
  --shadow-card: 0 4px 16px rgba(0,0,0,0.4);
  --shadow-glow: 0 0 20px rgba(239, 68, 68, 0.35);
  --shadow-toast: 0 8px 32px rgba(0,0,0,0.6);
}
```

Tailwind config **MUST** map these (`bg-app`, `bg-panel`, `text-accent`, `border-strong`, etc.) so components use semantic classes, not raw hex.

## 6. Typography scale

| Token | Font | Size | Weight | Use |
|---|---|---|---|---|
| `text-display` | Minecraftia | 32px | 700 | Page titles (Home, Browse, Settings...) |
| `text-h1` | Minecraftia | 24px | 700 | Section headers |
| `text-h2` | Inter | 18px | 600 | Subsection |
| `text-body` | Inter | 14px | 400 | Default body |
| `text-sm` | Inter | 12px | 400 | Metadata, captions |
| `text-xs` | Inter | 11px | 500 | Tags, badges (uppercase + 0.08em tracking) |
| `text-mono` | JetBrains Mono | 13px | 400 | Console log lines |
| `text-btn` | Inter | 14px | 600 (uppercase, 0.04em tracking) | Buttons |

## 7. Component inventory (all 8 nav views)

### Sidebar (shared chrome)
- Logo: pixel shield/sword icon + "LIFEA" text in Minecraftia
- Nav items (icon + label, lucide-react):
  - Home → `Home`
  - Library → `Library` (or `FolderOpen`)
  - Browse → `Globe`
  - Boost → `Zap`
  - Wardrobe → `Shirt`
  - Friends → `Users`
  - Console → `Terminal`
  - Settings → `Settings`
- Active state: 3px red left bar, `bg-panel-2`, `text-accent` icon
- User profile at bottom: 36px avatar + username + chevron (opens account menu)

### Topbar (shared chrome)
- Drag region (CSS `-webkit-app-region: drag`)
- Window controls on right: minimize / maximize / close (use lucide `Minus`, `Square`, `X`)
- All buttons `-webkit-app-region: no-drag`

### Home / Launch Dashboard (view 01)
Components:
- `VersionHeader`: pixel font version ("1.21.11 Fabric") + version badge + player count badge
- `LaunchButton`: large 280×64px red gradient button, text "LAUNCH" / "LAUNCHING..." / "PLAY" depending on state; primary CTA
- `SecondaryLaunchAction`: small 64px square button with chevron — opens quick-launch dropdown (alternate versions, profiles)
- `BoostChip`: pill showing "Boost score 78" with lightning icon (links to Boost view)
- `ProfileCard` ("Jump back in"): instance icon + name + subtitle + green online dot, click → instance detail
- `NewProfileLink`: "+ New profile" text button (goes to Library → new instance flow)
- `ServersSection`: section header "Servers" + "+ Add server" link
- `ServerCard`: square server icon (40px) + name + subtitle + green dot + ping ms + players online + "..." context menu (Edit / Refresh / Delete)
- `BackgroundAnimationControls`: floating right-side controls — "Idle" / "Wave" / "Walk" / "Dance" buttons
- `LaunchToast`: bottom-right floating card, shown during launch, title + percent + file count + progress bar

### Browse / Modrinth (view 02)
- `BrowseHeader`: pixel title "Browse" + subtitle "powered by Modrinth"
- `ContentTypeTabs`: Modpacks / Mods / Resource Packs / Shaders — text + icon tabs, active has red underline
- `SearchInput`: full search bar, magnifier icon, placeholder "Search mods..."
- `FilterDropdowns`: Versions / Loaders / Sort by — chevron-down dropdowns
- `InstallToDropdown`: red "Install to..." dropdown — pick target instance
- `ResultsCount`: "77.1K results" text
- `ModCard`: square icon (80px) + title (bold) + author (muted) + 2-line description + metadata row (downloads, follows, category tag) + red Install button with download icon
- `ModCardGrid`: responsive 1-3 columns, 24px gap

### Settings / Appearance (view 03)
- `SettingsNav`: subsection tabs on left (Appearance / Java / Accounts / About) — Appearance active
- `ThemeSelectorCard`: large rectangular card with preview image + name + description; selected has red border (3px) + red checkmark
- `AccentColorPicker`: row of circular swatches (Red/Blood/Ember/Orange/Yellow/Lime/Teal/Blue/Purple/Pink) + custom color "+" button (opens native color picker)
- `ToggleRow`: label + description + iOS-style toggle (red when on)
- `SliderRow`: label + slider + value display (e.g. "Interface scale: 110%")
- Toggles to include: Animated desert, Blowing sand, Particles, Show FPS overlay, Compact mode
- Sliders to include: Interface scale (75-150%), Background animation speed (0-200%), Max log lines

### Console / Launch Log (view 04)
- `ConsoleHeader`: title "Console" + green dot + "Launching" / "Idle" / "Crashed" status
- `VersionDropdown`: "1.21.11 Fabric" + chevron
- `LogLevelTabs`: All / Warn+ / Errors — pill tabs, active has red bg
- `FilterInput`: search with magnifier, placeholder "Filter log"
- `IconButton` × 2: Copy log (`Copy`), Open log folder (`FolderOpen`)
- `LogViewport`: scrollable monospace area, lines have level prefix color-coded (INFO=amber, WARN=yellow, ERROR=red, DEBUG=gray), auto-scroll to bottom on new lines unless user scrolled up

### Friends / Social (view 05)
- `FriendsHeader`: pixel title "Friends" + stats "0 online : 0 friends"
- `AddFriendInputGroup`: text input "Add a friend by Minecraft name" + red "+ Add" button
- `OnlineSectionHeader`: "ONLINE 0" uppercase tracked label
- `FriendCard` (when friends exist): avatar + name + status text + "..." menu (Message / Remove / Block)
- `EmptyState`: atmospheric pixel-art desert bg + helper text "Add your friends to see when they're online"

### Wardrobe (views 06 + 07)
- `WardrobeHeader`: pixel title "Wardrobe" + subtitle
- `ModelViewer`: 400×400px canvas with 3D-ish Minecraft skin/cape preview (use `skinview3d` or similar JS lib)
- `AnimationToggle`: Idle / Walk pill segmented control
- `ViewToggle`: Back / Front pill segmented control
- `ItemTypeTabs`: Capes / Skin
- `ItemGrid`: 5-column grid of cards (thumbnail 80px + label + optional "Animated" badge)
- `ItemSelectedCheck`: red check circle top-right of selected card
- `ItemCard` selected state: red border + check

### Boost / Performance (view 08)
- `BoostHeader`: pixel title "Boost" + subtitle "Optimize your game"
- `ScoreRing`: large 200px circular progress ring, "78" big number + "of 100" smaller below, red arc fill
- `SuggestionCard` (warning variant): red square icon + title "Missing Sodium" + description + "High impact" tag + "Install Boost mods" button (red outline → solid red hover)
- `SuggestionCard` (info variant): green square icon + title + "Small win" tag
- `StatCard` × 4 (bottom row): pixel icon + label + value
  - System RAM: 16 GB
  - CPU threads: 8
  - Game heap: 4 GB
  - GC preset: G1GC

### Library / Instances (view 09)
- `LibraryHeader`: pixel title "Library" + count "0 instances"
- `SearchInput`: search bar with magnifier
- `SortDropdown`: "Last played" + chevron
- `ImportButton`: secondary, outlined, "Import" with download icon
- `NewInstanceButton`: primary red, "New instance" with plus icon
- `EmptyState`: large pixel cactus SVG + headline "It's quiet out here" + subtext + "New instance" + "Browse modpacks" buttons

### Instance Detail (view 10)
- `BackBreadcrumb`: "< Library" link
- `InstanceHeroCard`: large pixel icon (96px) + instance name (Minecraftia, 36px) + metadata badges (Fabric, 1.21.11, 0.19.5, Last played) + big LAUNCH button + small folder icon button
- `InstanceTabs`: Mods / Resource Packs / Shaders / Worlds / Settings — underline tabs, Mods active
- `ModToolbar`: filter input + "0 installed · 0 enabled" + Folder / Add file / Find mods buttons
- `EmptyModsState`: "No mods yet." with icon + "Find mods" CTA (links to Browse view)
- `LaunchToast`: same as Home, shown at 1% progress

## 8. Shared primitives (in `src/components/ui/`)

| Component | Props | Notes |
|---|---|---|
| `Button` | variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger', size: 'sm' \| 'md' \| 'lg', icon?: ReactNode, loading?: boolean | Primary = red gradient bg, white text; Secondary = transparent + red border; Ghost = transparent + muted text; Danger = solid `--accent-deep` |
| `IconButton` | icon, label, variant | Square 40px button |
| `Input` | type, value, onChange, placeholder, icon? | Dark bg, red focus ring |
| `Dropdown` | options, value, onChange, trigger? | Custom select with chevron |
| `Tabs` | tabs[], value, onChange | Underline variant + pill variant |
| `Toggle` | checked, onChange | iOS-style, red when on |
| `Slider` | value, min, max, step, onChange | Tailwind range styled |
| `Card` | variant: 'flat' \| 'elevated' \| 'outlined' | Default surface |
| `Badge` | variant: 'default' \| 'accent' \| 'success' \| 'warning' \| 'danger' | Uppercase, 11px |
| `Avatar` | src, size, fallback | Pixel-art avatar |
| `Progress` | value (0-100), variant | Used in LaunchToast |
| `Modal` | open, onClose, title, children | Centered, dark backdrop |
| `Tooltip` | content, children | Native title or custom |

## 9. Folder structure (LOCKED)

```
lifealauncher/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts
├── electron-builder.yml
├── index.html
├── /public
│   ├── fonts/
│   │   ├── Minecraftia.ttf
│   │   └── Monocraft.ttf
│   ├── icons/            # pixel-art SVG icons
│   ├── skin/             # default skins/capes (CC0)
│   └── scenes/           # pixel-art desert background scenes (red-shifted)
├── /src
│   ├── main/            # Electron main process
│   │   ├── index.ts
│   │   ├── ipc/
│   │   │   ├── instances.ts
│   │   │   ├── launch.ts
│   │   │   ├── modrinth.ts
│   │   │   ├── servers.ts
│   │   │   ├── friends.ts
│   │   │   └── settings.ts
│   │   ├── minecraft/
│   │   │   ├── manifest.ts      # version manifest fetcher
│   │   │   ├── assets.ts       # asset downloader
│   │   │   ├── libraries.ts    # lib resolver
│   │   │   ├── profile.ts      # launcher_profiles.json
│   │   │   └── launch.ts       # java -jar spawn
│   │   └── store.ts        # electron-store wrapper for settings.json
│   ├── preload/
│   │   └── index.ts        # contextBridge exposing typed IPC API
│   ├── renderer/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── Home.tsx
│   │   │   ├── Library.tsx
│   │   │   ├── InstanceDetail.tsx
│   │   │   ├── Browse.tsx
│   │   │   ├── Boost.tsx
│   │   │   ├── Wardrobe.tsx
│   │   │   ├── Friends.tsx
│   │   │   ├── Console.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── chrome/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Topbar.tsx
│   │   │   │   ├── AppShell.tsx
│   │   │   │   └── LaunchToast.tsx
│   │   │   ├── ui/        # primitives from §8
│   │   │   ├── home/
│   │   │   ├── browse/
│   │   │   ├── settings/
│   │   │   ├── console/
│   │   │   ├── friends/
│   │   │   ├── wardrobe/
│   │   │   ├── boost/
│   │   │   ├── library/
│   │   │   └── instance-detail/
│   │   ├── hooks/
│   │   │   ├── useInstances.ts
│   │   │   ├── useLaunch.ts
│   │   │   ├── useModrinth.ts
│   │   │   ├── useServers.ts
│   │   │   ├── useFriends.ts
│   │   │   ├── useSettings.ts
│   │   │   └── useConsoleLog.ts
│   │   ├── store/
│   │   │   ├── instancesStore.ts
│   │   │   ├── launchStore.ts
│   │   │   ├── settingsStore.ts
│   │   │   └── consoleStore.ts
│   │   ├── lib/
│   │   │   ├── ipc.ts      # typed IPC client
│   │   │   ├── modrinth.ts # API client
│   │   │   ├── minecraft.ts # client-side helpers
│   │   │   └── utils.ts
│   │   └── styles/
│   │       ├── tokens.css    # CSS variables from §5
│   │       ├── global.css    # tailwind + base
│   │       └── pixel-art.css # image-rendering: pixelated
│   └── types/
│       ├── ipc.ts
│       ├── modrinth.ts
│       ├── minecraft.ts
│       └── store.ts
└── /scripts
    └── build-icons.ts     # generates pixel-art SVG icons
```

## 10. Agent split (assembly-line)

| Agent | Step | Output | Hand-off to |
|---|---|---|---|
| **Agent 1** | HTML + CSS shells | Static HTML/CSS mockups for all 10 views + every shared primitive in pure HTML+Tailwind, served by Vite. No React, no state, no IPC. | Agent 2 |
| **Agent 2** | React components | Convert Agent 1's HTML shells into reusable React components in `src/renderer/components/`. Wire up routes in App.tsx. Use mock data from `src/renderer/mock/`. | Agent 3 |
| **Agent 3** | State + real backend | Replace mock data with Zustand stores + React Query + typed IPC. Implement Electron main process IPC handlers + real Minecraft launch + real Modrinth API. | Agent 4 |
| **Agent 4** | Polish + Electron packaging | Pixel-art background canvas animation, transitions, hover states, electron-builder config, .exe packaging, final QA against all 10 screenshots. | User |

**Strict hand-off rule**: each agent commits to a git branch (`agent-1`, `agent-2`, `agent-3`, `agent-4`) and opens a PR. Agent N+1 reviews Agent N's PR before starting.

## 11. Data contracts (LOCKED — agents 2 & 3 must agree)

```ts
// types/instance.ts
type Instance = {
  id: string;            // uuid
  name: string;          // "1.21.11 Fabric"
  version: string;       // "1.21.11"
  loader: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';
  loaderVersion?: string;
  icon: string;          // path to icon
  lastPlayed?: number;   // unix ms
  mods: Mod[];
  resourcePacks: ResourcePack[];
  shaders: Shader[];
  worlds: World[];
  settings: InstanceSettings;
};

type Mod = { id: string; name: string; version: string; source: 'modrinth' | 'curseforge' | 'manual'; enabled: boolean; file: string; };
type Server = { id: string; name: string; ip: string; icon?: string; version?: string; };
type Friend = { id: string; name: string; status: 'offline' | 'online' | 'away' | 'dnd'; avatar?: string; lastSeen: number; };
type LaunchState = { status: 'idle' | 'preparing' | 'downloading' | 'launching' | 'running' | 'crashed' | 'done'; progress: number; currentFile?: string; filesDownloaded: number; filesTotal: number; logLines: LogLine[]; };
type LogLine = { ts: number; level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SUCCESS'; message: string; };
type Settings = { theme: string; accent: string; animatedDesert: boolean; blowingSand: boolean; particles: boolean; showFps: boolean; compactMode: boolean; interfaceScale: number; animationSpeed: number; maxLogLines: number; javaPath?: string; javaArgs: string; maxHeap: number; dataDir: string; };
```

## 12. Modrinth API endpoints (Agent 3 must use these — real HTTP)

- `GET https://api.modrinth.com/v2/search?query={q}&facets=[["project_type:{type}"]]&limit=20`
  - type ∈ `modpack`, `mod`, `resourcepack`, `shader`
- `GET https://api.modrinth.com/v2/project/{id}` — project detail
- `GET https://api.modrinth.com/v2/project/{id}/version?game_versions=[...]&loaders=[...]` — versions
- `GET https://api.modrinth.com/v2/project/{id}/version/{vid}` — specific version + file URL
- All requests need `User-Agent: LifeaLauncher/{version} (contact@lifea.local)`

## 13. Minecraft launch flow (Agent 3 implements)

1. User clicks Launch → set `launchState.status = 'preparing'`
2. Read `~/.lifea/instances/{id}/instance.json` → get version + loader + mods
3. Fetch Mojang version manifest: `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
4. Resolve version → fetch version JSON → extract asset index → download missing assets to `~/.lifea/assets/`
5. Resolve libraries → download missing `.jar`s to `~/.lifea/libraries/`
6. If loader === 'fabric': fetch Fabric loader manifest, resolve loader + intermediates
7. Verify all mod files present (`~/.lifea/instances/{id}/mods/*.jar`); download missing from Modrinth
8. Construct classpath + main class + args
9. Spawn `java -Xmx{maxHeap}G {javaArgs} -cp {classpath} {mainClass} --username {user} --uuid {uuid} --accessToken {token} --gameDir {instanceDir} --assetsDir {assetsDir} --version {version}`
10. Pipe stdout/stderr → `LogLine[]` → renderer via IPC event `launch:log`
11. `launchState.status = 'running'` on first window-open log line, `'crashed'` on non-zero exit, `'done'` after game closes
12. Persist `lastPlayed` to instance.json

## 14. Pixel-art assets (Agent 4 generates)

- Background scenes: 4 desert scenes red-shifted (Golden Dunes → Blood Dunes, Desert Night → Ember Night, Oasis → Ash Oasis, Sandstorm → Emberstorm)
  - Use `image-rendering: pixelated` on all
  - Canvas-based animated parallax: 3-5 layers (sky / sun / dunes / cacti / camels)
  - Speed controlled by `settings.animationSpeed`
- Character sprite: 32×32 idle/walk/wave/dance animations, 4 frames each
- Pixel icons: shield (logo), diamond (instance), cactus (empty), lightning (boost), shirt (wardrobe), lightning (boost), sword (combat), etc.
- All generated with image-generation skill / hand-drawn in Aseprite or Piskel-style SVG

## 15. Definition of done (v1)

- [ ] All 10 views render with pixel-perfect layout matching screenshots
- [ ] Red blood + ember theme applied globally via tokens
- [ ] Minecraftia font loaded and applied to all pixel titles
- [ ] Sidebar navigates between views without page reload
- [ ] Browse view hits real Modrinth API and shows real search results
- [ ] Install button on mod card downloads the .jar to the selected instance's `mods/` folder
- [ ] New instance wizard creates a real instance folder in `~/.lifea/instances/`
- [ ] Launch button spawns real `java` process and pipes logs to Console view
- [ ] Console log auto-scrolls, level filter works, copy-to-clipboard works
- [ ] Settings persists to `~/.lifea/settings.json` and applies on restart
- [ ] Friends can be added/removed (stored in `~/.lifea/friends.json`)
- [ ] Wardrobe 3D model viewer renders current skin + cape
- [ ] Boost view shows real RAM/CPU/heap detection + suggests Sodium install
- [ ] Animated pixel-art background runs at 30fps without blocking UI
- [ ] `LifeaLauncher-Setup_win.exe` builds via `npm run dist`
- [ ] All screenshots in `shared/screenshots/` match the rendered app within 95% pixel accuracy

## 16. Where to find what

| You are looking for... | Look in... |
|---|---|
| The Desertia UI analysis (per-view component breakdown) | `shared/DESSERTIA_UI_ANALYSIS.md` |
| Screenshots of every Desertia view | `shared/screenshots/*.png` |
| The complete color token list | This file §5 + `shared/DESSERTIA_UI_ANALYSIS.md` |
| Your specific task | `{your agent folder}/prompt.md` |
| The folder structure | This file §9 |
| Data contracts | This file §11 |
| Modrinth + Minecraft launch details | This file §12 + §13 |
| Definition of done | This file §15 |

---

Now open your agent folder's `prompt.md` and execute.
