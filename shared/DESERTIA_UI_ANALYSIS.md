# Desertia Launcher — Full UI/UX Analysis (Reference)

This file is the complete per-view analysis of the Desertia launcher, used as the pixel-perfect reference for LifeaLauncher. Each section corresponds to one screenshot in `shared/screenshots/`.

---

## Image 01 — Home / Launch Dashboard

**Screenshot**: `shared/screenshots/01_home_launch_dashboard.png`

### Layout
- **Sidebar (Left)**: Fixed vertical navigation rail (~240px wide). Logo + version tag at top, nav items, user profile at bottom.
- **Main Content Area (Center-Left)**: Vertical stack — version header → launch controls → profile selector → server list.
- **Background Layer (Right/Full)**: Immersive animated pixel-art desert scene (parallax) serving as the visual canvas.
- **Overlay Elements**: Floating animation controls (Idle / Wave / Walk / Dance) on the right; persistent "Launching" toast bottom-right.

### UI Components
- **Navigation Sidebar**: Vertical list of icon-button pairs (Home, Library, Browse, Boost, Wardrobe, Friends, Console, Settings).
- **Header**: Large pixel-font title ("1.21.11 Fabric") with metadata badges (Version ID, Player count).
- **Launch Control Group**:
  - Primary Action Button: Large red "LAUNCHING" button with a play icon.
  - Secondary Action Button: Small square button with a dropdown caret.
  - Status Text: Download progress ("Files 1540/4676...").
  - Info Chip/Pill: Dark rounded rectangle showing "Boost score 78".
- **"Jump back in" Section**:
  - Profile Card: Selected instance card with icon, title, subtitle, status indicator (green dot).
  - Action Link: "+ New profile" text button.
- **Servers Section**:
  - Section Header: "Servers" title with "+ Add server" link.
  - Server Card Grid: Each card has server icon (square), name & subtitle, status indicator (green dot + ping/players), context menu ("...").
- **Bottom Toast/Modal**: Dark floating panel in bottom-right showing real-time launch progress with a progress bar and percentage.

### Color Scheme (hex estimates from Desertia — to be replaced with red)
- Background (Scene): Deep purple/magenta gradient (`#2D1B3D` to `#4A2545`) → **LifeaLauncher uses blood-red gradient `#14080a` to `#2b161a`**
- Sidebar Background: Near-black (`#121212`) → `#1c0d0f`
- Primary Action (Red): Bright coral-red (`#E53935`) → **`#8b0000` (blood)**
- Card/Surface Background: Translucent dark gray (`rgba(20, 20, 20, 0.8)`) → `rgba(33, 18, 21, 0.85)`
- Text Primary: Off-white/Light cream (`#F5F5F5`) → `#f5e6e6`
- Text Secondary/Muted: Gray (`#9E9E9E`) → `#a08585`
- Accent (Green): Online status (`#4CAF50`) → keep `#4ade80`
- Borders/Subtle Dividers: Dark charcoal (`#333333`) → `rgba(255,255,255,0.06)`

### Typography
- Headers (Version): Pixel/Bitmap font (Minecraftia). Very large, white, blocky.
- Body Text: Sans-Serif (Inter), medium weight, high readability.
- Buttons: Sans-Serif, uppercase, bold/semi-bold, slight letter-spacing.

### Icons
- Line-icons (outlined), consistent stroke width (~2px).
- Home (House), Library (Books), Browse (Globe), Boost (Lightning), Wardrobe (Hanger), Friends (Users), Console (Terminal), Settings (Gear).
- Status Icons: Green dots (online), Lightning bolt (boost).

### Spacing/Border-Radius
- Buttons/Cards: ~8–12px radius.
- Chips/Pills: fully rounded (pill shape).
- Generous padding inside cards (~16–20px).

### Interactive Elements
- Hover States: brightness increase or subtle lift.
- Active State: "Home" icon has accent background highlight.
- Progress Bar: animated fill in bottom-right toast.
- Animation Toggles: Idle / Wave / Walk / Dance buttons.

