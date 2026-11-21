package net.tuffclient.module.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.tuffclient.gui.Theme;

/** A single-line "label value" HUD element. */
public abstract class TextHudModule extends HudModule {
	private final String label;

	protected TextHudModule(String id, String name, String description, String label, double x, double y, boolean enabled) {
		super(id, name, description, x, y, enabled);
		this.label = label;
	}

	/** The value to show, or null to hide (ignored in the HUD editor preview). */
	protected abstract String value(Minecraft client, boolean preview);

	@Override
	public void render(GuiGraphicsExtractor g, Font font, boolean preview) {
		String value = value(Minecraft.getInstance(), preview);
		if (value == null) {
			if (!preview) return;
			value = "-";
		}
		int labelWidth = label.isEmpty() ? 0 : font.width(label) + 4;
		int w = labelWidth + font.width(value) + 8;
		box(g, w, 15);
		if (!label.isEmpty()) g.text(font, label, 4, 4, Theme.MUTED);
		g.text(font, value, 4 + labelWidth, 4, textColor());
	}
}
