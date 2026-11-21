package net.tuffclient.gui;

import java.util.ArrayList;
import java.util.List;

import com.mojang.realmsclient.RealmsMainScreen;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.sounds.SoundEvents;
import net.tuffclient.TuffClient;

/** The Tuff title screen: smooth chamber, emblem, glass buttons and a toolbar. */
public final class TuffTitleScreen extends Screen {
	private static final Identifier EMBLEM = Identifier.fromNamespaceAndPath(TuffClient.MOD_ID, "textures/gui/title/lifea-logo.png");

	private record Button(String id, String label, String icon, int kind, Runnable action) {
		static final int GLASS = 0, ACCENT = 1, ROUND = 2, TOOL = 3;
	}

	private record Box(Button button, float x, float y, float w, float h) {
	}

	private final TitleBackground background = new TitleBackground();
	private final List<Box> boxes = new ArrayList<>();
	private final java.util.Map<String, Float> hover = new java.util.HashMap<>();
	private final String version;
	private float intro;
	private long last = System.nanoTime();

	public TuffTitleScreen() {
		super(Component.literal("Lifea Client"));
		String mc = FabricLoader.getInstance().getModContainer("minecraft").map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("");
		String tuff = FabricLoader.getInstance().getModContainer("tuff").map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("");
		version = "Lifea Client " + tuff + "  ·  Minecraft " + mc;
	}

	private boolean animate() {
		return TuffClient.modules().titleScreen.animate.get();
	}

	private void open(Screen screen) {
		minecraft.gui.setScreen(screen);
	}

	private void layout() {
		boxes.clear();
		float bw = Math.max(170, Math.min(240, width * 0.34f));
		float bh = height < 280 ? 20 : 23;
		float gap = height < 280 ? 5 : 6;
		float stack = bh * 3 + gap * 2;
		float bx = width / 2f - bw / 2;
		float by = Math.max(height * 0.47f, Math.min(height * 0.53f, height - 46 - stack));
		boxes.add(new Box(new Button("single", "Singleplayer", "user", Button.GLASS, () -> open(new SelectWorldScreen(this))), bx, by, bw, bh));
		boxes.add(new Box(new Button("multi", "Multiplayer", "globe", Button.GLASS, () -> open(new JoinMultiplayerScreen(this))), bx, by + bh + gap, bw, bh));
		float half = (bw - gap) / 2;
		boxes.add(new Box(new Button("mods", "Lifea Menu", "grid", Button.ACCENT, () -> open(new TuffMenuScreen(this))), bx, by + 2 * (bh + gap), half, bh));
		boxes.add(new Box(new Button("options", "Options", "gear", Button.GLASS, () -> open(new OptionsScreen(this, minecraft.options))), bx + half + gap, by + 2 * (bh + gap), half, bh));

		float r = 20, top = 8;
		boxes.add(new Box(new Button("quit", "Quit game", "power", Button.ROUND, minecraft::stop), width - 8 - r, top, r, r));
		boxes.add(new Box(new Button("settings", "Options", "gear", Button.ROUND, () -> open(new OptionsScreen(this, minecraft.options))), width - 8 - 2 * r - 6, top, r, r));
		boxes.add(new Box(new Button("realms", "Realms", "cloud", Button.ROUND, () -> open(new RealmsMainScreen(this))), width - 8 - 3 * r - 12, top, r, r));

		String[][] tools = {{"tool-mods", "Mods", "grid"}, {"tool-theme", "Theme", "brush"}, {"tool-packs", "Packs", "image"}, {"tool-settings", "Settings", "sliders"}};
		TuffMenuScreen.Page[] pages = {TuffMenuScreen.Page.MODS, TuffMenuScreen.Page.THEME, TuffMenuScreen.Page.PACKS, TuffMenuScreen.Page.SETTINGS};
		float tw = 26, tgap = 4, total = tools.length * tw + (tools.length - 1) * tgap;
		float tx = width / 2f - total / 2, ty = height - 34;
		for (int i = 0; i < tools.length; i++) {
			TuffMenuScreen.Page page = pages[i];
			boxes.add(new Box(new Button(tools[i][0], tools[i][1], tools[i][2], Button.TOOL, () -> open(new TuffMenuScreen(this, page))), tx + i * (tw + tgap), ty, tw, 22));
		}
	}