### Unique Design Features
- Immersive pixel-art background (parallax-capable, layered).
- "Living" launcher with drifting clouds, moving sun, controllable character.
- Contextual launch feedback — button text changes during launch.

---

## Image 02 — Browse / Modrinth Marketplace

**Screenshot**: `shared/screenshots/02_browse_modrinth.png`

### Layout
- Sidebar consistent with Home.
- Header: Title "Browse", subtitle, attribution "powered by Modrinth".
- Filter/Toolbar Row:
  - Left: Category Tabs (Modpacks / Mods / Resource Packs / Shaders).
  - Center: Search Input field.
  - Right: Filter Dropdowns (Install to..., Versions, Loaders, Sort by).
- Content Grid: standard grid of mod cards.

### UI Components
- Segmented Control / Tabs: text tabs with icons, active tab has red underline.
- Search Bar: large input with magnifier icon + placeholder.
- Dropdown Selectors: styled dropdown buttons for filtering.
- Primary CTA Button: red "Install to..." dropdown button.
- Mod Cards:
  - Icon: square image (left).
  - Content (right): Title (bold), Author (gray, small), Description (2-line truncated).
  - Metadata Row: download count (arrow), heart count, category tag.
  - Action Button: red "Install" with download icon (top-right).

### Color Scheme
- Background: Dark solid `#1A1A1A` → `#14080a`.
- Active Tab Indicator: red `#E53935` → `#8b0000`.
- Card Background: `#242424` → `#211215`.
- Text: White headers, gray body.
- Tags: dark gray bg `#333` + light gray text → `#2b161a` + `#a08585`.

### Typography
- Title: pixel font "Browse".
- Mod Titles: bold sans-serif.
- Metadata: small muted sans-serif.

### Icons
- Tab Icons: Box (Modpacks), Cube/Puzzle (Mods), Image (Resource Packs), Sparkles (Shaders).
- Action Icons: Download arrow, Search, Chevron down.

### Spacing/Border-Radius
- Cards: ~8px radius.
- Grid Gap: ~16–24px.
- Inputs: ~4–6px radius.

### Interactive
- Tab Switching changes content + underline.
- Hover on Cards: raises card (shadow) or border highlight.
- Install Button: high-contrast red draws attention.

### Unique
- Integrated Modrinth backend (real API).
- One-click Install-to-instance flow.
- Visual hierarchy: red reserved for primary actions.

---

## Image 03 — Settings / Appearance

**Screenshot**: `shared/screenshots/03_settings_appearance.png`

### Layout
- Sidebar consistent.
- Main Content: single column.
- Section 1 (Appearance): theme selection via large preview cards.
- Section 2 (Customization): vertical list of options (Accent color, Toggles, Sliders).

### UI Components
- Theme Selector Cards:
  - Preview Image: large rectangular illustration of background style ("Golden Dunes", "Desert Night").
  - Label: Theme Name (bold).
  - Description: short flavor text.
  - Selection State: selected card has prominent **orange/gold border** → **RED border in LifeaLauncher**.
- Color Palette Grid: horizontal row of circular color swatches for "Accent color", includes "+" for custom.
- Toggle Switches: "Animated desert", "Blowing sand" — iOS-style, orange when active → RED when active.
- Slider: "Interface scale" with track + thumb.

### Color Scheme
- Background: `#1E1E1E` → `#14080a`.
- Selection Border: gold `#FFB300` → **`#8b0000`**.
- Active Toggle: orange `#FB8C00` → **`#b71c1c`**.
- Swatches: standard web colors (Red, Orange, Yellow, Teal, Blue, Purple, Pink, Lime).

### Typography
- Headings: pixel font ("Settings", "Appearance").
- Labels: clean sans-serif, medium weight.
- Descriptions: lighter weight, smaller, gray.

### Icons
- Settings icon in sidebar highlighted to indicate current page.
- Plus icon inside color picker for custom values.

