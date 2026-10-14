package gg.lifea.core.feature;

import gg.lifea.core.mixin.SimpleOptionAccessor;
import gg.lifea.core.module.Module;
import gg.lifea.core.screen.Theme;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.Perspective;
import net.minecraft.client.option.SimpleOption;
import net.minecraft.util.math.MathHelper;

/**
 * Gameplay and visual modules. Nothing here gives an unfair advantage: zoom/freelook/fullbright exist in OptiFine
 * and Lunar and are allowed on major servers; servers can still switch any module off via the lifea:modules payload.
 */
public final class Features {
    private Features() {}

    @SuppressWarnings("unchecked")
    static <T> void setRaw(SimpleOption<T> option, T value) {
        ((SimpleOptionAccessor) (Object) option).lifea$setValue(value);
    }

    /* ------------------------------------------------------------------ zoom */
    public static final class Zoom extends Module {
        private static final int[] LEVELS = { 4, 6, 10 };
        private int levelIdx = 1;
        private boolean held;
        private Integer savedFov;
        private Double savedSensitivity;
        private boolean savedSmooth;
        private float current = 1f;
        private float target = 1f;

        public Zoom() {
            super("zoom", "Zoom", "Hold C to zoom, scroll to adjust. Smooth and cinematic.", Category.GAMEPLAY, true);
        }

        public boolean zooming() {
            return active() && held;
        }

        public void setHeld(MinecraftClient c, boolean down) {
            if (down == held) return;
            held = down && active();
            if (held) {
                if (savedFov == null) {
                    // Only capture the player's real settings when not already mid-zoom.
                    savedFov = c.options.getFov().getValue();
                    savedSensitivity = c.options.getMouseSensitivity().getValue();
                    savedSmooth = c.options.smoothCameraEnabled;
                }
                c.options.smoothCameraEnabled = true;
                target = LEVELS[levelIdx];
            } else {
                target = 1f;
            }
        }

        /** Scroll while zooming changes the zoom factor; returns true when the scroll was consumed. */
        public boolean onScroll(double amount) {
            if (!zooming()) return false;
            target = MathHelper.clamp(target * (amount > 0 ? 1.25f : 0.8f), 1.5f, 50f);
            return true;
        }

        /** Per-frame easing so zooming is smooth regardless of FPS. */
        public void frame(MinecraftClient c, float frameMs) {
            if (savedFov == null) return;
            float k = 1f - (float) Math.exp(-frameMs / 60f);
            current += (target - current) * k;
            if (!held && Math.abs(current - 1f) < 0.02f) {
                setRaw(c.options.getFov(), savedFov);
                setRaw(c.options.getMouseSensitivity(), savedSensitivity);
                c.options.smoothCameraEnabled = savedSmooth;
                savedFov = null;
                current = 1f;
                return;
            }
            setRaw(c.options.getFov(), Math.max(1, Math.round(savedFov / current)));
            setRaw(c.options.getMouseSensitivity(), savedSensitivity / Math.max(1f, current * 0.6f));
        }

        public void restore(MinecraftClient c) {
            held = false;
            target = 1f;
            current = 1.01f;
            frame(c, 1000f);
        }

        @Override public String optionLabel() { return "Default zoom: " + LEVELS[levelIdx] + "x"; }
        @Override public void cycleOption() {
            levelIdx = (levelIdx + 1) % LEVELS.length;
            config().addProperty("level", levelIdx);
            gg.lifea.core.config.LifeaConfig.markDirty();
        }
        @Override public void load() {
            super.load();
            if (config().has("level")) levelIdx = Math.floorMod(config().get("level").getAsInt(), LEVELS.length);
        }
    }

    /* -------------------------------------------------------------- freelook */
    public static final class Freelook extends Module {
        private boolean held;
        private float yaw;
        private float pitch;
        private Perspective savedPerspective;

        public Freelook() {
            super("freelook", "Freelook", "Hold Left Alt to look around without turning. Servers can disable it.", Category.GAMEPLAY, true);
        }

        public boolean looking() {
            return held && active();
        }

        public void setHeld(MinecraftClient c, boolean down) {
            if (c.player == null) return;
            if (down && !held && active()) {
                held = true;
                yaw = c.player.getYaw();
                pitch = c.player.getPitch();
                savedPerspective = c.options.getPerspective();
                if (savedPerspective == Perspective.FIRST_PERSON) c.options.setPerspective(Perspective.THIRD_PERSON_BACK);
            } else if ((!down || !active()) && held) {
                held = false;
                if (savedPerspective != null) c.options.setPerspective(savedPerspective);
                savedPerspective = null;
            }
        }

        /** Mouse movement while freelooking turns the camera only (vanilla scale: 0.15° per unit). */
        public void look(double dx, double dy) {
            yaw += (float) dx * 0.15f;
            pitch = MathHelper.clamp(pitch + (float) dy * 0.15f, -90f, 90f);
        }

        public float yaw() { return yaw; }
        public float pitch() { return pitch; }

        @Override public void tick() {
            if (held && !active()) setHeld(MinecraftClient.getInstance(), false);
        }
    }

    /* --------------------------------------------------------- toggle sprint */
    public static final class ToggleSprint extends Module {
        private Boolean savedSprint;
        private Boolean savedSneak;

