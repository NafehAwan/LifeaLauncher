package gg.lifea.core.hud;

import gg.lifea.core.feature.Trackers;
import gg.lifea.core.feature.Waypoints;
import gg.lifea.core.screen.Theme;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.client.option.GameOptions;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/** All built-in HUD elements. Each is small, so they live together. */
public final class HudElements {
    private HudElements() {}

    public static List<HudModule> create() {
        List<HudModule> list = new ArrayList<>();
        list.add(new Fps());
        list.add(new Cps());
        list.add(new Keystrokes());
        list.add(new Ping());
        list.add(new Coords());
        list.add(new Armor());
        list.add(new Potions());
        list.add(new HeldItem());
        list.add(new Clock());
        list.add(new ServerAddress());
        list.add(new Memory());
        list.add(new Speed());
        list.add(new Combo());
        list.add(new Saturation());
        list.add(new DayCounter());
        list.add(new WaypointList());
        return list;
    }

    static final class Fps extends HudModule {
        Fps() { super("fps", "FPS", "Frames per second", true, 0.005f, 0.01f); }
        @Override protected List<String> lines(MinecraftClient c) { return List.of(c.getCurrentFps() + " FPS"); }
    }

    static final class Cps extends HudModule {
        Cps() { super("cps", "CPS", "Clicks per second (left | right)", true, 0.005f, 0.06f); }
        @Override protected List<String> lines(MinecraftClient c) { return List.of(Trackers.leftCps() + " | " + Trackers.rightCps() + " CPS"); }
    }

    static final class Ping extends HudModule {
        Ping() { super("ping", "Ping", "Latency to the server", true, 0.005f, 0.11f); }
        @Override protected List<String> lines(MinecraftClient c) {
            if (c.player == null || c.getNetworkHandler() == null || c.isInSingleplayer()) return null;
            PlayerListEntry e = c.getNetworkHandler().getPlayerListEntry(c.player.getUuid());
            return e == null ? null : List.of(e.getLatency() + " ms");
        }
    }

    static final class Coords extends HudModule {
        Coords() { super("coords", "Coordinates", "Position, facing and biome", true, 0.005f, 0.16f); }
        @Override protected List<String> lines(MinecraftClient c) {
            ClientPlayerEntity p = c.player;
            if (p == null || c.world == null) return null;
            BlockPos pos = p.getBlockPos();
            String biome = c.world.getBiome(pos).getKey().map(k -> k.getValue().getPath().replace('_', ' ')).orElse("?");
            return List.of(
                "XYZ " + pos.getX() + " " + pos.getY() + " " + pos.getZ(),
                "Facing " + p.getHorizontalFacing().asString(),
                "Biome " + biome);
        }
    }

    static final class Armor extends HudModule {
        private static final EquipmentSlot[] SLOTS = { EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET };
        Armor() { super("armor", "Armor status", "Armor pieces and durability", true, 0.89f, 0.70f); }
        @Override protected void draw(DrawContext ctx, MinecraftClient c, boolean preview) {
            if (c.player == null) { width = height = 0; return; }
            TextRenderer tr = c.textRenderer;
            int y = 0;
            int w = 0;
            for (EquipmentSlot slot : SLOTS) {
                ItemStack s = c.player.getEquippedStack(slot);
                if (s.isEmpty()) continue;
                ctx.drawItem(s, 0, y);
                String d = s.isDamageable() ? String.valueOf(s.getMaxDamage() - s.getDamage()) : "";
                int color = s.isDamageable() && s.getDamage() > s.getMaxDamage() * 0.8 ? Theme.ACCENT_HI : Theme.TEXT1;
                ctx.drawText(tr, d, 19, y + 4, color, true);
                w = Math.max(w, 19 + tr.getWidth(d));
                y += 17;
            }
            if (y == 0 && preview) { ctx.drawText(tr, "Armor", 0, 0, Theme.TEXT2, true); w = 30; y = 10; }
            width = w;
            height = y;
        }
    }

    static final class Potions extends HudModule {
        Potions() { super("potions", "Potion effects", "Active effects and time left", true, 0.005f, 0.45f); }
        @Override protected List<String> lines(MinecraftClient c) {
            if (c.player == null) return null;
            List<String> out = new ArrayList<>();
            for (StatusEffectInstance e : c.player.getStatusEffects()) {
                String name = e.getEffectType().value().getName().getString();
                String lvl = e.getAmplifier() > 0 ? " " + (e.getAmplifier() + 1) : "";
                String time = e.isInfinite() ? "∞" : String.format("%d:%02d", e.getDuration() / 1200, (e.getDuration() / 20) % 60);
                out.add(name + lvl + "  " + time);
            }
            return out;
        }
    }

    static final class HeldItem extends HudModule {
        HeldItem() { super("helditem", "Held item", "Name and durability of the item in hand", false, 0.42f, 0.80f); }
        @Override protected List<String> lines(MinecraftClient c) {
            if (c.player == null) return null;
            ItemStack s = c.player.getMainHandStack();
            if (s.isEmpty()) return null;
            String d = s.isDamageable() ? "  " + (s.getMaxDamage() - s.getDamage()) + "/" + s.getMaxDamage() : (s.getCount() > 1 ? "  x" + s.getCount() : "");
            return List.of(s.getName().getString() + d);
        }
    }