### Spacing/Radius
- Theme Cards: ~8–12px radius, generous internal padding.
- Color Swatches: perfect circles.
- Toggles: standard pill shape.

### Unique
- Thematic consistency: offers biomes/times-of-day, not just "dark mode".
- Visual previews: illustrated cards instead of text dropdowns.
- Granular environmental controls (blowing sand, particles).

---

## Image 04 — Console / Launch Log

**Screenshot**: `shared/screenshots/04_console_log.png`

### Layout
- Header Bar: branding + window controls + version tag.
- Sidebar Navigation: vertical icon rail.
- Main Content:
  - Top: status header ("Console" title + "Launching" status).
  - Toolbar: filter controls (version dropdown, log level tabs, search).
  - Log Viewport: scrollable terminal-style text area.

### UI Components
- Branding Header: Logo icon + "DESERTIA" text + version tag (`v0.1.37`). → **"LIFEA" for LifeaLauncher**.
- Window Controls: Minimize, Maximize, Close.
- Navigation Sidebar: 8 items with icons + text labels.
- Status Indicator: green dot + "Launching" text.
- Dropdown Selector: "1.21.1 Fabric" version selector with chevron.
- Segmented Control: "All" / "Warn+" / "Errors" (log level filters).
- Search Input: text field with magnifier, placeholder "Filter log".
- Action Buttons (top right): two icon buttons (Copy, Open Folder).
- Log Terminal: multi-line text display, dark bg, monospaced.

### Color Scheme
| Element | Desertia | LifeaLauncher |
|---|---|---|
| Background (App) | `#1a1410` | `#14080a` |
| Background (Sidebar) | `#231b16` | `#1c0d0f` |
| Background (Terminal) | `#0d0b09` | `#0a0405` |
| Primary Text | `#f0e6d8` | `#f5e6e6` |
| Secondary Text | `#8c7e6d` | `#a08585` |
| Accent (Active/Green) | `#4ade80` | `#4ade80` (keep) |
| Accent (Button/Selected) | `#fbbf24` | `#8b0000` |
| Log Text (Output) | `#f59e0b` | `#ef4444` (red log text — fits theme) |
| Borders | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.06)` |

### Typography
- Headings: pixel font (Minecraftia), uppercase.
- Body/Log: monospace (JetBrains Mono).
- UI Elements: sans-serif (Inter).

### Icons
- Logo: Shield/Emblem.
- Home, Book (Library), Globe (Browse), Lightning (Boost), Hanger (Wardrobe), Search, Copy, Folder.

### Spacing/Radius
- Generally sharp corners (0–2px) for retro feel.
- Active pill radius ~20px+.
- Terminal container ~8–12px.
- Sidebar width ~70–80px (but Desertia has wider — LifeaLauncher uses 240px).
- Main padding ~24–32px horizontal, ~20px vertical.

### Interactive
- Nav links hover + active state.
- Version dropdown clickable.
- Log level filters toggle.
- Search real-time filtering.
- Copy log to clipboard + open log folder.

### Unique
- Retro-terminal aesthetic (black void + amber text). LifeaLauncher keeps black bg but uses red-tinted log text.
- Status integration (Launching under title).
- Pixel-art branding.

---

## Image 05 — Friends / Social Hub

**Screenshot**: `shared/screenshots/05_friends_social.png`

### Layout
- Sidebar consistent.
- Main Content:
  - Header (top left): page title + subtitle (friend counts).
  - Action Bar (top right): input + primary button.
  - Main Stage: atmospheric desert background as empty-state visual.
  - Footer overlay: silhouettes (camels/figures) for depth.

### UI Components
- Large bitmap title "Friends".
- Stats line: "0 online : 0 friends".
- Section header: "ONLINE 0" (uppercase tracked).
- Helper text: "Add your friends...".
- Input Group: text input + primary "+ Add" button.
- Background Art: pixel-art desert sunset/moonrise.

### Color Scheme
| Element | Desertia | LifeaLauncher |
|---|---|---|
| Background (Scene) | `#2d1f1c` to `#4a3229` | `#2b161a` to `#14080a` |
| Moon/Light | `#9dab7c` | `#ff6b35` (ember) |
| Text Primary | `#ffffff` | `#f5e6e6` |
| Text Secondary | `#b0a298` | `#a08585` |
| Button Primary | `#f39c12` / `#e67e22` | `#8b0000` (blood) |
| Input Background | `#1f1512` | `#1a0a0c` |
| Silhouettes | `#1A1210` | `#0a0405` |

