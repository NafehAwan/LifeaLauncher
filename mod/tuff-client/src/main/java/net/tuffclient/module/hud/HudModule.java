package net.tuffclient.module.hud;

import com.google.gson.JsonObject;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.tuffclient.gui.Theme;
import net.tuffclient.module.Category;
import net.tuffclient.module.Module;
import net.tuffclient.setting.BoolSetting;
import net.tuffclient.setting.ChoiceSetting;
import net.tuffclient.setting.NumberSetting;

/**
 * A draggable HUD element. Position is stored as a fraction of the screen so
 * layouts survive window and GUI-scale changes.
 */
public abstract class HudModule extends Module {
	private static final int[] COLORS = {Theme.TEXT, Theme.COPPER_HI, 0xFF8FE3B0, 0xFF8EC9FF, 0xFFF2D06B};

	public double x;
	public double y;
	public final double defaultX;
	public final double defaultY;
	public final NumberSetting scale = add(new NumberSetting("scale", "Scale", 1.0, 0.5, 2.0, 0.1));
	public final BoolSetting background = add(new BoolSetting("background", "Background", true));
	public final ChoiceSetting color = add(new ChoiceSetting("color", "Text color", 0, "White", "Copper", "Mint", "Sky", "Gold"));

	/** Size of the last render, in unscaled GUI pixels. */
	protected int width = 40;
	protected int height = 14;

	protected HudModule(String id, String name, String description, double x, double y, boolean enabled) {
		super(id, name, description, Category.HUD, enabled);
		this.x = x;
		this.y = y;
		this.defaultX = x;
		this.defaultY = y;
	}

	public void resetPosition() {
		x = defaultX;
		y = defaultY;
		scale.set(1.0);
	}

	/** Draws at the origin; the manager has already translated and scaled. */
	public abstract void render(GuiGraphicsExtractor g, Font font, boolean preview);

	public int width() {
		return width;
	}

	public int height() {
		return height;
	}

	protected int textColor() {
		return COLORS[color.get()];
	}

	protected void box(GuiGraphicsExtractor g, int w, int h) {
		width = w;
		height = h;
		if (background.get()) g.fill(0, 0, w, h, 0x9A101210);
	}

	@Override
	public JsonObject save() {
		JsonObject json = super.save();
		json.addProperty("x", x);
		json.addProperty("y", y);
		return json;
	}

	@Override
	public void load(JsonObject json) {
		super.load(json);
		if (json.has("x")) x = json.get("x").getAsDouble();
		if (json.has("y")) y = json.get("y").getAsDouble();
	}
}