    static final class Clock extends HudModule {
        private static final DateTimeFormatter F = DateTimeFormatter.ofPattern("HH:mm");
        Clock() { super("clock", "Clock", "Real-world time", false, 0.93f, 0.01f); }
        @Override protected List<String> lines(MinecraftClient c) { return List.of(LocalTime.now().format(F)); }
    }

    static final class ServerAddress extends HudModule {
        ServerAddress() { super("server", "Server address", "The server you are playing on", false, 0.4f, 0.01f); }
        @Override protected List<String> lines(MinecraftClient c) {
            ServerInfo s = c.getCurrentServerEntry();
            return s == null ? null : List.of(s.address);
        }
    }

    static final class Memory extends HudModule {
        Memory() { super("memory", "Memory", "Java heap in use", false, 0.86f, 0.06f); }
        @Override protected List<String> lines(MinecraftClient c) {
            Runtime r = Runtime.getRuntime();
            long used = (r.totalMemory() - r.freeMemory()) >> 20;
            long max = r.maxMemory() >> 20;
            return List.of("Mem " + (used * 100 / Math.max(1, max)) + "% " + used + "/" + max + " MB");
        }
    }

    static final class Speed extends HudModule {
        Speed() { super("speed", "Speed", "Horizontal speed in blocks/s", false, 0.005f, 0.30f); }
        @Override protected List<String> lines(MinecraftClient c) {
            if (c.player == null) return null;
            Vec3d v = c.player.getVelocity();
            double bps = Math.sqrt(v.x * v.x + v.z * v.z) * 20.0;
            return List.of(String.format("%.2f b/s", bps));
        }
    }

    static final class Combo extends HudModule {
        Combo() { super("combo", "Combo", "Hits in a row without taking damage", false, 0.47f, 0.60f); }
        @Override protected List<String> lines(MinecraftClient c) {
            int n = Trackers.combo();
            return n < 2 ? null : List.of(n + " combo");
        }
    }

    static final class Saturation extends HudModule {
        Saturation() { super("saturation", "Saturation", "Hidden saturation level", false, 0.005f, 0.35f); }
        @Override protected List<String> lines(MinecraftClient c) {
            if (c.player == null) return null;
            return List.of(String.format("Sat %.1f", c.player.getHungerManager().getSaturationLevel()));
        }
    }

    static final class DayCounter extends HudModule {
        DayCounter() { super("day", "Day counter", "In-game day", false, 0.005f, 0.40f); }
        @Override protected List<String> lines(MinecraftClient c) {
            return c.world == null ? null : List.of("Day " + (c.world.getTimeOfDay() / 24000L + 1));
        }
    }

    static final class WaypointList extends HudModule {
        WaypointList() { super("waypoints", "Waypoints", "Nearest waypoints with distance and direction", true, 0.80f, 0.30f); }
        @Override protected List<String> lines(MinecraftClient c) { return Waypoints.hudLines(c, 3); }
    }

    /** WASD + mouse + space, lit while pressed. */
    static final class Keystrokes extends HudModule {
        Keystrokes() { super("keystrokes", "Keystrokes", "WASD, mouse buttons and space", true, 0.005f, 0.62f); }

        private void key(DrawContext ctx, TextRenderer tr, int x, int y, int w, int h, String label, KeyBinding k) {
            boolean down = k.isPressed();
            ctx.fill(x, y, x + w, y + h, down ? Theme.alpha(Theme.ACCENT, 0xD0) : Theme.HUD_BG);
            ctx.drawText(tr, label, x + (w - tr.getWidth(label)) / 2, y + (h - 8) / 2, down ? 0xFFFFFFFF : Theme.TEXT1, true);
        }

        @Override protected void draw(DrawContext ctx, MinecraftClient c, boolean preview) {
            GameOptions o = c.options;
            TextRenderer tr = c.textRenderer;
            int s = 20;
            int g = 2;
            key(ctx, tr, s + g, 0, s, s, "W", o.forwardKey);
            key(ctx, tr, 0, s + g, s, s, "A", o.leftKey);
            key(ctx, tr, s + g, s + g, s, s, "S", o.backKey);
            key(ctx, tr, 2 * (s + g), s + g, s, s, "D", o.rightKey);
            int mw = (3 * s + 2 * g - g) / 2;
            key(ctx, tr, 0, 2 * (s + g), mw, s, Trackers.leftCps() + " L", o.attackKey);
            key(ctx, tr, mw + g, 2 * (s + g), mw, s, Trackers.rightCps() + " R", o.useKey);
            key(ctx, tr, 0, 3 * (s + g), 3 * s + 2 * g, 12, "———", o.jumpKey);
            width = 3 * s + 2 * g;
            height = 3 * (s + g) + 12;
        }
    }
}