### Typography
- Title: large bold pixel font.
- Body: clean sans-serif.
- Labels: uppercase tracked ("ONLINE").

### Icons
- Plus icon inside Add button.
- Background pixel-art elements (clouds, sun, camels).

### Spacing/Radius
- Input: ~20px or 999px (pill).
- Button: ~6–8px.
- Asymmetric layout — content pushed left/top, right side breathes.

### Interactive
- Text input focusable.
- Add button CTA.
- Implicit friend cards populate under "ONLINE".

### Unique
- Atmospheric empty state (lonely desert scene) instead of generic empty icon.
- Visual depth via parallax-like layers.
- Contextual Minecraft integration (friend = Minecraft username).

---

## Image 06 + 07 — Wardrobe (Capes + Skin)

**Screenshots**: `shared/screenshots/06_wardrobe_capes.png` + `07_wardrobe_skin.png`

### Layout
- Sidebar (left) | Main Content (center/right) | Overlay Toast (bottom-right).
- Header integrated into sidebar top.
- Sidebar: 240px, full-height nav.
- Content: Preview Panel (left) + Selection Grid (right).

### UI Components
- Navigation Sidebar: icon + text items.
- User Profile Card (sidebar bottom): avatar + username.
- Page Header: "Wardrobe" + subtitle.
- Model Viewer (3D Preview): central container with Minecraft character model.
- Animation Controls: Idle / Walk toggle.
- View Controls: Back / Front.
- Segmented Control (Tabs): Capes / Skin.
- Item Grid: 5-column grid of selectable cards.
- Item Card: thumbnail + label + optional "Animated" badge.
- Selection Indicator: checkmark circle on active card.
- Progress Toast: floating card with title, percentage, file stats, progress bar.

### Color Scheme
| Element | Desertia | LifeaLauncher |
|---|---|---|
| Background (App) | `#1a1512` | `#14080a` |
| Background (Panel/Card) | `#231d19` | `#211215` |
| Background (Sidebar Hover) | `#2e2621` | `#2b161a` |
| Background (Sidebar Active) | `#3d342c` | `#450a0a` (dark red tint) |
| Accent (Primary/Gold) | `#e6a23c` | `#8b0000` |
| Accent (Hover) | `#f0b855` | `#b91c1c` |
| Text Primary | `#ffffff` | `#f5e6e6` |
| Text Secondary | `#9e988f` | `#a08585` |
| Border (Card) | `#3d342c` | `rgba(255,255,255,0.06)` |
| Border (Selected Card) | `#e6a23c` (gold, 2px) | `#8b0000` (blood, 3px) |
| Badge Background | `#4a3f35` | `#5d0000` |

### Typography
- Pixel font (Minecraftia / Press Start 2P / VCR OSD Mono). Bold fallback sans-serif.
- Page Title: ~32px bold white.
- Subtitle: ~14px regular muted.
- Card Labels: ~12px medium centered.
- Button Text: ~13px bold uppercase.
- Stats/Small: ~11px monospace.

### Icons
- Line-icons, ~2px stroke.
- Tab icons: Cape (arrow up from box), Skin (user silhouette).
- Sidebar icons same as Home.

### Spacing/Radius
- Sidebar: 220–250px.
- Card Grid Gap: 16px.
- Card Padding: 12px.
- Card Radius: 8–12px.
- Button Radius: 6–8px (pill for toggles).
- Main padding: 32px.

