package net.tuffclient.module.hud;

import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.tuffclient.gui.Theme;
import net.tuffclient.setting.BoolSetting;

public final class KeystrokesModule extends HudModule {
	private static final int KEY = 20;
	private static final int GAP = 2;
	private final BoolSetting showMouse = add(new BoolSetting("mouse", "Mouse buttons", true));
	private final BoolSetting showSpace = add(new BoolSetting("space", "Space bar", true));
	private final float[] glow = new float[7];
	private long last = System.nanoTime();

	public KeystrokesModule() {
		super("keystrokes", "Keystrokes", "Shows movement keys and mouse buttons as you press them.", 0.006, 0.72, false);
	}

	@Override
	public void render(GuiGraphicsExtractor g, Font font, boolean preview) {
		Minecraft client = Minecraft.getInstance();
		long now = System.nanoTime();
		float dt = Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		int row = KEY + GAP;
		int w = KEY * 3 + GAP * 2;
		key(g, font, 0, client.options.keyUp, "W", KEY + GAP, 0, KEY, KEY, dt);
		key(g, font, 1, client.options.keyLeft, "A", 0, row, KEY, KEY, dt);
		key(g, font, 2, client.options.keyDown, "S", row, row, KEY, KEY, dt);
		key(g, font, 3, client.options.keyRight, "D", row * 2, row, KEY, KEY, dt);
		int y = row * 2;
		if (showMouse.get()) {
			int half = (w - GAP) / 2;
			key(g, font, 4, client.options.keyAttack, CpsModule.left() + " CPS", 0, y, half, KEY - 4, dt);
			key(g, font, 5, client.options.keyUse, CpsModule.right() + " CPS", half + GAP, y, w - half - GAP, KEY - 4, dt);
			y += KEY - 4 + GAP;
		}
		if (showSpace.get()) {
			key(g, font, 6, client.options.keyJump, "", 0, y, w, 10, dt);
			g.fill(w / 2 - 10, y + 4, w / 2 + 10, y + 5, glow[6] > 0.5f ? Theme.INK : Theme.MUTED);
			y += 10 + GAP;
		}
		width = w;
		height = y - GAP;
	}

	private void key(GuiGraphicsExtractor g, Font font, int i, KeyMapping mapping, String label, int x, int y, int w, int h, float dt) {
		glow[i] = Theme.approach(glow[i], mapping.isDown() ? 1 : 0, dt, 18);
		int fill = Theme.mix(background.get() ? 0x9A101210 : 0x00000000, Theme.alpha(Theme.COPPER, 0.92f), glow[i]);
		g.fill(x, y, x + w, y + h, fill);
		if (!label.isEmpty()) {
			int color = Theme.mix(textColor(), Theme.INK, glow[i]);
			g.text(font, label, x + (w - font.width(label)) / 2, y + (h - 8) / 2, color);
		}
	}
}