        public ToggleSprint() {
            super("togglesprint", "Toggle sprint", "Sprint and sneak toggle instead of hold, with an on-screen indicator.", Category.GAMEPLAY, true);
        }

        @Override protected void onEnable() {
            MinecraftClient c = MinecraftClient.getInstance();
            if (c.options == null) return;
            // Remember the player's own choice once, so disabling the module restores it even after restarts.
            if (!config().has("savedSprint")) {
                config().addProperty("savedSprint", c.options.getSprintToggled().getValue());
                config().addProperty("savedSneak", c.options.getSneakToggled().getValue());
                gg.lifea.core.config.LifeaConfig.markDirty();
            }
            savedSprint = config().get("savedSprint").getAsBoolean();
            savedSneak = config().get("savedSneak").getAsBoolean();
            c.options.getSprintToggled().setValue(true);
            c.options.getSneakToggled().setValue(true);
        }

        @Override protected void onDisable() {
            MinecraftClient c = MinecraftClient.getInstance();
            if (c.options == null) return;
            c.options.getSprintToggled().setValue(savedSprint != null ? savedSprint : false);
            c.options.getSneakToggled().setValue(savedSneak != null ? savedSneak : false);
            config().remove("savedSprint");
            config().remove("savedSneak");
            gg.lifea.core.config.LifeaConfig.markDirty();
        }

        public String status(MinecraftClient c) {
            if (c.player == null) return null;
            if (c.player.isSneaking()) return "[Sneaking (Toggled)]";
            if (c.player.isSprinting()) return "[Sprinting (Toggled)]";
            return null;
        }
    }

    /* ------------------------------------------------------------ fullbright */
    public static final class Fullbright extends Module {
        private Double saved;

        public Fullbright() {
            super("fullbright", "Fullbright", "See in the dark without night vision.", Category.VISUAL, false);
        }

        @Override protected void onEnable() {
            MinecraftClient c = MinecraftClient.getInstance();
            if (c.options == null) return;
            saved = c.options.getGamma().getValue();
            setRaw(c.options.getGamma(), 16.0);
        }

        @Override protected void onDisable() {
            MinecraftClient c = MinecraftClient.getInstance();
            if (c.options == null) return;
            setRaw(c.options.getGamma(), saved != null ? Math.min(1.0, saved) : 0.5);
        }

        @Override public void tick() {
            MinecraftClient c = MinecraftClient.getInstance();
            if (c.options.getGamma().getValue() < 16.0) setRaw(c.options.getGamma(), 16.0);
        }
    }

    /* ------------------------------------------------------------- crosshair */
    public static final class Crosshair extends Module {
        private static final String[] STYLES = { "Cross", "Dot", "Plus gap", "Circle" };
        private static final int[] COLORS = { 0xFFFFFFFF, Theme.ACCENT_HI, 0xFF3DDC84, 0xFF5AA9FF, 0xFFFFB020 };
        private int style;
        private int color;

        public Crosshair() {
            super("crosshair", "Custom crosshair", "Replace the vanilla crosshair. Right-click to change style.", Category.VISUAL, false);
        }

        @Override public void load() {
            super.load();
            style = config().has("style") ? Math.floorMod(config().get("style").getAsInt(), STYLES.length) : 0;
            color = config().has("color") ? Math.floorMod(config().get("color").getAsInt(), COLORS.length) : 0;
        }

        @Override public String optionLabel() { return "Style: " + STYLES[style]; }
        @Override public void cycleOption() {
            style = (style + 1) % STYLES.length;
            if (style == 0) color = (color + 1) % COLORS.length;
            config().addProperty("style", style);
            config().addProperty("color", color);
            gg.lifea.core.config.LifeaConfig.markDirty();
        }

        public void draw(DrawContext ctx, MinecraftClient c) {
            if (c.currentScreen != null || !c.options.getPerspective().isFirstPerson() || c.options.hudHidden) return;
            int cx = c.getWindow().getScaledWidth() / 2;
            int cy = c.getWindow().getScaledHeight() / 2;
            int col = COLORS[color];
            int out = 0xA0000000;
            switch (style) {
                case 1 -> { ctx.fill(cx - 2, cy - 2, cx + 2, cy + 2, out); ctx.fill(cx - 1, cy - 1, cx + 1, cy + 1, col); }
                case 2 -> {
                    ctx.fill(cx - 7, cy - 1, cx - 3, cy + 1, col); ctx.fill(cx + 3, cy - 1, cx + 7, cy + 1, col);
                    ctx.fill(cx - 1, cy - 7, cx + 1, cy - 3, col); ctx.fill(cx - 1, cy + 3, cx + 1, cy + 7, col);
                }
                case 3 -> {
                    for (int a = 0; a < 360; a += 15) {
                        int px = cx + (int) Math.round(Math.cos(Math.toRadians(a)) * 4);
                        int py = cy + (int) Math.round(Math.sin(Math.toRadians(a)) * 4);
                        ctx.fill(px, py, px + 1, py + 1, col);
                    }
                }
                default -> { ctx.fill(cx - 5, cy, cx + 6, cy + 1, col); ctx.fill(cx, cy - 5, cx + 1, cy + 6, col); }
            }
        }
    }
}