### Interactive
- Sidebar items: transparent → hover bg highlight → active solid bg + left border accent.
- Cards: dark border → hover scale/brightness → selected gold border (red in LL) + checkmark.
- Primary buttons: gradient/solid, hover brightens, click depresses.
- Toggles: pill shape, active solid bg.

### Unique
- Pixel-art aesthetic with subtle dark desert scenery.
- 3D model viewer seamlessly integrated into dark panel.
- Golden checkmark (red in LL) on selected item.
- Pixelated-style segmented progress bar in toast.

---

## Image 08 — Boost / Performance

**Screenshot**: `shared/screenshots/08_boost_performance.png`

### Layout
- Sidebar (left) | Header (top) | Content (center).

### UI Components
- Score Circle: large circular progress/ring showing "78 of 100".
- Status List: vertical list of suggestion cards:
  - Warning Card: red accent square icon, Title ("Missing Sodium"), Description, Impact Tag ("High impact"), Action Button ("Install Boost mods").
  - Info Card: green accent square icon, Title, Description, Status Tag ("Small win").
- Stats Row: 4 horizontal cards at bottom (System RAM, CPU threads, Game heap, GC preset).

### Color Scheme
- Same base dark theme.
- Success/Positive: `#4ade80` (green) — keep.
- Danger/Warning: `#ef4444` (red) — keep (matches our theme!).
- Ring Progress: gold `#e6a23c` → **red `#8b0000` arc**.

### Typography
- Score Number: ~48px+ bold pixel/mono.
- Tags: uppercase, ~10px, wide tracking.

### Icons
- Pixel-art style (RAM stick, CPU, lightning, sliders).
- Status icons: geometric squares with symbols inside.

### Spacing/Radius
- Suggestion cards: large padding ~20px, radius ~12px.
- Bottom stats: equal-width flex row, gap ~16px.

### Interactive
- "Install Boost mods" button: outlined → solid gold (red) on hover.
- Impact tags: non-interactive badges.

### Unique
- Gamification: circular score creates optimization meta-game.
- Color-coded severity (red warning, green info).

---

## Image 09 — Library / Instances (Empty)

**Screenshot**: `shared/screenshots/09_library_empty.png`

### Layout
- Sidebar (left) | Header (title + actions) | Content (centered empty state).

### UI Components
- Search Bar: dark input + magnifier.
- Dropdown: "Last played" sort selector.
- Action Buttons: "Import" (secondary), "New instance" (primary gold → red).
- Empty State Illustration: large pixel-art cactus.
- Empty State Text: "It's quiet out here" + subtext.
- CTA Buttons: "New instance" + "Browse modpacks".

### Color Scheme
- Input Background: `#1c1816` → `#1a0a0c`.
- Input Border: `#3d342c` → `#3d2226`.
- Illustration: green `#4ade80` (cactus) + `#d97706` (sand) — LifeaLauncher keeps cactus green but shifts sand to ember `#ff4500`.

### Typography
- Empty State Headline: ~28px bold white.
- Count Text: "0 instances" — muted, small.

### Icons
- Standard line icons: search, import (download), plus.

### Spacing/Radius
- Search Bar Height: ~40px, radius ~8px (pill).
- Empty State: centered, large margins ~100px+.

### Unique
- Thematic empty state (pixel cactus).
- Atmospheric background visible due to empty content.

---

## Image 10 — Instance Detail (Launching State)

**Screenshot**: `shared/screenshots/10_instance_detail_launching.png`

### Layout
- Sidebar (left) | Breadcrumb (top) | Instance Header (hero) | Tab Bar | Content Area | Toast (bottom right).

### UI Components
- Breadcrumb: "< Library" back navigation.
- Instance Hero Card:
  - Icon: large pixel-art diamond/sun icon.
  - Title: "1.21.11 Fabric" (large bold).
  - Metadata Row: badges (Fabric, Version 1.21.11, 0.19.5, Last played).
  - Launch Button: large prominent gold gradient → **red gradient**, play icon, text "LAUNCHING" (state).
  - Folder Action: small icon button beside launch.
