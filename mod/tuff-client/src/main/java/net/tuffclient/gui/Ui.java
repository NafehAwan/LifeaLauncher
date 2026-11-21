package net.tuffclient.gui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.resources.Identifier;
import net.tuffclient.TuffClient;

/**
 * Drawing toolkit for the Tuff screens: Inter text, anti-aliased rounded
 * shapes, tinted pixel icons and smoothly scaled textures. Positions are
 * floats and go through the pose matrix, so animations never snap to whole
 * GUI pixels.
 */
public final class Ui {
	public enum Font {
		BODY("body"), MEDIUM("medium"), SEMIBOLD("semibold"), BOLD("bold"), TITLE("title"), HERO("hero"),
		/** Small print: counts, hints, footers. */
		SMALL("small"),
		/** Bold small capitals for status bars. */
		CAPS("caps");

		/** One copy per oversample level, so glyphs are rasterised near the size they are shown at. */
		private final FontDescription[] variants = new FontDescription[MAX_OVERSAMPLE];

		Font(String id) {
			for (int i = 0; i < MAX_OVERSAMPLE; i++) {
				variants[i] = new FontDescription.Resource(Identifier.fromNamespaceAndPath(TuffClient.MOD_ID, id + "_" + (i + 1)));
			}
		}

		FontDescription description() {
			int oversample = (int) Math.ceil(scale() - 0.2f);
			return variants[Math.max(1, Math.min(MAX_OVERSAMPLE, oversample)) - 1];
		}
	}

	private static final int MAX_OVERSAMPLE = 6;

	private static final int[] RADII = {4, 8, 16, 32};
	private static final Identifier[] ROUND = new Identifier[RADII.length];
	private static final Identifier SHADOW = id("shadow");

	static {
		for (int i = 0; i < RADII.length; i++) ROUND[i] = id("round_" + RADII[i]);
	}

	private Ui() {
	}

