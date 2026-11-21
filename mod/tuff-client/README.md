# Tuff Client

A fast, minimal Minecraft launcher with its own in-game mod. Its look comes from
the 1.21 Trial Chambers: tuff stone and copper.

```
tuff-client/
  launcher/   Tauri 2 app (Rust backend + Svelte 5 UI), ships as a .deb
  mod/        Tuff Fabric mod for Minecraft 26.3 (bundled into the launcher)
  art/        source for the painted Trial Chamber layers, emblem and icons
```

Both use the Poppins typeface (SIL Open Font License) and the same painted
chamber art, so the launcher and the game look alike.

## Launcher

- **Accounts**: Microsoft sign-in (device code, several accounts, silent token
  refresh) and offline accounts for singleplayer and offline-mode servers.
- **Profiles**: any release or snapshot, vanilla or Fabric. Each profile has its
  own folder, memory, JVM arguments, Java, resolution and icon. Libraries,
  assets and Java runtimes are shared and checked with SHA-1.
- **One-click Tuff profile**: Fabric 26.3 with the Tuff mod plus Fabric API,
  Sodium, Lithium, FerriteCore, Entity Culling, ImmediatelyFast and ModernFix.
- **Mods**: Modrinth search for mods, resource packs, shaders and modpacks,
  filtered to the profile. Installs required dependencies (and Iris for
  shaders), checks for updates in one request, lets you toggle or remove
  content, and imports `.mrpack` files.
- **Servers**: live player counts, MOTD, favicon and ping (Server List Ping
  with SRV lookup). Join goes straight into the server.
- **Wardrobe**: 3D skin preview with animations; upload or reset skins, pick
  classic or slim arms, and switch capes.
- **Screenshots**: a gallery across all profiles.
- **Console**: live game log with level filters and search, plus a plain-language
  explanation when the game crashes.
- **Performance**: Java is downloaded automatically for each version, with
  tuned G1 flags. The UI pauses its animation when unfocused, and the window
  can minimize or hide while you play.
- **Extras**: Discord Rich Presence and keyboard shortcuts (`Ctrl+1`–`8` to
  switch pages, `Ctrl+Enter` to play).

Data lives in `~/.local/share/tuff-client`.

### Build

Requires Node 22+, Rust (stable) and the WebKitGTK and GTK3 dev packages:

```sh
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libssl-dev
cd tuff-client/launcher
npm ci
npm run tauri dev                    # run in development
npx tauri build --bundles deb        # build src-tauri/target/release/bundle/deb/*.deb
```

`npm run dev` opens the UI in a plain browser with sample data, which is handy
for UI work.

### Microsoft login setup

Minecraft only accepts sign-ins from Azure apps that Mojang has approved:

1. Register an app at <https://portal.azure.com> under **App registrations**.
   Choose *Personal Microsoft accounts only* and enable **Allow public client
   flows** under Authentication.
2. Request Minecraft API access for it using Mojang's form for third-party
   launchers (linked from the Minecraft Help Center).
3. Put the client ID in the launcher (Settings → Accounts), or build with
   `TUFF_MS_CLIENT_ID=<id>` so it's baked in. The CI workflow reads it from the
   `TUFF_MS_CLIENT_ID` repository secret.

Until then, offline accounts work for singleplayer.

### Discord Rich Presence

Create an application at <https://discord.com/developers>, upload an art asset
named `tuff`, and paste the application ID in Settings → Discord (or build with
`TUFF_DISCORD_APP_ID`).

## Tuff mod

Fabric mod for Minecraft 26.3 (Java 25). The launcher installs it into Tuff
profiles automatically.

- **Title screen**: the painted Trial Chamber with parallax, flickering copper
  bulbs, a glowing spawner and drifting embers, drawn at full screen
  resolution. Rounded buttons, an account chip, and a toolbar that opens the
  menu on any page.
- **Mod menu** (Right Shift): a wide window with a top bar (Mods, Theme, Packs,
  Settings, Edit HUD) that keeps a steady size at any GUI scale.
  - *Mods*: category tabs with counts and a grid of cards, each with a large
    icon and a green ENABLED / red DISABLED bar. Type to search; right-click or
    the gear opens a settings drawer (switches, choices and sliders).
  - *Theme*: accent color (Copper, Amethyst, Mint, Sky, Rose, Gold), background
    blur and animations.
  - *Packs*: enable, disable and reorder resource packs.
  - *Settings*: title screen and background toggles, keybinds, HUD reset.
- **HUD editor**: drag modules anywhere, with snapping to screen edges, the
  center and other modules. Scroll to resize; right-click to reset.
- **HUD modules**: FPS, CPS, Keystrokes, Armor Status, Coordinates and
  direction, Ping, Potion Effects, Clock, Server address, Speed, Memory.
- **Utility and visual**: Zoom (hold C, smooth and with optional cinematic
  camera), Fullbright, Toggle Sprint, Crosshair, Hide Scoreboard.

Settings are saved to `config/tuff/config.json`.

### Art

`art/chamber.html` paints the chamber layers on a canvas; `art/render.mjs`
renders them with Playwright into the mod and the launcher, and
`art/sprites.py` builds the mod's icon and rounded-corner sprites.

```sh
PLAYWRIGHT_PATH=$(npm root -g)/playwright node tuff-client/art/render.mjs
python3 tuff-client/art/sprites.py
```

```sh
cd tuff-client/mod
./gradlew build      # build/libs/tuff-client-1.0.0+mc26.3.jar
```

## CI

`.github/workflows/tuff-client.yml`:

- builds the mod and uploads the jar;
- boots real Minecraft with the mod (Fabric client game test on Mesa's software
  Vulkan driver). The test checks that the Tuff title screen replaces the
  vanilla one, opens every mod menu page, the settings drawer and the HUD editor in a world, checks that zoom
  magnifies the rendered image and that fullbright toggles cleanly, and saves
  screenshots of each step (`./gradlew runClientGameTest` locally);
- bundles the mod into the launcher, runs the Rust tests and Svelte type
  checks, and uploads the `.deb`.

Tuff Client is not an official Minecraft product and is not approved by or
associated with Mojang or Microsoft.