	@Override
	protected void init() {
		layout();
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		background.render(g, width, height, mouseX, mouseY, animate());
		g.fill(0, 0, width, height, 0x280D0207);
	}

	private float stage(float delay) {
		float t = Math.max(0, Math.min(1, (intro - delay) / 0.45f));
		return 1 - (1 - t) * (1 - t) * (1 - t);
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		long now = System.nanoTime();
		float dt = Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		intro = animate() ? intro + dt : 5;
		if (boxes.isEmpty()) layout();

		// emblem and wordmark
		float a = stage(0);
		float firstButton = boxes.getFirst().y();
		float emblem = Math.max(34, Math.min(64, (firstButton - 52) * 0.55f));
		float wordH = 34;
		float blockH = emblem + 8 + wordH;
		float top = Math.max(26, (firstButton - blockH) / 2 + 4) + (1 - a) * 8 + (float) Math.sin(now / 1e9 * 0.8) * 1.2f;
		Ui.shadow(g, width / 2f - emblem / 2 + 4, top + 4, emblem - 8, emblem - 8, 14, 0.35f * a);
		Ui.image(g, EMBLEM, width / 2f - emblem / 2, top, emblem, emblem, 1024, 1024, Theme.alpha(0xFFFFFFFF, a));
		float wy = top + emblem + 6;
		float ww = Ui.spacedWidth("LIFEA", Ui.Font.HERO, 5);
		Ui.spaced(g, "LIFEA", width / 2f - ww / 2 + 1, wy + 1, Theme.alpha(0x99000000, a), Ui.Font.HERO, 5);
		Ui.spaced(g, "LIFEA", width / 2f - ww / 2, wy, Theme.alpha(0xFFF4EFE6, a), Ui.Font.HERO, 5);
		float cw = Ui.spacedWidth("CLIENT", Ui.Font.SEMIBOLD, 4.5f);
		Ui.spaced(g, "CLIENT", width / 2f - cw / 2, wy + 26, Theme.alpha(Theme.COPPER_HI, a), Ui.Font.SEMIBOLD, 4.5f);

		// account chip
		String name = minecraft.getUser().getName();
		float chipA = stage(0.1f);
		float chipW = 34 + Ui.width(name, Ui.Font.SEMIBOLD);
		Ui.round(g, 8, 8 - (1 - chipA) * 6, chipW, 20, 10, Theme.alpha(0xC81A0E12, chipA), Theme.alpha(0x26FFFFFF, chipA), 1);
		Ui.circle(g, 18, 18 - (1 - chipA) * 6, 7, Theme.alpha(Theme.COPPER, chipA));
		Ui.centered(g, name.isEmpty() ? "?" : name.substring(0, 1).toUpperCase(), 18, 14.5f - (1 - chipA) * 6, Theme.alpha(Theme.INK, chipA), Ui.Font.BOLD);
		Ui.text(g, name, 29, 13.5f - (1 - chipA) * 6, Theme.alpha(Theme.TEXT, chipA), Ui.Font.SEMIBOLD);
		Ui.circle(g, chipW + 2, 18 - (1 - chipA) * 6, 2.5f, Theme.alpha(Theme.ONLINE, chipA));

		// buttons
		Box hovered = null;
		for (int i = 0; i < boxes.size(); i++) {
			Box b = boxes.get(i);
			Button btn = b.button();
			boolean over = Theme.inside(mouseX, mouseY, b.x(), b.y(), b.x() + b.w(), b.y() + b.h());
			if (over) hovered = b;
			float hv = Theme.approach(hover.getOrDefault(btn.id(), 0f), over ? 1 : 0, dt, 14);
			hover.put(btn.id(), hv);
			float appear = stage(btn.kind() == Button.ROUND ? 0.1f : btn.kind() == Button.TOOL ? 0.35f : 0.18f + i * 0.05f);
			float y = b.y() + (1 - appear) * 10 - hv * (btn.kind() == Button.ROUND ? 0 : 1);
			switch (btn.kind()) {
				case Button.ACCENT -> {
					Ui.shadow(g, b.x(), y, b.w(), b.h(), 10, 0.25f * appear + hv * 0.15f);
					Ui.accentButton(g, b.x(), y, b.w(), b.h(), hv, appear);
					label(g, b, y, btn, Theme.alpha(Theme.INK, appear));
				}
				case Button.GLASS -> {
					Ui.shadow(g, b.x(), y, b.w(), b.h(), 10, 0.25f * appear);
					Ui.glassButton(g, b.x(), y, b.w(), b.h(), hv, appear);
					label(g, b, y, btn, Theme.alpha(Theme.mix(Theme.TEXT, 0xFFFFFFFF, hv), appear));
				}
				case Button.ROUND -> {
					Ui.round(g, b.x(), y, b.w(), b.h(), b.h() / 2, Theme.alpha(Theme.mix(0xC81A0E12, 0xE62A1218, hv), appear), Theme.alpha(Theme.mix(0x26FFFFFF, Theme.COPPER, hv), appear), 1);
					Ui.icon(g, btn.icon(), b.x() + (b.w() - 12) / 2, y + (b.h() - 12) / 2, 12,
							Theme.alpha(btn.id().equals("quit") ? Theme.mix(Theme.MUTED, Theme.DANGER, hv) : Theme.mix(Theme.MUTED, Theme.TEXT, hv), appear));
				}
				default -> {
					if (i == boxes.size() - 4) {
						float pad = 4;
						Box lastTool = boxes.getLast();
						Ui.round(g, b.x() - pad, y - pad, lastTool.x() + lastTool.w() - b.x() + 2 * pad, b.h() + 2 * pad, 9,
								Theme.alpha(0xC81A0E12, appear), Theme.alpha(0x22FFFFFF, appear), 1);
					}
					Ui.round(g, b.x(), y, b.w(), b.h(), 6, Theme.alpha(Theme.mix(0x00FFFFFF, 0x1EFFFFFF, hv), appear));
					Ui.icon(g, btn.icon(), b.x() + (b.w() - 12) / 2, y + (b.h() - 12) / 2, 12, Theme.alpha(Theme.mix(Theme.MUTED, Theme.COPPER_HI, hv), appear));
				}
			}
		}

		// tooltip for icon-only buttons
		if (hovered != null && (hovered.button().kind() == Button.ROUND || hovered.button().kind() == Button.TOOL)) {
			String tip = hovered.button().label();
			float tw = Ui.width(tip, Ui.Font.MEDIUM) + 12;
			float tx = Math.max(4, Math.min(width - tw - 4, hovered.x() + hovered.w() / 2 - tw / 2));
			float ty = hovered.button().kind() == Button.TOOL ? hovered.y() - 22 : hovered.y() + hovered.h() + 5;
			Ui.round(g, tx, ty, tw, 15, 5, 0xF0262A27, 0x30FFFFFF, 1);
			Ui.text(g, tip, tx + 6, ty + 4, Theme.TEXT, Ui.Font.MEDIUM);
		}

		float fa = stage(0.4f);
		Ui.text(g, version, 8, height - 13, Theme.alpha(Theme.MUTED, fa), Ui.Font.SMALL);
		String legal = "Copyright Mojang AB. Do not distribute!";
		if (Ui.width(version, Ui.Font.SMALL) + Ui.width(legal, Ui.Font.SMALL) + 30 > width) legal = "© Mojang AB";
		Ui.right(g, legal, width - 8, height - 13, Theme.alpha(Theme.FAINT, fa), Ui.Font.SMALL);
	}

	private void label(GuiGraphicsExtractor g, Box b, float y, Button btn, int color) {
		float textW = Ui.width(btn.label(), Ui.Font.SEMIBOLD);
		float total = 12 + 6 + textW;
		float x = b.x() + (b.w() - total) / 2;
		Ui.icon(g, btn.icon(), x, y + (b.h() - 12) / 2, 12, color);
		Ui.text(g, btn.label(), x + 18, y + (b.h() - 9) / 2f, color, Ui.Font.SEMIBOLD);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		if (event.button() == 0) {
			for (Box b : boxes) {
				if (Theme.inside(event.x(), event.y(), b.x(), b.y(), b.x() + b.w(), b.y() + b.h())) {
					minecraft.getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1.0F));
					b.button().action().run();
					return true;
				}
			}
		}
		return super.mouseClicked(event, doubleClick);
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}

	@Override
	public boolean shouldCloseOnEsc() {
		return false;
	}
}
