package gg.lifea.core.test;

import gg.lifea.core.LifeaCore;
import gg.lifea.core.feature.Trackers;
import gg.lifea.core.hud.HudModule;
import gg.lifea.core.module.Module;
import gg.lifea.core.module.Modules;
import gg.lifea.core.screen.HudEditorScreen;
import gg.lifea.core.screen.LifeaMenuScreen;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.option.Perspective;
import net.minecraft.entity.player.SkinTextures;
import org.lwjgl.glfw.GLFW;

import java.util.Arrays;

/**
 * Boots real Minecraft 1.21.11 with LifeaCore and drives every in-game feature through real input (keys, clicks,
 * typing, mouse movement), failing on anything that doesn't happen. Screenshots land in run/screenshots.
 */
public class LifeaCoreGameTest implements FabricClientGameTest {
    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }

    @Override
    public void runTest(ClientGameTestContext ctx) {
        ctx.getInput().resizeWindow(1280, 720);
        ctx.waitForScreen(TitleScreen.class);
        // CI/sandbox machines render in software; keep the world tiny so the integrated server keeps up.
        ctx.runOnClient(c -> {
            c.options.getViewDistance().setValue(2);
            c.options.getSimulationDistance().setValue(5);
        });

        boolean keysRegistered = ctx.computeOnClient(c -> Arrays.stream(c.options.allKeys).map(KeyBinding::getId).toList()
            .containsAll(java.util.List.of("key.lifea.menu", "key.lifea.zoom", "key.lifea.freelook", "key.lifea.waypoint")));
        check(keysRegistered, "Lifea key bindings are not registered");

        // Screens that don't need a world: title, Lifea menu and HUD editor over the title screen.
        ctx.waitTicks(20);
        ctx.takeScreenshot("lifea-00-title");
        ctx.setScreen(LifeaMenuScreen::new);
        ctx.waitTicks(10);
        ctx.takeScreenshot("lifea-00-menu-title");
        ctx.setScreen(() -> new HudEditorScreen(new TitleScreen()));
        ctx.waitTicks(10);
        ctx.takeScreenshot("lifea-00-hud-editor-title");
        ctx.setScreen(TitleScreen::new);
        ctx.waitTicks(5);

        try (TestSingleplayerContext world = ctx.worldBuilder().create()) {
            world.getServer().runCommand("time set noon");
            world.getServer().runCommand("weather clear");
            world.getClientWorld().waitForChunksRender();

            // HUD: the Lifea HUD hook draws every frame and the default elements are on.
            long frames = ctx.computeOnClient(c -> LifeaCore.hudFrames);
            ctx.waitTicks(20);
            check(ctx.computeOnClient(c -> LifeaCore.hudFrames) > frames, "Lifea HUD is not being drawn");
            long activeHud = ctx.computeOnClient(c -> Modules.all().stream().filter(m -> m instanceof HudModule && m.active()).count());
            check(activeHud >= 5, "Expected the default HUD elements to be on, found " + activeHud);
            ctx.takeScreenshot("lifea-01-hud");

            // CPS / keystrokes: a real left click reaches the mouse mixin.
            ctx.getInput().pressMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
            ctx.waitTick();
            check(ctx.computeOnClient(c -> Trackers.leftCps()) >= 1, "Mouse click was not counted (MouseMixin)");

            // Toggle sprint is on by default and switches the vanilla option.
            check(ctx.computeOnClient(c -> c.options.getSprintToggled().getValue()), "Toggle sprint did not enable sprint toggling");

            // Zoom: hold C, the FOV narrows; release, it comes back.
            int fov = ctx.computeOnClient(c -> c.options.getFov().getValue());
            ctx.getInput().holdKey(GLFW.GLFW_KEY_C);
            ctx.waitTicks(20);
            int zoomed = ctx.computeOnClient(c -> c.options.getFov().getValue());
            check(zoomed < fov, "Zoom did not narrow the FOV (" + fov + " -> " + zoomed + ")");
            ctx.takeScreenshot("lifea-02-zoom");
            ctx.getInput().releaseKey(GLFW.GLFW_KEY_C);
            ctx.waitTicks(40);
            check(ctx.computeOnClient(c -> c.options.getFov().getValue()) == fov, "Zoom did not restore the FOV");

            // Freelook: hold Left Alt and move the mouse, the camera turns but the player does not.
            float playerYaw = ctx.computeOnClient(c -> c.player.getYaw());
            ctx.getInput().holdKey(GLFW.GLFW_KEY_LEFT_ALT);
            ctx.waitTicks(2);
            check(ctx.computeOnClient(c -> LifeaCore.FREELOOK.looking()), "Freelook did not start");
            ctx.getInput().moveCursor(400, 0);
            ctx.waitTicks(3);
            float cameraYaw = ctx.computeOnClient(c -> c.gameRenderer.getCamera().getYaw());
            float playerAfter = ctx.computeOnClient(c -> c.player.getYaw());
            check(Math.abs(playerAfter - playerYaw) < 0.01f, "Freelook turned the player (EntityMixin)");
            check(Math.abs(cameraYaw - playerYaw) > 5f, "Freelook did not turn the camera (CameraMixin): " + playerYaw + " vs " + cameraYaw);
            ctx.takeScreenshot("lifea-03-freelook");
            ctx.getInput().releaseKey(GLFW.GLFW_KEY_LEFT_ALT);
            ctx.waitTicks(2);
            check(ctx.computeOnClient(c -> c.options.getPerspective() == Perspective.FIRST_PERSON), "Freelook did not restore first person");

            // Fullbright at midnight: gamma goes to 16 and comes back when turned off.
            world.getServer().runCommand("time set midnight");
            ctx.waitTicks(5);
            ctx.takeScreenshot("lifea-04-night");
            double gamma = ctx.computeOnClient(c -> c.options.getGamma().getValue());
            ctx.runOnClient(c -> LifeaCore.FULLBRIGHT.setEnabled(true));
            ctx.waitTicks(5);
            check(ctx.computeOnClient(c -> c.options.getGamma().getValue()) >= 16.0, "Fullbright did not raise gamma");
            ctx.takeScreenshot("lifea-05-fullbright");
            ctx.runOnClient(c -> LifeaCore.FULLBRIGHT.setEnabled(false));
            check(ctx.computeOnClient(c -> c.options.getGamma().getValue()) <= Math.max(1.0, gamma), "Fullbright did not restore gamma");
            world.getServer().runCommand("time set noon");

            // Custom crosshair replaces the vanilla one.
            ctx.runOnClient(c -> LifeaCore.CROSSHAIR.setEnabled(true));
            ctx.waitTicks(3);
            ctx.takeScreenshot("lifea-06-crosshair");

            // Cape: the launcher's -Dlifea.cape.path texture is applied through the skin mixin, and shows in F5.
            String capeNamespace = ctx.computeOnClient(c -> {
                SkinTextures skin = c.player.getSkin();
                return skin.cape() == null ? "none" : skin.cape().texturePath().getNamespace();
            });
            check("lifea".equals(capeNamespace), "Lifea cape was not applied (AbstractClientPlayerEntityMixin), cape namespace: " + capeNamespace);
            ctx.runOnClient(c -> c.options.setPerspective(Perspective.THIRD_PERSON_FRONT));
            ctx.waitTicks(5);
            ctx.runOnClient(c -> c.options.setPerspective(Perspective.THIRD_PERSON_BACK));
            ctx.waitTicks(5);
            ctx.takeScreenshot("lifea-07-cape");
            ctx.runOnClient(c -> c.options.setPerspective(Perspective.FIRST_PERSON));

            // Right Shift opens the Lifea menu.
            ctx.getInput().pressKey(GLFW.GLFW_KEY_RIGHT_SHIFT);
            ctx.waitForScreen(LifeaMenuScreen.class);
            ctx.waitTicks(5);
            ctx.takeScreenshot("lifea-08-menu");

            // Typing searches (CharInput), Backspace edits (KeyInput).
            ctx.getInput().typeChars("zoom");
            ctx.waitTick();
            check("zoom".equals(ctx.computeOnClient(c -> ((LifeaMenuScreen) c.currentScreen).query())), "Typing did not reach the menu search");
            ctx.takeScreenshot("lifea-09-search");
            ctx.getInput().pressKey(GLFW.GLFW_KEY_BACKSPACE);
            ctx.waitTick();
            check("zoo".equals(ctx.computeOnClient(c -> ((LifeaMenuScreen) c.currentScreen).query())), "Backspace did not edit the search");
            for (int i = 0; i < 3; i++) ctx.getInput().pressKey(GLFW.GLFW_KEY_BACKSPACE);

            // Clicking "Edit HUD" (Click) opens the HUD editor.
            double scale = ctx.computeOnClient(c -> c.getWindow().getScaleFactor());
            int[] button = ctx.computeOnClient(c -> ((LifeaMenuScreen) c.currentScreen).editHudButtonCenter());
            ctx.getInput().setCursorPos(button[0] * scale, button[1] * scale);
            ctx.waitTick();
            ctx.getInput().pressMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
            ctx.waitForScreen(HudEditorScreen.class);
            ctx.waitTicks(5);
            ctx.takeScreenshot("lifea-10-hud-editor");

            // Drag the FPS element (Click + drag + release) and check it moved.
            Module fps = ctx.computeOnClient(c -> Modules.all().stream().filter(m -> m.id.equals("fps")).findFirst().orElseThrow());
            HudModule fpsHud = (HudModule) fps;
            int[] start = ctx.computeOnClient(c -> new int[] { fpsHud.screenX(c) + 4, fpsHud.screenY(c) + 4 });
            ctx.getInput().setCursorPos(start[0] * scale, start[1] * scale);
            ctx.waitTick();
            ctx.getInput().holdMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
            ctx.waitTick();
            ctx.getInput().moveCursor(120 * scale, 60 * scale);
            ctx.waitTick();
            ctx.getInput().releaseMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
            ctx.waitTick();
            int[] end = ctx.computeOnClient(c -> new int[] { fpsHud.screenX(c), fpsHud.screenY(c) });
            check(end[0] > start[0] + 40 && end[1] > start[1] + 20, "Dragging did not move the FPS element: " + Arrays.toString(start) + " -> " + Arrays.toString(end));
            ctx.takeScreenshot("lifea-11-hud-moved");
            ctx.runOnClient(c -> fpsHud.resetLayout());

            // Esc returns to the menu, Esc again closes it.
            ctx.getInput().pressKey(GLFW.GLFW_KEY_ESCAPE);
            ctx.waitForScreen(LifeaMenuScreen.class);
            ctx.getInput().pressKey(GLFW.GLFW_KEY_ESCAPE);
            ctx.waitForScreen(null);
        }
    }
}