- Navigation Tabs: Mods (active), Resource Packs, Shaders, Worlds, Settings. Active tab has underline/accent.
- Toolbar: filter input, count text ("0 installed · 0 enabled"), actions (Folder, Add file, Find mods).
- Empty Content Area: "No mods yet." with icon.
- Progress Toast: same as Home, at 1% progress.

### Color Scheme
- Launch Button (Active): gold gradient `#fbbf24` → `#f59e0b` → **red gradient `#8b0000` → `#5d0000`**. Text dark when active.
- Launch Button (Default): dark bg + gold border/text → dark bg + red border/text.
- Tag Badges: dark bg `#2e2621` + light text + 4px radius.
- Tab Underline: gold 3px → **red 3px**.

### Typography
- Instance Title: ~36px extra bold.
- Metadata: ~12px monospace muted.
- Launch Button Text: ~14px bold uppercase letter-spaced.

### Icons
- Instance Icon: pixel-art glowing diamond/sun.
- Tab Icons: puzzle (Mods), box (Resource Packs), sparkles (Shaders), globe (Worlds), gear (Settings).

### Spacing/Radius
- Hero Card: large padding ~24px, radius ~16px.
- Launch Button: height ~48px, horizontal padding ~32px, radius ~8px.
- Tabs: gap ~24px, padding-bottom ~12px (underline space).

### Interactive
- Launch Button States:
  - Default: dark + gold (red) outline.
  - Hover: gold (red) bg, dark text.
  - Launching (Active): solid gold (red), darker text, possibly disabled cursor / loading.
- Tabs: text color muted → white/gold (red), underline on active.

### Unique
- Contextual header changes based on selection.
- Explicit "LAUNCHING" button text indicates process start.
- Balances large title/action with dense metadata.

---

## Global Conversion Table (Desertia → LifeaLauncher)

| Element | Desertia (gold/warm) | LifeaLauncher (blood + ember) |
|---|---|---|
| Primary Accent | `#e6a23c` (gold) | **`#8b0000` (blood)** |
| Accent Hover | `#f0b855` | **`#b71c1c` (red-700)** |
| Accent Glow / Focus | — | **`#ef4444`** |
| Accent Deep / Pressed | — | **`#5d0000`** |
| Selected Border | `#e6a23c` | **`#8b0000`** |
| Active Sidebar BG | `#3d342c` | **`#450a0a` (dark red tint)** |
| Launch Button (Active) | Gold gradient `#fbbf24` → `#f59e0b` | **Red gradient `#8b0000` → `#5d0000`** |
| Active Toggle | `#FB8C00` | **`#b91c1c`** |
| Ember accent (secondary) | — | **`#ff4500`** |
| Warm accent (sparingly) | — | **`#ffc107`** |
| Warning / Danger | `#ef4444` | keep `#ef4444` |
| Success | `#4ade80` | keep `#4ade80` |

## Key Visual Traits to Maintain

1. **Dark mode base**: backgrounds `#14080a` to `#2b161a` (very dark, red-tinted).
2. **Pixel font**: Minecraftia / Monocraft for all interface titles.
3. **Rounded corners**: 8–12px for cards and buttons.
4. **Pixel-art assets**: replace gold/desert backgrounds with **red-shifted desert scenes** (Blood Dunes / Ember Night / Ash Oasis / Emberstorm).
5. **Transparency layers**: semi-transparent black `rgba(0,0,0,0.5)` for overlay backdrops and toast shadows.
6. **Pixel-perfect rendering**: `image-rendering: pixelated` on all pixel-art assets.
7. **Parallax background**: 3-5 layered pixel-art canvas, animated at 30fps.
8. **Controllable character**: blue blocky figure with Idle/Wave/Walk/Dance animations.
9. **Floating launch toast**: persistent bottom-right progress indicator during launch.
10. **Line icons** with ~2px stroke (lucide-react).
