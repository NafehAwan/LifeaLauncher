# Lifea Core (Fabric, Minecraft 1.21.4)

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

CI copies the jar into `resources/lifea-core/` so the launcher bundles it and installs it into Lifea profiles.

## Status

- Compiled and smoke-tested only in CI (the development sandbox had no access to the Fabric Maven). Injections other
  than the option accessor are `require = 0`, so a mapping change disables one feature instead of crashing the game.
- Not yet built: wings/hats/pet models and the emote wheel (the backend already stores and relays them), block-outline
  and chat tweaks, and ports to 1.20.1 and Legacy Fabric 1.8.9.
