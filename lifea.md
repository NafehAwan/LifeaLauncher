# LifeaLauncher and Lifea Client — Project Guide

> Repository guide written from the checked-out source. It describes what this repository contains and what it can currently do, and separates verified targets from planned or attempted work. It is not a promise that every Minecraft version can load the Lifea client.

## Contents

1. [Project at a glance](#project-at-a-glance)
2. [The key version-support distinction](#the-key-version-support-distinction)
3. [Repository map](#repository-map)
4. [Launcher architecture](#launcher-architecture)
5. [Minecraft profile and launch lifecycle](#minecraft-profile-and-launch-lifecycle)
6. [Accounts and authentication](#accounts-and-authentication)
7. [Mods, modpacks, and optimization](#mods-modpacks-and-optimization)
8. [LifeaCore in-game client](#lifeacore-in-game-client)
9. [Tuff Client relationship](#tuff-client-relationship)
10. [Wardrobe and cosmetic synchronization](#wardrobe-and-cosmetic-synchronization)
11. [Lifea backend](#lifea-backend)
12. [UI and product design](#ui-and-product-design)
13. [Storage and data](#storage-and-data)
14. [Build, CI, and releases](#build-ci-and-releases)
15. [Current compatibility matrix](#current-compatibility-matrix)
16. [Known limitations and failure states](#known-limitations-and-failure-states)
17. [How to add support for another Minecraft version](#how-to-add-support-for-another-minecraft-version)
18. [Developer commands and troubleshooting](#developer-commands-and-troubleshooting)
19. [Security, licensing, and project boundaries](#security-licensing-and-project-boundaries)
20. [Quick answers for players](#quick-answers-for-players)

## Project at a glance

LifeaLauncher is an Electron desktop application for managing Minecraft Java installations and profiles. Its UI is a React application, while privileged filesystem, process, networking, account, and game-launch operations run in Electron's main process. A small preload bridge exposes a deliberately limited IPC surface to the renderer.

The project also contains two distinct game-side codebases:

* **LifeaCore** is the Lifea in-game client mod. Its currently verified target is Fabric for Minecraft **1.21.4**. Its menus and HUD are opened in-game with Right Shift.
* **Tuff Client** is a separate supplied client project under `mod/tuff-client`, targeting Fabric Minecraft **26.3** with Java 25. It is not a version port of LifeaCore and does not mean LifeaCore supports 26.3.

The launcher, LifeaCore, Tuff Client, and the optional Lifea backend are related product components, but they are separate builds and have separate compatibility boundaries. A launcher feature such as “create a 1.21.11 profile” does not imply that the LifeaCore mod can load on 1.21.11.

Project package metadata currently reports LifeaLauncher version **1.1.2**. The checked-out release and source should be treated according to their actual commit and successful build artifacts, not solely by the version label.

## The key version-support distinction

There are several different meanings of “support a Minecraft version”:

1. **The launcher knows the version exists.** It can read Mojang's version manifest and offer a vanilla profile.
2. **The launcher can install and launch the game.** It resolves the version JSON, libraries, assets, natives, and a compatible Java runtime, then starts Minecraft.
3. **A loader can be installed for the version.** Fabric, Quilt, Forge, or NeoForge support depends on the loader's own metadata and version availability.
4. **LifeaCore can be loaded.** A compatible mod artifact must have been built for that exact Minecraft/API/mapping and loader combination.
5. **A feature works at runtime.** The jar must not only build; its injections, rendering, networking and game hooks must work on the target game.

Only the first two concerns are general launcher capabilities. LifeaCore has a much narrower verified range today. The launcher must never inject a jar compiled for one Minecraft version into a different version: that can cause class-loading errors, missing methods, mixin failures, crashes, or subtle broken behavior.

### How a 1.21.11 player can play

With the present code, a player can use a vanilla 1.21.11 profile if the official manifest and required files are available. A Fabric 1.21.11 profile may also be creatable when Fabric publishes a compatible loader build. But **the LifeaCore features do not currently accompany that profile**: the attempted separate LifeaCore 1.21.11 build fails compilation and therefore must not be advertised or injected as a working client build.

To play 1.21.11 *with LifeaCore*, the project needs a real, compiling 1.21.11 Fabric port, runtime validation, a version-labelled jar in the bundle, and a launcher rule that selects that jar only for 1.21.11. Until these steps succeed, the honest options are to play plain Minecraft on 1.21.11 or play the LifeaCore client on its supported 1.21.4 profile.

The same rule applies to every other version. “All Minecraft versions” requires a compatibility build for every version (or a carefully defined set of compatible version ranges) and each supported loader. It cannot be achieved by changing a version string in the jar or by using a single universal jar across Minecraft's breaking API changes.

## Repository map

```text
src/
  main/                 Electron main process and launcher services
    accounts/            Microsoft and offline account operations
    core/                app paths, settings, logging, HTTP/filesystem helpers
    game/                versions, profiles, install, launch, modrinth, sync
      loaders/           Fabric and Forge installer integration
    servers/             server list, MOTD parsing, ping
    social/              optional Lifea backend client
  preload/               narrow, sandbox-safe renderer bridge
  renderer/              React pages, components, query hooks, UI state
  shared/                 IPC contracts, Zod schemas, domain types
mod/
  src/main/               LifeaCore source (currently Fabric 1.21.4)
  mc1_21_11/               attempted isolated 1.21.11 build; currently fails
  tuff-client/             separate Fabric 26.3 Tuff Client source
server/                    optional Fastify Lifea backend
resources/
  lifea-core/              exact-version client jars staged for packaging
  default-capes/           bundled cape textures
  default-skins/           bundled default skin textures
build/                     app icons and electron-builder resources
scripts/                   asset-generation and project utility scripts
test/                      Vitest tests and fixtures
e2e/                       Playwright end-to-end tests
.github/workflows/         CI, Windows installer and release pipelines
docs/design/               UI design comparison materials
```

### Important source entry points

* `src/main/index.ts`: creates the Electron application, windows and service lifecycle.
* `src/main/ipc.ts`: registers renderer-to-main handlers and validates arguments.
* `src/preload/index.ts`: exposes the approved IPC methods to React without granting Node access.
* `src/shared/ipc.ts`, `src/shared/schemas.ts`, `src/shared/types.ts`: IPC contract and shared data model.
* `src/main/game/versions.ts`, `resolve.ts`, `download.ts`, `assets.ts`, `natives.ts`, `java.ts`, `launch.ts`: game installation and launch pipeline.
* `src/main/lifea-core.ts`: pre-launch integration for performance profiles, exact-version client jars, cosmetic sync and the local bridge.
* `src/main/game/modrinth.ts`, `mrpack.ts`: Modrinth projects, versions, installation and modpack handling.
* `src/renderer/App.tsx` and `src/renderer/pages/`: route-level UI.
* `mod/src/main/java/gg/lifea/core/`: LifeaCore implementation.
* `mod/tuff-client/src/main/java/net/tuffclient/`: separate Tuff Client implementation.
* `server/src/app.ts`: backend HTTP and realtime API.

## Launcher architecture

### Main, preload, renderer, and shared contract

The **main process** owns privileged operations. It reads and writes application data, installs Minecraft files, manages child processes, downloads content, stores accounts, and talks to the optional backend. The **renderer** is a React UI; it should request those operations through the preload bridge rather than accessing Node APIs directly. The **preload** exposes a small allowlisted API and translates IPC events and calls.

The shared directory defines request and response types and Zod validation. Keeping these contracts shared reduces mismatches between UI and main process, but runtime validation still matters: TypeScript types alone do not validate IPC messages at runtime.

The app is built with Electron 33, React 18, TypeScript 5.9, Vite 5, and electron-builder. Vite builds the renderer; TypeScript builds Electron main/preload outputs. `package.json` is the source for the app version and scripts.

### Navigation and major launcher pages

The source includes these pages/features:

* **Home**: selected account and profile, launch action, recent/featured activity.
* **Library**: instance/profile list and profile management.
* **Browse**: Modrinth content discovery and installation.
* **Boost**: performance profile actions and session statistics received from a Lifea client bridge when available.
* **Wardrobe**: local skin/cape/cosmetic selection and preview, with backend cosmetic capabilities where configured.
* **Servers**: saved servers, status/MOTD display, and partnered server presentation.
* **Friends**: optional backend-powered social functionality; it requires a reachable configured backend and appropriate account authentication.
* **Profile**: selected account information and skin details.
* **Screenshots**: per-instance screenshot listing/viewing.
* **Console**: launcher/game logs, launch status, and diagnostic actions.
* **Settings**: game directory, Java, memory/JVM options, theme, UI behavior, backend URL and other preferences.
* **Showcase**: promotional or featured content.

Common UI elements include the left icon rail, account menu, command palette, launch status toast, error boundary, crash banner, and profile creation modal. The primary visual direction uses dark surfaces, red accents, rounded panels, and custom launcher branding.

## Minecraft profile and launch lifecycle

An `Instance` is a named profile containing a Minecraft version, loader selection, optional loader version, icon, user settings, last-played time, and content metadata. The on-disk folder content remains the source of truth for installed files; metadata supplements it with project names and enabled state.

Typical flow:

1. The renderer requests version and loader choices through IPC.
2. The main process reads official Minecraft metadata and loader metadata.
3. On profile creation or first launch, missing game JSON, libraries, assets and native files are resolved and downloaded.
4. A compatible Java runtime is selected or installed. Runtime requirements vary by Minecraft version; older Minecraft commonly needs Java 8, 1.17-era games Java 17, and newer releases Java 21 or later as required by Mojang.
5. Loader installation runs through the appropriate loader integration when a modded profile is requested.
6. The launch service builds classpath, JVM and game arguments, extracts/locates native libraries, and starts the game process.
7. Process output and exit status update launch state and logs. Crash analysis can present actionable hints such as correcting Java or memory settings.
8. Pre-launch hooks run before process creation. Lifea's hook is responsible for optional performance-pack setup, matching client jar injection and local bridge/cosmetics arguments.

The app supports per-instance settings such as memory, custom Java path, JVM arguments, display resolution/fullscreen and pre-launch command. User settings also include the game directory, default memory, GC preset, JVM defaults, Java overrides and parallel download count.

### Loader coverage

The shared `Loader` domain type contains `vanilla`, `fabric`, `quilt`, `forge`, and `neoforge`. A type union is not proof that every loader/version pair has a complete installer implementation. The source includes explicit Fabric and Forge integrations; inspect current runtime code and loader metadata before claiming every NeoForge/Quilt combination works. Profile creation should only offer combinations for which installation is implemented and metadata reports a compatible version.

## Accounts and authentication

The account domain distinguishes `msa` (Microsoft account) and `offline`. An account stores a launcher-level identifier, player name, UUID, optional skin and cape URLs, locally selected skin/cape filenames, optional locally selected Lifea cosmetic identifiers, and creation time.

* **Microsoft account** authentication is an OAuth flow managed by the main process and a dedicated login window. It depends on an application client ID configured for Microsoft/Minecraft sign-in and approval for the required Minecraft services. The app does not use the guessed universal Xbox application ID from earlier discussion as a substitute for proper application registration. An invalid client ID or unapproved redirect/scopes can prevent sign-in.
* **Offline account** is a local username/UUID identity for offline play and singleplayer/LAN use. It is not a licensed Microsoft identity and cannot authenticate with online-mode servers that require Microsoft ownership.

Account files live in the application user-data area. The account store should preserve a recoverable copy before migrating an unknown schema; user account data is valuable and must not be overwritten merely to make a malformed file parse. The selected account is passed to launch and cosmetic sync logic.

## Mods, modpacks, and optimization

### Modrinth

The launcher integrates Modrinth's public API to search projects and versions and download compatible content. Project types include mods, modpacks, resource packs and shaders. Installation must filter by Minecraft version, loader, file type, client/server compatibility and declared dependencies. The `.mrpack` path reads the pack manifest and downloads allowed files/dependencies rather than treating an archive as an arbitrary executable.

The launcher does not make every Modrinth project compatible. Compatibility is determined by the content's published metadata and the selected profile's game/loader version. A mod for Fabric 1.21.4 cannot be assumed to work on Forge 1.21.4 or Fabric 1.21.11.

### Boost and JVM options

The project has a Boost service and settings for G1GC/ZGC presets, memory and JVM arguments. The built-in optimization action installs a version-appropriate set of performance mods for supported profile types. The exact mod list and available versions must come from current Modrinth metadata and compatibility filters. “Optimized” is not a universal guarantee: gains depend on CPU, GPU, RAM, driver, game version, mods, resolution and world/server workload.

JVM tuning must respect the Java runtime and Minecraft version. G1GC is broadly compatible; ZGC should be enabled only when the selected Java version supports it and a user has a reason to choose it. Do not advertise a guaranteed percentage FPS improvement without repeatable benchmarks on defined machines and workloads.

The launcher cannot rewrite Minecraft's renderer or safely move arbitrary entity/world logic to worker threads. Large client performance changes are normally provided by maintained optimization mods such as Sodium and Lithium for matching loader/version combinations, not by changing a launcher flag.

## LifeaCore in-game client

LifeaCore is a Fabric mod under `mod/`, with Java sources in `mod/src/main/java/gg/lifea/core`. In the supported build, Right Shift opens its menu. The source includes configuration, feature/module registration, HUD drawing, trackers, waypoints, mixins, a launcher bridge, cosmetics and a player cosmetic renderer.

Documented feature areas include:

* HUD modules: FPS, CPS, keystrokes, ping, coordinates/facing/biome, armor, potion effects and waypoints. Optional modules include held item, clock, server, memory, speed, combo, saturation and day count.
* Utility controls: zoom (C), freelook (Left Alt), toggle sprint/sneak, fullbright and custom crosshair styles/colors.
* Waypoints: B adds a waypoint and death position can be stored.
* Partner server behavior: the LifeaMC entry is protected in the builds that implement the relevant mixin. The 1.21.4 LifeaCore and separate 26.3 Tuff build have this behavior; on other vanilla versions no such mod-side lock is available.
* Server rules: a custom payload may disable modules by id on servers that implement the corresponding protocol.

The client is not a replacement Minecraft game engine. It runs on top of the game and loader APIs for its target version. It does not replace all vanilla rendering, chunk generation, physics, entity ticks or memory management, and no checked-in benchmark demonstrates that it outperforms Lunar Client.

### Current LifeaCore build status

The root `mod` Gradle project is the Minecraft 1.21.4 Fabric build. It is the one established LifeaCore artifact target. An isolated `mod/mc1_21_11` experiment was added to try compiling the same shared source against newer APIs, but the nested compile produced extensive Java API/mapping errors. Examples include changed skin texture and player rendering APIs, changed matrix stack types, keybinding categories, world/client access, and screen callback signatures. It must be treated as **failed and unsupported** until ported and validated.

This is why users asking for all versions need a deliberate compatibility plan: each API band requires version-specific source/adapters or a preprocessor branch, separate builds, CI, and runtime validation. A Gradle multi-project structure helps automate builds but does not erase code changes.

## Tuff Client relationship

`mod/tuff-client` is its own Gradle/Fabric client with a separate Java package (`net.tuffclient`), mod identity, feature code, textures and license. The supplied source is configured for Minecraft 26.3 and Java 25. It is selected independently for an exact 26.3 Fabric profile. It is not the LifeaCore 1.21.4 mod ported forward, and its output must not be renamed or treated as a LifeaCore artifact.

The launcher can bundle both artifact families while preserving their exact target identifiers. This is product packaging, not cross-version compatibility.

## Wardrobe and cosmetic synchronization

The launcher has a Wardrobe UI with `skinview3d` for a 3D skin preview. Account metadata can reference a skin URL or local PNG, a classic/slim body model, a cape URL/local file, and equipped local cosmetics (wings, hat, bandana). Bundled default cape/skin textures are packaged as Electron extra resources. Steve is the bundled default skin path for offline accounts when available.

There are two different cosmetic paths:

1. **Local/offline LifeaCore path:** the selected account's wardrobe state is serialized to an instance-specific `lifeacore/cosmetics.json`. The launcher passes its path and local skin/cape/cosmetic identifiers to the matching LifeaCore process using system properties. LifeaCore reads the shared file and checks for changes during client ticks so updates can take effect while the game is active. The file is stored inside the selected instance directory, outside Minecraft's ordinary `mods` folder.
2. **Backend path:** the optional service can store and relay cosmetics for authenticated accounts. Other players need the service and compatible Lifea client functionality to see shared cosmetics. A local file alone cannot make a cosmetic visible to remote players who do not have the same local data.

The sync design depends on launching the correct mod artifact and writing to the correct profile/account data. If no matching LifeaCore jar is available, the launcher intentionally skips injection. In that case the launcher wardrobe may still show local selection, but no in-game LifeaCore renderer is present to display it.

Known product boundary: a selected cosmetic ID is not automatically a complete 3D model. The current LifeaCore README calls out wings, hats/pet models and the emote wheel as not yet built. The backend can catalog/relay more cosmetic categories than the local mod currently renders. Do not represent every backend asset as an implemented in-game model.

## Lifea backend

The optional backend is a Fastify service. It provides account session exchange, friends, presence, direct messages, party invitations, cosmetics, news, featured servers and health checks. It uses PostgreSQL if `DATABASE_URL` is configured and otherwise SQLite under the server data directory. Realtime events use a WebSocket endpoint.

For Microsoft accounts, the backend validates the player's Minecraft access token with the Minecraft profile endpoint and returns a short-lived service JWT; it does not intend to persist Mojang access tokens. Offline authentication is rejected by default because offline usernames/UUIDs can be spoofed; `ALLOW_OFFLINE=1` is explicitly for development/testing.

The app can set a default backend URL at build time or the user can configure one in Settings. With no reachable backend, offline game play and local client features can still work, but social/network-backed features cannot. Hiding or disabling a backend-dependent control is preferable to showing a button that can only fail.

## UI and product design

The renderer implements a dark, red-accented product style with multiple theme identifiers, animated background/particle toggles, reduced-motion options, zoom, and window behavior settings. It is built as a desktop interface with Electron window chrome/title bar integration. Common controls are reusable components in `src/renderer/components/ui` and shared CSS tokens are under `src/renderer/styles`.

`docs/design` holds design comparison material. Design references (including Lunar-style blurred backgrounds and minimal mod menus) are inspiration for presentation only; they do not imply copied proprietary code or equal underlying functionality. The UI is expected to indicate which profile, account, loader and version are active to reduce accidental cross-version installs.

## Storage and data

There are two broad storage roots:

* **Application data/user data** stores launcher settings, accounts, logs, wardrobe files, backend/session information, and cached launcher-owned files. Platform locations documented by the README are `%APPDATA%\LifeaLauncher` on Windows, `~/Library/Application Support/LifeaLauncher` on macOS, and `~/.config/LifeaLauncher` on Linux.
* **Game directory** defaults to `~/.lifea` and is configurable. It contains profiles/instances, Minecraft libraries/assets/versions, Java runtimes, worlds and screenshots.

More implementation-specific paths include:

* `core-mods/<loader>/<loaderVersion>/<minecraftVersion>/<instanceId>` beneath launcher user data for injected exact-version Lifea/Tuff jars. They are deliberately stored outside the ordinary visible mods folder.
* `<instance>/lifeacore/cosmetics.json` for local launcher-to-LifeaCore cosmetic synchronization.
* `logs/main.log` for launcher diagnostics and per-game logs under the profile/game data according to launch logging configuration.
* `resources/lifea-core/` in the source checkout as a CI/package staging directory, not the player's runtime storage location.

The launcher uses schema-versioned types for settings and profiles. Migrations should be additive and defensive: validate files, preserve originals before repair, and explain recovery steps in user-facing errors. Never silently reset account or world data as a convenience.

## Build, CI, and releases

### Local development

Node/Electron launcher commands are described below. The project has separate Gradle builds for LifeaCore and Tuff Client. The release pipeline builds mod artifacts first, downloads/stages them into installer jobs, builds installers for Windows/macOS/Linux, and publishes release assets only when all required jobs succeed.

The Windows installer workflow runs on `windows-latest`; this is where NSIS `.exe` installers are produced. CI is the appropriate build environment when the developer asked not to download/install build dependencies on their PC. Installer files are workflow artifacts and/or release attachments; they are not intended to be committed into Git.

`electron-builder.yml` configures product identity, icons, NSIS settings, DMG and AppImage targets, packaging resources, update publishing and output path. The installer bundles only the jars staged under `resources/lifea-core`; therefore the mod-build job must succeed and the artifact names must remain version-specific.

### Workflows

* `.github/workflows/ci.yml`: code checks/build validation on its configured triggers.
* `.github/workflows/windows-installer.yml`: Windows NSIS installer artifact on main push or manual dispatch.
* `.github/workflows/release.yml`: builds client mods, installers for supported OS targets, and publishes a GitHub Release from a version tag or manual input.

Workflows have changed alongside the experimental 1.21.11 target. The checked-in workflow currently attempts both the root 1.21.4 LifeaCore build and the nested 1.21.11 build. The latter compilation failure blocks workflows that require both outputs. A failed workflow must not be treated as proof that a release exists or that the failed target is supported.

### Current release note

Package metadata is 1.1.2 and the repository has a `v1.1.2` release history. That version should be described as the release whose included artifacts actually passed its required build jobs. Later failed version-port attempts do not retroactively add that support to the published installer. Verify release asset timestamps, source tag/commit, and workflow conclusion before telling users a new binary includes a change.

## Current compatibility matrix

| Target | Launcher/profile availability | Lifea/Tuff client artifact | Status |
|---|---|---|---|
| Vanilla Minecraft versions present in Mojang manifest | Launcher resolves the official version metadata and attempts install/launch | None required for vanilla | Game launch target; per-version runtime conditions still apply |
| Fabric Minecraft 1.21.4 | Profile and loader path available | `lifea-core-…+mc1.21.4.jar` | Current verified LifeaCore target |
| Quilt Minecraft 1.21.4 | Loader/profile may be available according to installation path | No separate verified LifeaCore Quilt build is established | Do not assume a Fabric jar is valid Quilt artifact without tested loader support |
| Fabric Minecraft 1.21.11 | Profile creation/loader metadata may be possible | Nested LifeaCore build attempted, compilation failed | Unsupported for LifeaCore at present |
| Other versions from 1.8.9 onward | Some can be launched as vanilla; loader coverage varies | No LifeaCore jar for each version is established | Not a complete multi-version Lifea client |
| Fabric Minecraft 26.3 | Profile and loader support depend on installed loader metadata | Separate `tuff-client` artifact (Java 25) | Tuff Client target; not LifeaCore |
| Forge/NeoForge | Domain types/metadata pathways exist, with implementation depending on loader/version | No complete LifeaCore port matrix | Do not imply all loader/version pairs are verified |

**Practical answer to “can every version play with the client?”**: not yet. Each profile can only receive an artifact if one exists for its exact supported game/loader pair. As of this checkout, LifeaCore players should select Fabric 1.21.4. A 1.21.11 player can launch vanilla (and potentially a loader profile where supported), but must wait for a successful LifeaCore 1.21.11 port to use LifeaCore features on that version. A 26.3 player uses the separate Tuff build, not LifeaCore.

## Known limitations and failure states

1. **No universal LifeaCore jar.** Minecraft internals, mappings, renderer callbacks, mixin targets and Java requirements change across releases.
2. **1.21.11 build is not ready.** The experimental nested project compiles the same broad sources against changed APIs and reports many compile errors. Do not stage or release a jar from it until errors are fixed and the game is tested.
3. **No historical 1.8.9 port.** The codebase does not contain a legacy Forge 1.8.9 implementation. Supporting it entails a separate implementation path, likely separate mappings/build and rendering hooks.
4. **Tuff is separate.** Its 26.3 support is not evidence for 26.3 LifeaCore support.
5. **Cosmetics are not all realized 3D items.** Skin/cape and some local cosmetic plumbing exists; the documented mod TODOs include wing/hat/pet models and emotes. Server-side cosmetics need a configured backend and compatible clients.
6. **Social requires a backend.** Friends, presence, chat, party invites and shared cosmetics require a service; offline game mode does not provide those services by itself.
7. **Not all loader pairs are verified.** A loader enum or version list is not a test result. A profile is only supported when install and launch are exercised on that combination.
8. **No claims of measured superiority.** There are no benchmark results in this source proving a fixed FPS or 1% low improvement over Lunar Client.
9. **Offline accounts are not Microsoft authentication.** They cannot authenticate to online-mode servers.
10. **Installer signing is optional/configuration dependent.** Code signing credentials are supplied via CI secrets; unsigned Windows binaries may trigger SmartScreen warnings.

## How to add support for another Minecraft version

The user's aim is that players on versions such as 1.21.11, as well as older/newer versions, can select the Lifea client. The safe way to reach that aim is a staged compatibility program, not a broad version string range.

### 1. Define explicit targets

Maintain a matrix keyed by at least:

```text
Minecraft version × mod loader × loader version × Java major × client artifact
```

For example:

```text
1.21.4 × Fabric × tested loader range × 21 × lifea-core-...+mc1.21.4.jar
1.21.11 × Fabric × tested loader range × required Java × lifea-core-...+mc1.21.11.jar
```

Only publish rows whose artifact compiled, passed automated checks, launched in a real client, and exercised essential features. Keep future/unreleased Mojang labels out of the supported list until they are official and tested.

### 2. Separate stable Lifea logic from game adapters

Move version-independent behavior (configuration schema, module IDs, cosmetic data model, bridge protocol, feature preferences) into a shared Java module with no direct references to `net.minecraft` classes. Define narrow interfaces such as:

```java
public interface ClientPlatform {
    void registerTick(Runnable callback);
    void openLifeaMenu();
    void setFullbright(boolean enabled);
    void renderHud(HudFrame frame);
}
```

Each API line then supplies an adapter implementation using the correct Fabric API, mappings and Minecraft types. Render hooks, screen callbacks, key bindings, skin texture types and mixins belong in the version-specific side. Do not expose Minecraft classes in the shared module's public API.

This adapter pattern reduces duplicate business logic, but it does not eliminate the need to implement and compile each adapter. For large breaks (for example legacy 1.8.9 rendering vs modern entity feature renderers), make a separate implementation rather than forcing one abstraction to conceal incompatible APIs.

### 3. Group versions by real API compatibility

Use a Gradle multi-project setup or Stonecutter to build a list of explicit version targets. Group versions only after source/API compatibility has been checked. A plausible structure might be:

```text
mod/
  common/             version-independent config/protocol/features
  fabric-legacy/      explicitly mapped legacy targets (if implemented)
  fabric-modern/      version adapters and mixins by supported API group
  fabric-1_21_4/      known good baseline
  fabric-1_21_11/     port under active work; currently failing
  tuff-client/        independent project and version line
```

Do not declare `1.8.9–1.21.11` as one compatible source set without evidence. Pin mappings, loader and API versions per target; compile each target independently. Keep generated remapped jars and sources distinguishable with a filename containing the exact Minecraft version and loader.

### 4. Make launcher injection a manifest, not a guess

Replace filename substring discovery with a generated, validated artifact manifest, for example:

```json
{
  "artifacts": [
    { "game": "1.21.4", "loader": "fabric", "file": "lifea-core-1.0.0+mc1.21.4.jar" },
    { "game": "26.3", "loader": "fabric", "file": "tuff-client-...+mc26.3.jar", "product": "tuff" }
  ]
}
```

At launch, select only an exact match (or an explicitly tested compatibility range), verify the jar exists and optionally verify its SHA-256. If no match exists, log “no compatible Lifea client build for Minecraft X / loader Y” and launch without injection. Never quietly fall back to the closest jar.

The current launcher pre-launch hook already follows the important safety rule of skipping unmatched artifacts; retain that behavior as the matrix grows. Fabric/Quilt extra-mod loading and dependencies need validation for each loader and version.

### 5. Build/test/release in CI for every target

Use a matrix job that builds each declared target, uploads only produced artifacts, and blocks publication if any required target fails. Tests should cover:

* Gradle compile/remap and metadata validation for each target.
* A launcher unit test proving exact artifact selection and no mismatched fallback.
* A game smoke test where automation permits: open the target version, load the mod, open the menu, render HUD, join a local world, and inspect logs for mixin/accessor failures.
* Cosmetic sync tests for both offline and Microsoft account data.
* Installer packaging tests that assert only intended jars are embedded.

The latest 1.21.11 attempt is a useful failure signal: it shows that the source has real API drift. The next work is to fix the adapter/mixin/render and screen API differences, build successfully, and validate it at runtime; only then should the 1.21.11 artifact be added to installer/release manifests.

### 6. Grow support incrementally

Start with the supported 1.21.4 baseline. Add one new target at a time, preferably API-adjacent targets first. For every one, land the adapter and CI job, verify launch/runtime behavior, then publish it. Older releases like 1.8.9 may require a separate Forge code path and Java 8 build environment. New versions may require updated Fabric API, mappings, Gradle and Java. “Latest” should resolve from a maintained CI matrix, not be hard-coded to an assumed future version.

## Developer commands and troubleshooting

### Launcher

```powershell
npm ci
npm run dev
npm run check
npm run build
npm run pack
npm run dist:win
```

`npm run check` runs TypeScript checks, ESLint and Vitest. The app uses Vite/Electron output; `npm run pack` makes an unpacked package, while the `dist:*` scripts build platform installers. If the user's environment policy is “build through GitHub Actions only,” do not run the dependency install or packaging commands locally; push the code and use the appropriate workflow.

### LifeaCore and Tuff

From `mod`, the root wrapper builds the current 1.21.4 LifeaCore target:

```powershell
cd mod
.\gradlew.bat build --no-daemon
```

The attempted 1.21.11 build is separate:

```powershell
cd mod\mc1_21_11
.\gradlew.bat build --no-daemon
```

Tuff Client uses its own wrapper, target and Java configuration:

```powershell
cd mod\tuff-client
.\gradlew.bat build --no-daemon
```

These commands are provided for reference; use CI if local build resources/downloads are not authorized or desired.

### Diagnosing a player report

Ask the report to include:

* launcher version, OS and architecture;
* Minecraft version, loader and loader version;
* selected account type and whether an external backend is configured (never request access tokens/passwords);
* `logs/main.log` and the game log/crash report;
* profile name and whether it is a vanilla or modded profile;
* whether a LifeaCore/Tuff jar was actually selected for the exact game/loader pair.

Common interpretations:

* An unsupported accounts schema is a persistence/migration problem; preserve the file and logs before repair.
* “No backend configured” means a backend-dependent social call has no service configured; it is not proof that offline Minecraft launching should fail.
* A game crash mentioning `NoSuchMethodError`, mixin application or missing Minecraft classes often signals a version/loader mismatch or incomplete port.
* No Lifea menu on an unsupported target usually means there is no compatible artifact, which is preferable to injecting a wrong-version jar.
* Slow first launch can be caused by downloading libraries/assets and Java runtime. Subsequent launches should reuse cached files unless they are missing or corrupt.

## Security, licensing, and project boundaries

* Keep Node integration disabled in renderer contexts; extend the preload API narrowly and validate IPC payloads.
* Treat downloaded metadata, modpack archives, logs and user-controlled profile names as untrusted data. Constrain file paths to approved roots and avoid executing arbitrary modpack contents.
* Do not log OAuth access/refresh tokens, session JWTs or secrets.
* LifeaLauncher source is MIT-licensed according to the root README/package metadata. Tuff Client has its own GPL-3.0 license; preserve its notices and source obligations when redistributing it. Third-party mods and game assets each have separate licenses.
* LifeaLauncher is not affiliated with Mojang or Microsoft. Minecraft is a Mojang trademark.
* A local client cosmetic is not inherently visible to other players. Shared visibility requires an agreed backend/protocol and compatible renderer on receiving clients.

## Quick answers for players

**Can I launch Minecraft 1.21.11?** The launcher can resolve and launch vanilla if Mojang's files and the required runtime are available. Loader profiles depend on loader support.

**Will the LifeaCore client work in 1.21.11 right now?** No. Its attempted build currently fails. Use a 1.21.4 Fabric profile for the verified LifeaCore target, or play 1.21.11 without LifeaCore until its port passes build and runtime validation.

**Can every version from 1.8.9 onward use one LifeaCore jar?** No. Every supported version/loader needs a compatible artifact or an explicitly tested adapter/range. 1.8.9 is a substantially different legacy target.

**Does Tuff 26.3 mean LifeaCore supports 26.3?** No. Tuff is a separate client project and build.

**Why does the launcher skip an artifact?** Exact-version matching is intentional. If there is no compatible jar, skipping is safer than loading a jar built against another Minecraft API.

**How do I know when a new version is ready?** Its target build must pass CI and the release must include the artifact for that exact version/loader. A profile appearing in the launcher or a failed workflow does not establish client support.

