# LifeaCore (Fabric, Minecraft 1.21.4)

The in-game half of LifeaLauncher. Press **Right Shift** in game for the Lifea menu.

| Module | What it does | Default |
|---|---|---|
| HUD: FPS, CPS, Keystrokes, Ping, Coordinates (+ facing, biome), Armor, Potions, Waypoints | Draggable, scalable HUD elements (Edit HUD in the menu) | on |
| HUD: Held item, Clock, Server, Memory, Speed, Combo, Saturation, Day counter | Same, opt-in | off |
| Zoom | Hold **C**, scroll to change level, smooth and cinematic | on |
| Freelook | Hold **Left Alt** to look around without turning | on |
| Toggle sprint / sneak | Uses vanilla's toggle options + on-screen indicator | on |
| Fullbright | Max brightness without night vision | off |
| Custom crosshair | 4 styles × 5 colours (right-click in the menu) | off |
| Waypoints | **B** adds one; your death point is saved automatically | — |
| Lifea capes | Capes equipped in the launcher's Wardrobe, visible to other Lifea players | — |

The LifeaMC partner entry is protected from delete/edit in Minecraft's server list on the bundled 1.21.4 LifeaCore and 26.3 Tuff Client builds. On other versions, the launcher restores the starred entry before the next launch; vanilla has no server-list lock mechanism.

Fair play: nothing here gives an advantage that major servers forbid. Servers can disable any module by sending a
`lifea:modules` custom payload containing module ids (e.g. `["freelook","fullbright"]`).

## Launcher bridge

When started by LifeaLauncher, the game receives `-Dlifea.bridge.port`, `-Dlifea.bridge.token` and
`-Dlifea.instance`. The mod connects to `ws://127.0.0.1:<port>` and reports FPS averages / 1 % lows (Boost page) and the
server you joined (friends presence). It receives the Lifea backend URL for cosmetics. Without the launcher the mod works
fully offline.

## Build

```bash
./gradlew build          # → build/libs/lifea-core-1.0.0+mc1.21.4.jar
```

CI packages exact-version jars under `resources/lifea-core/`. The launcher copies only matching jars into its app-data `core-mods/<minecraft-version>` directory and asks Fabric/Quilt to load them through the loader's additional-mod property. They are not copied into the instance's `mods` folder.

## Status

- LifeaCore source currently builds only for Minecraft 1.21.4. The supplied `Neptune-claude-serene-euler-8ygwvm.zip` contains Tuff Client source for Fabric Minecraft 26.3 (Java 25); CI builds it from `mod/tuff-client` and keeps its original identity and GPL-3.0 license. It is only selected for exact 26.3 Fabric profiles. No 1.8.9 build or other version ports are present, so unmatched versions are skipped instead of receiving an incompatible jar.
- Compiled and smoke-tested only in CI (the development sandbox had no access to the Fabric Maven). Injections other
  than the option accessor are `require = 0`, so a mapping change disables one feature instead of crashing the game.
- Not yet built: wings/hats/pet models and the emote wheel (the backend already stores and relays them), block-outline
  and chat tweaks, and ports to other Minecraft versions.