	private static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(TuffClient.MOD_ID, path);
	}

	private static Minecraft mc() {
		return Minecraft.getInstance();
	}

	// ------------------------------------------------------------------ text

	public static Component text(String s, Font font) {
		return Component.literal(s).withStyle(style -> style.withFont(font.description()));
	}

	public static int width(String s, Font font) {
		return mc().font.width(text(s, font));
	}

	public static void text(GuiGraphicsExtractor g, String s, float x, float y, int color, Font font) {
		if ((color >>> 24) < 4 || s.isEmpty()) return;
		g.pose().pushMatrix();
		g.pose().translate(x, y);
		g.text(mc().font, text(s, font), 0, 0, color, false);
		g.pose().popMatrix();
	}

	public static void centered(GuiGraphicsExtractor g, String s, float cx, float y, int color, Font font) {
		text(g, s, cx - width(s, font) / 2f, y, color, font);
	}

	public static void right(GuiGraphicsExtractor g, String s, float rx, float y, int color, Font font) {
		text(g, s, rx - width(s, font), y, color, font);
	}

	/** Draws text with extra space between letters (for wordmarks). */
	public static float spaced(GuiGraphicsExtractor g, String s, float x, float y, int color, Font font, float spacing) {
		for (int i = 0; i < s.length(); i++) {
			String ch = String.valueOf(s.charAt(i));
			text(g, ch, x, y, color, font);
			x += width(ch, font) + spacing;
		}
		return x;
	}

	public static float spacedWidth(String s, Font font, float spacing) {
		float w = 0;
		for (int i = 0; i < s.length(); i++) w += width(String.valueOf(s.charAt(i)), font) + spacing;
		return s.isEmpty() ? 0 : w - spacing;
	}

	public static String ellipsize(String s, Font font, int maxWidth) {
		if (width(s, font) <= maxWidth) return s;
		String dots = "…";
		int end = s.length();
		while (end > 0 && width(s.substring(0, end).stripTrailing() + dots, font) > maxWidth) end--;
		return s.substring(0, end).stripTrailing() + dots;
	}

	// ------------------------------------------------------------------ shapes

	/** Filled rounded rectangle. Picks the sprite whose corner is closest to 1:1 on screen. */
	public static void round(GuiGraphicsExtractor g, float x, float y, float w, float h, float r, int argb) {
		if ((argb >>> 24) == 0 || w <= 0 || h <= 0) return;
		r = Math.max(0.5f, Math.min(r, Math.min(w, h) / 2));
		float physical = r * scale();
		int pick = RADII.length - 1;
		for (int i = 0; i < RADII.length; i++) {
			if (RADII[i] >= physical) {
				pick = i;
				break;
			}
		}
		float s = r / RADII[pick];
		g.pose().pushMatrix();
		g.pose().translate(x, y);
		g.pose().scale(s, s);
		g.blitSprite(RenderPipelines.GUI_TEXTURED, ROUND[pick], 0, 0, Math.max(2 * RADII[pick], Math.round(w / s)), Math.max(2 * RADII[pick], Math.round(h / s)), argb);
		g.pose().popMatrix();
	}

	/** Rounded rectangle with a border of the given width. */
	public static void round(GuiGraphicsExtractor g, float x, float y, float w, float h, float r, int fill, int border, float bw) {
		round(g, x, y, w, h, r, border);
		round(g, x + bw, y + bw, w - 2 * bw, h - 2 * bw, Math.max(0.5f, r - bw), fill);
	}

	public static void circle(GuiGraphicsExtractor g, float cx, float cy, float radius, int argb) {
		round(g, cx - radius, cy - radius, radius * 2, radius * 2, radius, argb);
	}

	/** Soft drop shadow around a rectangle. */
	public static void shadow(GuiGraphicsExtractor g, float x, float y, float w, float h, float spread, float alpha) {
		float s = spread / 16f;
		g.pose().pushMatrix();
		g.pose().translate(x - spread, y - spread + spread * 0.35f);
		g.pose().scale(s, s);
		g.blitSprite(RenderPipelines.GUI_TEXTURED, SHADOW, 0, 0, Math.round((w + 2 * spread) / s), Math.round((h + 2 * spread) / s), Theme.alpha(0xFF000000, alpha));
		g.pose().popMatrix();
	}

	// ------------------------------------------------------------------ icons & images

	/** 12x12 pixel icon, drawn at a whole multiple so it stays crisp. */
	public static void icon(GuiGraphicsExtractor g, String name, float x, float y, int size, int argb) {
		if ((argb >>> 24) == 0) return;
		// Pixel icons stay crisp only at whole multiples of their 12px grid, on whole physical pixels.
		float p = scale();
		float drawn = Math.max(1, Math.round(size * p / 12f)) * 12 / p;
		float off = (size - drawn) / 2;
		g.pose().pushMatrix();
		g.pose().translate(Math.round((x + off) * p) / p, Math.round((y + off) * p) / p);
		g.pose().scale(drawn / size, drawn / size);
		g.blitSprite(RenderPipelines.GUI_TEXTURED, id("icon/" + name), 0, 0, size, size, argb);
		g.pose().popMatrix();
	}

	/** Draws a whole texture into a float rectangle. */
	public static void image(GuiGraphicsExtractor g, Identifier texture, float x, float y, float w, float h, int texW, int texH, int argb) {
		if ((argb >>> 24) == 0) return;
		g.pose().pushMatrix();
		g.pose().translate(x, y);
		g.pose().scale(w / texW, h / texH);
		g.blit(RenderPipelines.GUI_TEXTURED, texture, 0, 0, 0f, 0f, texW, texH, texW, texH, texW, texH, argb);
		g.pose().popMatrix();
	}

	// ------------------------------------------------------------------ widgets

	/** Animated switch, 22x12. */
	public static void toggle(GuiGraphicsExtractor g, float x, float y, float anim, float alpha) {
		int track = Theme.mix(0xFF3A3F3B, Theme.COPPER, anim);
		round(g, x, y, 22, 12, 6, Theme.alpha(track, alpha));
		float knob = x + 2 + 10 * anim;
		circle(g, knob + 4, y + 6, 4, Theme.alpha(Theme.mix(0xFFB9BCB4, 0xFFFFFFFF, anim), alpha));
	}

	/** Accent pill button with a soft highlight. */
	public static void accentButton(GuiGraphicsExtractor g, float x, float y, float w, float h, float hover, float alpha) {
		round(g, x, y, w, h, Math.min(7, h / 2), Theme.alpha(Theme.mix(Theme.COPPER, Theme.COPPER_HI, hover * 0.6f), alpha));
		round(g, x + 1, y + 1, w - 2, h / 2f - 1, Math.min(6, h / 2), Theme.alpha(0x22FFFFFF, alpha));
	}

	/** Dark glass button. */
	public static void glassButton(GuiGraphicsExtractor g, float x, float y, float w, float h, float hover, float alpha) {
		int fill = Theme.mix(0xC81A0E12, 0xE62A1218, hover);
		int border = Theme.mix(0x30FFFFFF, Theme.alpha(Theme.COPPER, 0.85f), hover);
		round(g, x, y, w, h, Math.min(7, h / 2), Theme.alpha(fill, alpha), Theme.alpha(border, alpha), 1);
	}

	/** Extra scale a screen applies on top of the GUI scale (see {@link TuffMenuScreen}). */
	public static float zoom = 1f;

	public static int guiScale() {
		return mc().getWindow().getGuiScale();
	}

	/** Physical pixels per GUI unit, including {@link #zoom}. */
	public static float scale() {
		return guiScale() * zoom;
	}
}
