package net.tuffclient.test;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;

import javax.imageio.ImageIO;

import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.world.effect.MobEffects;
import net.tuffclient.TuffClient;
import net.tuffclient.gui.HudEditorScreen;
import net.tuffclient.gui.TuffMenuScreen;
import net.tuffclient.gui.TuffTitleScreen;
import net.tuffclient.gui.Ui;
import net.tuffclient.module.Module;

public class TuffClientGameTest implements FabricClientGameTest {
	/** Counts gold-coloured pixels in the middle of a screenshot (away from the hand and HUD). */
	private static long goldPixels(Path screenshot) {
		try {
			BufferedImage image = ImageIO.read(screenshot.toFile());
			long count = 0;
			int w = image.getWidth(), h = image.getHeight();
			for (int y = h * 3 / 10; y < h * 7 / 10; y++) {
				for (int x = w * 3 / 10; x < w * 7 / 10; x++) {
					int rgb = image.getRGB(x, y);
					int r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
					if (r > 100 && r >= g && g > b && r - b > 50) count++;
				}
			}
			return count;
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	@Override
	public void runTest(ClientGameTestContext context) {
		// A common 1080p window, so screenshots match what players see.
		context.getInput().resizeWindow(1920, 1080);
		// The title screen mixin must have replaced the vanilla menu.
		context.waitForScreen(TuffTitleScreen.class);
		context.waitTicks(40);
		context.takeScreenshot("tuff-title");

		// The Inter font must actually be loaded (its widths differ from the game font).
		boolean customFont = context.computeOnClient(client ->
				Ui.width("Tuff Client menu", Ui.Font.BODY) != client.font.width("Tuff Client menu"));
		if (!customFont) throw new AssertionError("Tuff UI font did not load");

		Screen title = context.computeOnClient(client -> client.gui.screen());
		TuffMenuScreen menu = context.computeOnClient(client -> new TuffMenuScreen(title));
		context.setScreen(() -> menu);
		context.waitTicks(15);
		context.takeScreenshot("tuff-menu-mods");

		// Clicking a card's ENABLED/DISABLED bar toggles the module.
		Module scoreboard = context.computeOnClient(client -> TuffClient.modules().hideScoreboard);
		boolean before = context.computeOnClient(client -> scoreboard.isEnabled());
		double[] bar = context.computeOnClient(client -> menu.statusBarPosition(scoreboard.id));
		if (bar == null) throw new AssertionError("Hide Scoreboard card was not drawn");
		context.getInput().setCursorPos(bar[0], bar[1]);
		context.waitTicks(1);
		context.getInput().pressMouse(0);
		context.waitTicks(2);
		if (context.computeOnClient(client -> scoreboard.isEnabled()) == before) throw new AssertionError("Clicking the status bar did not toggle the module");
		context.waitTicks(12);
		context.takeScreenshot("tuff-menu-toggled");
		context.runOnClient(client -> scoreboard.setEnabled(before));
		context.runOnClient(client -> menu.openSettings(TuffClient.modules().crosshair));
		context.waitTicks(15);
		context.takeScreenshot("tuff-menu-drawer");
		for (TuffMenuScreen.Page page : new TuffMenuScreen.Page[] {TuffMenuScreen.Page.THEME, TuffMenuScreen.Page.PACKS, TuffMenuScreen.Page.SETTINGS}) {
			context.runOnClient(client -> menu.setPage(page));
			context.waitTicks(12);
			context.takeScreenshot("tuff-menu-" + page.name().toLowerCase());
		}
		context.runOnClient(client -> menu.onClose());
		context.waitForScreen(TuffTitleScreen.class);

		try (TestSingleplayerContext world = context.worldBuilder().create()) {
			world.getConnection().waitForChunksRender();
			context.runOnClient(client -> {
				for (Module m : TuffClient.modules().all()) {
					if (m.id.equals("keystrokes") || m.id.equals("effects") || m.id.equals("clock") || m.id.equals("crosshair")) m.setEnabled(true);
				}
			});
			context.waitTicks(20);
			context.takeScreenshot("tuff-hud");

			context.setScreen(() -> new HudEditorScreen(null));
			context.waitTicks(10);
			context.takeScreenshot("tuff-hud-editor");

			context.setScreen(() -> new TuffMenuScreen(null));
			context.waitTicks(15);
			context.takeScreenshot("tuff-menu-ingame");
			context.setScreen(() -> null);

			// Zoom: a gold block 12 blocks ahead must cover far more pixels while zoomed,
			// proving the narrower FOV reaches the world projection.
			world.getServer().runCommand("/tp @a 0.5 -60 0.5 0 0");
			world.getServer().runCommand("/setblock 0 -59 12 minecraft:gold_block");
			context.waitTicks(20);
			world.getConnection().waitForChunksRender();
			long normalGold = goldPixels(context.takeScreenshot("tuff-zoom-before"));
			float normalFov = context.computeOnClient(client -> client.gameRenderer.mainCamera().getFov());
			context.getInput().holdKey(TuffClient.zoomKey());
			context.waitTicks(30);
			float zoomedFov = context.computeOnClient(client -> client.gameRenderer.mainCamera().getFov());
			long zoomedGold = goldPixels(context.takeScreenshot("tuff-zoom"));
			context.getInput().releaseKey(TuffClient.zoomKey());
			if (!(zoomedFov < normalFov * 0.5f)) {
				throw new AssertionError("Zoom did not narrow the FOV: " + normalFov + " -> " + zoomedFov);
			}
			if (normalGold == 0 || zoomedGold < normalGold * 4) {
				throw new AssertionError("Zoom did not magnify the world: gold pixels " + normalGold + " -> " + zoomedGold);
			}

			// Fullbright applies a hidden night vision effect and removes it again.
			context.runOnClient(client -> TuffClient.modules().fullbright.setEnabled(true));
			context.waitTicks(5);
			boolean lit = context.computeOnClient(client -> client.player.hasEffect(MobEffects.NIGHT_VISION));
			context.runOnClient(client -> TuffClient.modules().fullbright.setEnabled(false));
			context.waitTicks(2);
			boolean cleared = context.computeOnClient(client -> !client.player.hasEffect(MobEffects.NIGHT_VISION));
			if (!lit || !cleared) throw new AssertionError("Fullbright effect state was wrong: on=" + lit + " cleared=" + cleared);
		}

		// Leaving the world lands on the Tuff title screen again; the test
		// framework requires the vanilla one at the end, so switch it off.
		context.waitForScreen(TuffTitleScreen.class);
		context.runOnClient(client -> TuffClient.modules().titleScreen.setEnabled(false));
		context.setScreen(TitleScreen::new);
	}
}
