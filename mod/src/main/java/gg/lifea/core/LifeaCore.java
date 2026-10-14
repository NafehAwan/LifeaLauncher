package gg.lifea.core;

import gg.lifea.core.config.LifeaConfig;
import gg.lifea.core.feature.Features;
import gg.lifea.core.feature.Trackers;
import gg.lifea.core.feature.Waypoints;
import gg.lifea.core.hud.HudElements;
import gg.lifea.core.hud.HudModule;
import gg.lifea.core.module.Module;
import gg.lifea.core.module.Modules;
import gg.lifea.core.net.Bridge;
import gg.lifea.core.net.Cosmetics;
import gg.lifea.core.net.ServerRules;
import gg.lifea.core.screen.LifeaMenuScreen;
import gg.lifea.core.screen.Theme;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.ActionResult;
import org.lwjgl.glfw.GLFW;

/** Entry point: registers modules, keybinds and events. Everything degrades gracefully without the launcher. */
public final class LifeaCore implements ClientModInitializer {
    public static final Features.Zoom ZOOM = new Features.Zoom();
    public static final Features.Freelook FREELOOK = new Features.Freelook();
    public static final Features.ToggleSprint TOGGLE_SPRINT = new Features.ToggleSprint();
    public static final Features.Fullbright FULLBRIGHT = new Features.Fullbright();
    public static final Features.Crosshair CROSSHAIR = new Features.Crosshair();

    private static KeyBinding menuKey;
    private static KeyBinding zoomKey;
    private static KeyBinding freelookKey;
    private static KeyBinding waypointKey;
    private static long lastFrameNanos;
    private static int saveTicks;

    @Override
    public void onInitializeClient() {
        LifeaConfig.load();
        for (HudModule h : HudElements.create()) Modules.register(h);
        Modules.register(ZOOM);
        Modules.register(FREELOOK);
        Modules.register(TOGGLE_SPRINT);
        Modules.register(FULLBRIGHT);
        Modules.register(CROSSHAIR);

        menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.lifea.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.lifea"));
        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.lifea.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, "category.lifea"));
        freelookKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.lifea.freelook", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_LEFT_ALT, "category.lifea"));
        waypointKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.lifea.waypoint", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_B, "category.lifea"));

        ServerRules.register();

        ClientLifecycleEvents.CLIENT_STARTED.register(client -> Modules.loadAll());
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> {
            ZOOM.restore(client);
            if (FULLBRIGHT.isEnabled()) FULLBRIGHT.setEnabled(false);
            LifeaConfig.save();
        });

        ClientTickEvents.END_CLIENT_TICK.register(this::tick);

        HudRenderCallback.EVENT.register((ctx, tickCounter) -> {
            MinecraftClient c = MinecraftClient.getInstance();
            long now = System.nanoTime();
            float frameMs = lastFrameNanos == 0 ? 16f : (now - lastFrameNanos) / 1_000_000f;
            lastFrameNanos = now;
            Trackers.frame();
            ZOOM.frame(c, frameMs);
            if (c.options.hudHidden || c.currentScreen instanceof gg.lifea.core.screen.HudEditorScreen) return;
            for (Module m : Modules.all()) if (m instanceof HudModule h && h.active()) h.render(ctx, c, false);
            if (CROSSHAIR.active()) CROSSHAIR.draw(ctx, c);
            if (TOGGLE_SPRINT.active()) {
                String s = TOGGLE_SPRINT.status(c);
                if (s != null) ctx.drawText(c.textRenderer, s, 4, c.getWindow().getScaledHeight() - 12, Theme.TEXT1, true);
            }
        });

        AttackEntityCallback.EVENT.register((player, world, hand, entity, hit) -> {
            if (world.isClient) Trackers.hitEntity();
            return ActionResult.PASS;
        });

        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
            ServerInfo s = client.getCurrentServerEntry();
            Bridge.presence(s != null ? s.address : null);
        });
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> {
            Modules.clearServerRules();
            Cosmetics.clear();
            Bridge.presence(null);
        });
    }

    private void tick(MinecraftClient c) {
        while (menuKey.wasPressed()) {
            if (c.currentScreen == null) c.setScreen(new LifeaMenuScreen());
        }
        while (waypointKey.wasPressed()) {
            if (c.player != null) Waypoints.addHere(c);
        }
        ZOOM.setHeld(c, zoomKey.isPressed() && c.currentScreen == null);
        FREELOOK.setHeld(c, freelookKey.isPressed() && c.currentScreen == null);
        if (c.player != null) {
            Trackers.tickCombo(c.player.hurtTime);
            Waypoints.tick(c);
        }
        Modules.tickAll();
        Bridge.tick();
        Cosmetics.tick(c);
        if (++saveTicks % 100 == 0) LifeaConfig.flushIfDirty();
    }
}
