package net.tuffclient.module.util;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.tuffclient.gui.Theme;
import net.tuffclient.module.Category;
import net.tuffclient.module.Module;
import net.tuffclient.setting.BoolSetting;
import net.tuffclient.setting.ChoiceSetting;
import net.tuffclient.setting.NumberSetting;

/** Replaces the vanilla crosshair with a configurable one. */
public final class CrosshairModule extends Module {
	private static final int[] COLORS = {0xFFFFFFFF, Theme.COPPER_HI, 0xFF8FE3B0, 0xFF8EC9FF, 0xFFFF6B6B, 0xFFF2D06B};
	public final ChoiceSetting style = add(new ChoiceSetting("style", "Style", 0, "Cross", "Dot", "Square", "T"));
	public final ChoiceSetting color = add(new ChoiceSetting("color", "Color", 0, "White", "Copper", "Mint", "Sky", "Red", "Gold"));
	public final NumberSetting size = add(new NumberSetting("size", "Size", 5, 2, 12, 1));
	public final NumberSetting gap = add(new NumberSetting("gap", "Gap", 2, 0, 6, 1));
	public final BoolSetting outline = add(new BoolSetting("outline", "Outline", true));

	public CrosshairModule() {
		super("crosshair", "Crosshair", "Pick your own crosshair shape and color.", Category.VISUAL, false);
	}

	public void render(GuiGraphicsExtractor g) {
		int cx = g.guiWidth() / 2, cy = g.guiHeight() / 2;
		int s = size.get().intValue(), gp = gap.get().intValue();
		int c = COLORS[color.get()];
		switch (style.choice()) {
			case "Dot" -> rect(g, cx - 1, cy - 1, cx + 1, cy + 1, c);
			case "Square" -> {
				rect(g, cx - s, cy - s, cx + s, cy - s + 1, c);
				rect(g, cx - s, cy + s - 1, cx + s, cy + s, c);
				rect(g, cx - s, cy - s, cx - s + 1, cy + s, c);
				rect(g, cx + s - 1, cy - s, cx + s, cy + s, c);
			}
			case "T" -> {
				rect(g, cx - s - gp, cy, cx - gp, cy + 1, c);
				rect(g, cx + gp + 1, cy, cx + gp + 1 + s, cy + 1, c);
				rect(g, cx, cy + gp + 1, cx + 1, cy + gp + 1 + s, c);
			}
			default -> {
				rect(g, cx - s - gp, cy, cx - gp, cy + 1, c);
				rect(g, cx + gp + 1, cy, cx + gp + 1 + s, cy + 1, c);
				rect(g, cx, cy - s - gp, cx + 1, cy - gp, c);
				rect(g, cx, cy + gp + 1, cx + 1, cy + gp + 1 + s, c);
			}
		}
	}

	private void rect(GuiGraphicsExtractor g, int x1, int y1, int x2, int y2, int color) {
		if (outline.get()) g.fill(x1 - 1, y1 - 1, x2 + 1, y2 + 1, 0xC0000000);
		g.fill(x1, y1, x2, y2, color);
	}
}
