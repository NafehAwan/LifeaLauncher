package net.tuffclient.gui;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.controls.KeyBindsScreen;
import net.minecraft.client.gui.screens.packs.PackSelectionScreen;
import net.minecraft.client.input.CharacterEvent;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.server.packs.repository.Pack;
import net.minecraft.server.packs.repository.PackRepository;
import net.minecraft.sounds.SoundEvents;
import net.tuffclient.ModuleManager;
import net.tuffclient.TuffClient;
import net.tuffclient.TuffConfig;
import net.tuffclient.module.Category;
import net.tuffclient.module.Module;
import net.tuffclient.module.hud.HudModule;
import net.tuffclient.setting.BoolSetting;
import net.tuffclient.setting.ChoiceSetting;
import net.tuffclient.setting.NumberSetting;
import net.tuffclient.setting.Setting;

/** The Tuff mod menu: a top bar with Mods, Theme, Packs and Settings pages and a grid of mod cards. */
public final class TuffMenuScreen extends Screen {
	public enum Page {
		MODS("Mods", "grid"), THEME("Theme", "brush"), PACKS("Packs", "image"), SETTINGS("Settings", "sliders");

		final String label;
		final String icon;

		Page(String label, String icon) {
			this.label = label;
			this.icon = icon;
		}
	}

	private enum Tab {
		ALL("All"), ENABLED("Enabled"), HUD("HUD"), UTILITY("Utility"), VISUAL("Visual");

		final String label;

		Tab(String label) {
			this.label = label;
		}
	}

	private record Hit(float x1, float y1, float x2, float y2, Consumer<MouseButtonEvent> action) {
	}

	private static final Identifier EMBLEM = Identifier.fromNamespaceAndPath(TuffClient.MOD_ID, "textures/gui/title/lifea-logo.png");
	private static final Map<String, String> ICONS = Map.ofEntries(
			Map.entry("fps", "gauge"), Map.entry("cps", "mouse"), Map.entry("keystrokes", "keyboard"),
			Map.entry("armor", "shirt"), Map.entry("coordinates", "pin"), Map.entry("ping", "signal"),
			Map.entry("effects", "potion"), Map.entry("clock", "clock"), Map.entry("server", "globe"),
			Map.entry("speed", "bolt"), Map.entry("memory", "chip"), Map.entry("zoom", "search"),
			Map.entry("fullbright", "sun"), Map.entry("toggle_sprint", "sprint"), Map.entry("crosshair", "crosshair"),
			Map.entry("hide_scoreboard", "list"), Map.entry("title_screen", "image"));
	private static final int CARD_H = 96;
	/** Height of the top bar with the brand, page tabs and close button. */
	private static final int TOP = 32;
	/** The menu is laid out in a space about this many units tall, whatever the GUI scale. */
	private static final float VIRTUAL_HEIGHT = 340;
	private static final int GAP = 8;

	private final Screen parent;
	private final List<Hit> hits = new ArrayList<>();
	private final Map<String, Float> anim = new HashMap<>();
	private final TitleBackground background = new TitleBackground();
	private Page page;
	private Tab tab = Tab.ALL;
	private String query = "";
	private float scroll;
	private float scrollTarget;
	private float maxScroll;
	private Module drawer;
	private float drawerAnim;
	private float drawerScroll;
	private NumberSetting dragging;
	private float dragX1;
	private float dragX2;
	private float open;
	private float pageFade = 1;
	private float dt;
	private long last = System.nanoTime();
	private List<String> enabledPacks;
	private List<String> availablePacks;
	private boolean packsDirty;
	private double clickX;
	private Module hovered;
	private final Map<String, float[]> statusBars = new HashMap<>();
	private float drawerLeft;

	public TuffMenuScreen(Screen parent) {
		this(parent, Page.MODS);
	}

	public TuffMenuScreen(Screen parent, Page page) {
		super(Component.literal("Tuff"));
		this.parent = parent;
		this.page = page;
	}

	public void setPage(Page page) {
		if (this.page == page) return;
		this.page = page;
		drawer = null;
		scroll = scrollTarget = 0;
		pageFade = 0;
		if (page == Page.PACKS) loadPacks();
	}

	/** Window-pixel centre of a module card's status bar as last drawn, or null (used by tests). */
	public double[] statusBarPosition(String moduleId) {
		float[] p = statusBars.get(moduleId);
		if (p == null) return null;
		double k = zoom() * minecraft.getWindow().getGuiScale();
		return new double[] {p[0] * k, p[1] * k};
	}

	public void openSettings(Module module) {
		drawer = module;
		drawerScroll = 0;
	}

	private ModuleManager modules() {
		return TuffClient.modules();
	}

	private int cardHeight() {
		return modules().ui.layout.get() == 1 ? 72 : CARD_H;
	}

	private boolean animations() {
		return modules().ui.animations.get();
	}

	private float anim(String key, boolean target, float speed) {
		float v = anim.getOrDefault(key, target ? 1f : 0f);
		v = animations() ? Theme.approach(v, target ? 1 : 0, dt, speed) : (target ? 1 : 0);
		anim.put(key, v);
		return v;
	}

	private void click() {
		minecraft.getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1.0F));
	}

	private void hit(float x1, float y1, float x2, float y2, Consumer<MouseButtonEvent> action) {
		hits.add(new Hit(x1, y1, x2, y2, action));
	}

	// ------------------------------------------------------------------ layout

	/**
	 * GUI units per menu unit. Large GUI scales (the default on 1080p and up) would make the
	 * menu huge and cramped, so it is drawn at a steady physical size instead, never larger
	 * than vanilla would draw it.
	 */
	private float zoom() {
		int gs = Ui.guiScale();
		// Small windows keep at least 1.5 physical pixels per unit so text stays readable.
		float unit = Math.min(gs, Math.max(1.5f, height * gs / VIRTUAL_HEIGHT));
		return unit / gs;
	}

	private float vw() {
		return width / zoom();
	}

	private float vh() {
		return height / zoom();
	}

	private float ww() {
		return Math.max(420, Math.min(760, vw() * 0.94f));
	}

	private float wh() {
		return Math.max(240, Math.min(420, vh() * 0.9f));
	}

	private float wx() {
		return (vw() - ww()) / 2;
	}

	private float wy() {
		return (vh() - wh()) / 2;
	}

	// ------------------------------------------------------------------ rendering

	@Override
	public void extractBackground(GuiGraphicsExtractor g, int mouseX, int mouseY, float partialTick) {
		if (minecraft.level == null) {
			background.render(g, width, height, mouseX, mouseY, TuffClient.modules().titleScreen.animate.get());
			g.fill(0, 0, width, height, 0x8A080908);
		} else if (modules().ui.blur.get()) {
			extractBlurredBackground(g);
			g.fill(0, 0, width, height, 0x66000000);
		} else {
			g.fill(0, 0, width, height, 0xB0000000);
		}
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor g, int guiMouseX, int guiMouseY, float partialTick) {
		float z = zoom();
		int mouseX = Math.round(guiMouseX / z), mouseY = Math.round(guiMouseY / z);
		long now = System.nanoTime();
		dt = Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		open = animations() ? Theme.approach(open, 1, dt, 12) : 1;
		pageFade = animations() ? Theme.approach(pageFade, 1, dt, 14) : 1;
		scroll = animations() ? Theme.approach(scroll, scrollTarget, dt, 18) : scrollTarget;
		drawerAnim = Theme.approach(drawerAnim, drawer != null ? 1 : 0, dt, animations() ? 16 : 1000);
		hits.clear();
		hovered = null;

		float x = wx(), y = wy(), w = ww(), h = wh();
		float s = 0.96f + 0.04f * open;
		Ui.zoom = z;
		g.pose().pushMatrix();
		g.pose().scale(z, z);
		g.pose().translate(vw() / 2f, vh() / 2f);
		g.pose().scale(s, s);
		g.pose().translate(-vw() / 2f, -vh() / 2f);
		float a = open;

		// window: dark top bar over a slightly lighter body
		Ui.shadow(g, x, y, w, h, 24, 0.6f * a);
		Ui.round(g, x, y, w, h, 12, Theme.alpha(0xFA10080A, a), Theme.alpha(0x26FFFFFF, a), 1);
		Ui.round(g, x + 1, y + TOP, w - 2, h - TOP - 1, 11, Theme.alpha(0xF71A0E12, a));
		g.fill(Math.round(x + 1), Math.round(y + TOP), Math.round(x + w - 1), Math.round(y + TOP + 12), Theme.alpha(0xF71A0E12, a));
		g.fill(Math.round(x + 1), Math.round(y + TOP), Math.round(x + w - 1), Math.round(y + TOP + 1), Theme.alpha(0x1CFFFFFF, a));

		float pa = a * pageFade;
		float slide = (1 - pageFade) * 6;
		switch (page) {
			case MODS -> mods(g, mouseX, mouseY, x, y + slide, w, h, pa);
			case THEME -> theme(g, mouseX, mouseY, x, y + 20 + slide, w, h - 20, pa);
			case PACKS -> packs(g, mouseX, mouseY, x, y + 20 + slide, w, h - 20, pa);
			case SETTINGS -> settings(g, mouseX, mouseY, x, y + 20 + slide, w, h - 20, pa);
		}
		if (page != Page.MODS) pageTitle(g, x, y, pa);
		topBar(g, mouseX, mouseY, x, y, w, a);
		if (drawerAnim > 0.01f && drawer != null) drawer(g, mouseX, mouseY, x, y + TOP, w, h - TOP, a);
		else if (drawerAnim > 0.01f) drawerAnim = 0;
		g.pose().popMatrix();
		Ui.zoom = 1f;
	}

	private void topBar(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, float a) {
		// brand
		Ui.image(g, EMBLEM, x + 11, y + 7, 18, 18, 1024, 1024, Theme.alpha(0xFFFFFFFF, a));
		Ui.spaced(g, "LIFEA", x + 35, y + 6, Theme.alpha(Theme.TEXT, a), Ui.Font.BOLD, 1.2f);
		Ui.spaced(g, "CLIENT MENU", x + 35.5f, y + 18, Theme.alpha(Theme.COPPER_HI, a), Ui.Font.SMALL, 0.8f);
		float left = x + 35 + Math.max(Ui.spacedWidth("LIFEA", Ui.Font.BOLD, 1.2f), Ui.spacedWidth("CLIENT MENU", Ui.Font.SMALL, 0.8f)) + 14;

		// close button and player chip on the right
		float cx = x + w - 10 - 20, cy = y + 6;
		boolean over = Theme.inside(mouseX, mouseY, cx, cy, cx + 20, cy + 20);
		float hv = anim("close", over, 16);
		Ui.round(g, cx, cy, 20, 20, 6, Theme.alpha(Theme.mix(0xFF1A1D1B, Theme.DISABLED, hv), a), Theme.alpha(Theme.mix(0x1EFFFFFF, 0x00FFFFFF, hv), a), 1);
		Ui.icon(g, "close", cx + 4, cy + 4, 12, Theme.alpha(Theme.mix(Theme.MUTED, 0xFFFFFFFF, hv), a));
		hit(cx, cy, cx + 20, cy + 20, e -> onClose());

		String name = minecraft.getUser().getName();
		long on = modules().visible().stream().filter(Module::isEnabled).count();
		String status = on + "/" + modules().visible().size() + " on";
		float nameW = Math.min(70, Ui.width(name, Ui.Font.SEMIBOLD));
		float chipW = 28 + Math.max(nameW, Ui.width(status, Ui.Font.SMALL));

		// page tabs in the middle
		float tabsW = 0;
		for (int i = 0; i <= Page.values().length; i++) tabsW += navWidth(i) + (i > 0 ? 3 : 0);
		float right = cx - 8 - chipW;
		boolean chip = right - left >= tabsW + 8;
		if (!chip) right = cx - 8;
		float tx = Math.max(left, Math.min(x + (w - tabsW) / 2, right - tabsW));
		for (Page p : Page.values()) {
			float nw = navWidth(p.ordinal());
			navItem(g, mouseX, mouseY, tx, y + 5, nw, p.label, p.icon, page == p, a, () -> setPage(p));
			tx += nw + 3;
		}
		navItem(g, mouseX, mouseY, tx, y + 5, navWidth(Page.values().length), "Edit HUD", "layout", false, a,
				() -> minecraft.gui.setScreen(new HudEditorScreen(this)));

		if (chip) {
			float px = cx - 8 - chipW;
			Ui.round(g, px, cy, chipW, 20, 10, Theme.alpha(0xFF181B19, a), Theme.alpha(0x1AFFFFFF, a), 1);
			Ui.circle(g, px + 10, cy + 10, 7, Theme.alpha(Theme.COPPER, a));
			Ui.centered(g, name.isEmpty() ? "?" : name.substring(0, 1).toUpperCase(), px + 10, cy + 5.5f, Theme.alpha(Theme.INK, a), Ui.Font.BOLD);
			Ui.text(g, Ui.ellipsize(name, Ui.Font.SEMIBOLD, Math.round(nameW)), px + 21, cy + 2, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
			Ui.circle(g, px + 22.5f, cy + 15, 1.5f, Theme.alpha(Theme.ONLINE, a));
			Ui.text(g, status, px + 26, cy + 11.5f, Theme.alpha(Theme.MUTED, a), Ui.Font.SMALL);
		}
	}

	private float navWidth(int index) {
		String label = index < Page.values().length ? Page.values()[index].label : "Edit HUD";
		return 12 + 5 + Ui.width(label, Ui.Font.SEMIBOLD) + 16;
	}

	private void navItem(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, String label, String icon, boolean active, float a, Runnable action) {
		float h = 22;
		boolean over = Theme.inside(mouseX, mouseY, x, y, x + w, y + h);
		float hv = anim("nav:" + label, over, 16);
		float act = anim("navA:" + label, active, 14);
		if (act > 0.01f) {
			Ui.round(g, x, y, w, h, 7, Theme.alpha(Theme.COPPER, 0.2f * act * a));
			Ui.round(g, x + 8, y + h - 2, w - 16, 2, 1, Theme.alpha(Theme.COPPER, act * a));
		}
		if (hv > 0.01f && !active) Ui.round(g, x, y, w, h, 7, Theme.alpha(0xFFFFFFFF, 0.06f * hv * a));
		int color = Theme.mix(Theme.mix(Theme.MUTED, Theme.TEXT, hv), Theme.COPPER_HI, act);
		Ui.icon(g, icon, x + 8, y + 5, 12, Theme.alpha(color, a));
		Ui.text(g, label, x + 25, y + 6, Theme.alpha(Theme.mix(Theme.mix(Theme.MUTED, Theme.TEXT, hv), Theme.TEXT, act), a), Ui.Font.SEMIBOLD);
		hit(x, y, x + w, y + h, e -> {
			click();
			action.run();
		});
	}

	/** Title row of the Theme, Packs and Settings pages. */
	private void pageTitle(GuiGraphicsExtractor g, float x, float y, float a) {
		String subtitle = switch (page) {
			case THEME -> "Accent colour and menu style";
			case PACKS -> "Resource packs, top of the list wins";
			case SETTINGS -> "Title screen, keybinds and HUD";
			default -> "";
		};
		Ui.text(g, page.label, x + 18, y + TOP + 13, Theme.alpha(Theme.TEXT, a), Ui.Font.TITLE);
		Ui.text(g, subtitle, x + 26 + Ui.width(page.label, Ui.Font.TITLE), y + TOP + 15, Theme.alpha(Theme.MUTED, a), Ui.Font.BODY);
	}

	// ------------------------------------------------------------------ mods page

	private List<Module> filtered(Tab t) {
		String q = query.toLowerCase();
		List<Module> out = new ArrayList<>();
		for (Module m : modules().visible()) {
			boolean matches = switch (t) {
				case ALL -> true;
				case ENABLED -> m.isEnabled();
				case HUD -> m.category == Category.HUD;
				case UTILITY -> m.category == Category.UTILITY;
				case VISUAL -> m.category == Category.VISUAL;
			};
			if (!matches) continue;
			if (!q.isEmpty() && !m.name.toLowerCase().contains(q) && !m.description.toLowerCase().contains(q)) continue;
			out.add(m);
		}
		return out;
	}

	private void mods(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, float h, float a) {
		// category tabs
		float tx = x + 14, ty = y + TOP + 8;
		for (Tab t : Tab.values()) {
			String count = String.valueOf(filtered(t).size());
			float tw = Ui.width(t.label, Ui.Font.SEMIBOLD) + 5 + Ui.width(count, Ui.Font.SMALL) + 18;
			boolean active = tab == t;
			boolean over = Theme.inside(mouseX, mouseY, tx, ty, tx + tw, ty + 20);
			float act = anim("tab:" + t, active, 14), hv = anim("tabH:" + t, over, 16);
			Ui.round(g, tx, ty, tw, 20, 6, Theme.alpha(Theme.mix(Theme.mix(0xFF241218, 0xFF321820, hv), Theme.COPPER, act), a));
			int color = Theme.mix(Theme.mix(Theme.MUTED, Theme.TEXT, hv), Theme.INK, act);
			Ui.text(g, t.label, tx + 9, ty + 5, Theme.alpha(color, a), Ui.Font.SEMIBOLD);
			Ui.text(g, count, tx + 14 + Ui.width(t.label, Ui.Font.SEMIBOLD), ty + 6.5f, Theme.alpha(Theme.mix(Theme.FAINT, Theme.alpha(Theme.INK, 0.7f), act), a), Ui.Font.SMALL);
			hit(tx, ty, tx + tw, ty + 20, e -> {
				click();
				tab = t;
				scrollTarget = 0;
			});
			tx += tw + 5;
		}

		// search
		float sw = Math.max(90, Math.min(160, x + w - 14 - tx - 8)), sx = x + w - 14 - sw;
		boolean typing = !query.isEmpty();
		Ui.round(g, sx, ty, sw, 20, 6, Theme.alpha(0xFF10080A, a), Theme.alpha(typing ? Theme.COPPER : 0x1EFFFFFF, a), 1);
		Ui.icon(g, "search", sx + 6, ty + 4, 12, Theme.alpha(typing ? Theme.COPPER_HI : Theme.FAINT, a));
		boolean blink = (System.nanoTime() / 530_000_000L) % 2 == 0;
		String shown = typing ? query + (blink ? "|" : "") : "Search mods…";
		Ui.text(g, Ui.ellipsize(shown, Ui.Font.BODY, Math.round(sw - 30)), sx + 23, ty + 5.5f, Theme.alpha(typing ? Theme.TEXT : Theme.FAINT, a), Ui.Font.BODY);

		// card grid
		float gx = x + 14, gy = ty + 30, gw = w - 28, gh = y + h - 22 - gy;
		int cols = modules().ui.layout.get() == 1 ? (gw >= 520 ? 6 : gw >= 400 ? 5 : 4) : (gw >= 520 ? 5 : gw >= 400 ? 4 : 3);
		int cardHeight = cardHeight();
		float cw = (gw - GAP * (cols - 1)) / cols;
		List<Module> list = filtered(tab);
		int rows = (list.size() + cols - 1) / cols;
		maxScroll = Math.max(0, rows * (cardHeight + GAP) - GAP - gh);
		scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
		g.enableScissor(Math.round(gx - 4), Math.round(gy), Math.round(gx + gw + 4), Math.round(gy + gh));
		boolean inGrid = mouseY >= gy && mouseY < gy + gh;
		for (int i = 0; i < list.size(); i++) {
			float cx = gx + (i % cols) * (cw + GAP);
			float cy = gy + 2 + (i / cols) * (cardHeight + GAP) - scroll;
			if (cy + cardHeight < gy || cy > gy + gh) continue;
			card(g, mouseX, mouseY, list.get(i), cx, cy, cw, cardHeight, a, inGrid, gy, gy + gh);
		}
		g.disableScissor();
		if (list.isEmpty()) {
			Ui.centered(g, query.isEmpty() ? "Nothing here yet" : "No mods match \"" + query + "\"", gx + gw / 2, gy + 40, Theme.alpha(Theme.MUTED, a), Ui.Font.MEDIUM);
		}
		scrollbar(g, gx + gw + 5, gy, gh, a);

		// footer: the hovered mod's description, or the controls
		float fy = y + h - 15;
		String mc = net.fabricmc.loader.api.FabricLoader.getInstance().getModContainer("minecraft")
				.map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("");
		String version = "Lifea Client  ·  " + mc;
		float vw = Ui.width(version, Ui.Font.SMALL);
		String hint = hovered != null ? hovered.name + "  —  " + hovered.description
				: "Click a card to toggle  ·  Right-click or the gear for options  ·  Type to search";
		Ui.text(g, Ui.ellipsize(hint, Ui.Font.SMALL, Math.round(w - 28 - vw - 16)), x + 14, fy, Theme.alpha(hovered != null ? Theme.MUTED : Theme.FAINT, a), Ui.Font.SMALL);
		Ui.right(g, version, x + w - 14, fy, Theme.alpha(Theme.FAINT, a), Ui.Font.SMALL);
	}

	private void scrollbar(GuiGraphicsExtractor g, float x, float y, float h, float a) {
		if (maxScroll <= 0) return;
		float thumb = Math.max(24, h * h / (h + maxScroll));
		float ty = y + (h - thumb) * (scroll / maxScroll);
		Ui.round(g, x, ty, 3, thumb, 1.5f, Theme.alpha(0x40FFFFFF, a));
	}

	private void card(GuiGraphicsExtractor g, int mouseX, int mouseY, Module m, float x, float y, float w, int cardHeight, float a, boolean inView, float clipTop, float clipBottom) {
		boolean compact = cardHeight < CARD_H;
		boolean over = inView && Theme.inside(mouseX, mouseY, x, y, x + w, y + cardHeight);
		if (over) hovered = m;
		float hv = anim("card:" + m.id, over, 14);
		float on = anim("on:" + m.id, m.isEnabled(), 12);
		float lift = hv * 1.5f;
		float top = y - lift;
		int fill = Theme.mix(0xFF1A0E12, 0xFF261218, hv);
		int border = Theme.mix(0x16FFFFFF, Theme.alpha(Theme.COPPER, 0.6f), hv * 0.85f);
		Ui.round(g, x, top, w, cardHeight, 8, Theme.alpha(fill, a), Theme.alpha(border, a), 1);

		// name and gear
		boolean hasSettings = !m.settings().isEmpty();
		// the whole card toggles; registered first so the gear (added later) wins its own clicks
		if (y + cardHeight > clipTop && y < clipBottom) hit(x, Math.max(y, clipTop), x + w, Math.min(y + cardHeight, clipBottom), e -> {
			click();
			if (e.button() == 1 && hasSettings) openSettings(m);
			else m.toggle();
		});
		Ui.text(g, Ui.ellipsize(m.name, Ui.Font.SEMIBOLD, Math.round(w - (hasSettings ? 32 : 16))), x + 8, top + 7, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		if (hasSettings) {
			float gx = x + w - 19, gy = top + 6;
			boolean gearOver = inView && Theme.inside(mouseX, mouseY, gx - 3, gy - 3, gx + 15, gy + 15);
			if (gearOver) Ui.round(g, gx - 3, gy - 3, 18, 18, 5, Theme.alpha(0x22FFFFFF, a));
			Ui.icon(g, "gear", gx, gy, 12, Theme.alpha(gearOver ? Theme.COPPER_HI : Theme.mix(Theme.FAINT, Theme.MUTED, hv), a));
			if (gy - 3 >= clipTop && gy + 15 <= clipBottom) hit(gx - 3, gy - 3, gx + 15, gy + 15, e -> {
				click();
				openSettings(m);
			});
		}

		// big icon
		float barH = compact ? 16 : 20, iconSize = compact ? 22 : 32;
		float iy = top + 22 + (cardHeight - 22 - barH - iconSize) / 2;
		if (on > 0.02f) Ui.round(g, x + w / 2 - 22, iy - 6, 44, 44, 22, Theme.alpha(Theme.COPPER, 0.08f * on * a));
		Ui.icon(g, ICONS.getOrDefault(m.id, "cube"), x + w / 2 - iconSize / 2, iy, Math.round(iconSize), Theme.alpha(Theme.mix(0xFF7B8079, Theme.COPPER_HI, on), a));

		// status bar along the bottom edge
		float by = top + cardHeight - barH;
		boolean barOver = inView && Theme.inside(mouseX, mouseY, x, by, x + w, by + barH);
		float bh = anim("bar:" + m.id, barOver, 16);
		int bar = Theme.mix(Theme.mix(Theme.DISABLED, Theme.DISABLED_HI, bh), Theme.mix(Theme.ENABLED, Theme.ENABLED_HI, bh), on);
		Ui.round(g, x + 1, by, w - 2, barH - 1, 7, Theme.alpha(bar, a));
		g.fill(Math.round(x + 1), Math.round(by), Math.round(x + w - 1), Math.round(by + 8), Theme.alpha(bar, a));
		g.fill(Math.round(x + 1), Math.round(by), Math.round(x + w - 1), Math.round(by + 1), Theme.alpha(0x30FFFFFF, a));
		statusBars.put(m.id, new float[] {x + w / 2, by + barH / 2});
		String label = m.isEnabled() ? "ENABLED" : "DISABLED";
		Ui.spaced(g, label, x + w / 2 - Ui.spacedWidth(label, Ui.Font.CAPS, 0.8f) / 2, by + 6, Theme.alpha(0xFFFFFFFF, a), Ui.Font.CAPS, 0.8f);

	}

	// ------------------------------------------------------------------ settings drawer

	private void drawer(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, float h, float a) {
		Module m = drawer;
		float dw = Math.min(230, w * 0.42f);
		float ease = 1 - (1 - drawerAnim) * (1 - drawerAnim);
		float dx = x + w - dw * ease;
		drawerLeft = dx;
		hit(x, y, dx, y + h, e -> drawer = null);
		g.enableScissor(Math.round(x), Math.round(y), Math.round(x + w), Math.round(y + h));
		Ui.round(g, x + 1, y - 12, w - 2, h + 11, 11, Theme.alpha(0x66000000, ease * a));
		Ui.shadow(g, dx, y, dw, h, 16, 0.5f * ease);
		Ui.round(g, dx, y, dw + 12, h, 12, Theme.alpha(0xFF1A1D1B, a), Theme.alpha(0x22FFFFFF, a), 1);
		hit(dx, y, x + w, y + h, e -> { });

		float px = dx + 14, pw = dw - 28;
		float cy = y + 14;
		Ui.icon(g, ICONS.getOrDefault(m.id, "cube"), px, cy + 1, 12, Theme.alpha(Theme.COPPER, a));
		Ui.text(g, Ui.ellipsize(m.name, Ui.Font.BOLD, Math.round(pw - 40)), px + 18, cy + 2, Theme.alpha(Theme.TEXT, a), Ui.Font.BOLD);
		float bx = dx + dw - 14 - 16;
		boolean closeOver = Theme.inside(mouseX, mouseY, bx, cy - 2, bx + 16, cy + 14);
		Ui.icon(g, "close", bx + 2, cy, 12, Theme.alpha(closeOver ? Theme.TEXT : Theme.MUTED, a));
		hit(bx, cy - 2, bx + 16, cy + 14, e -> drawer = null);
		cy += 20;
		for (String line : wrap(m.description, Ui.Font.BODY, Math.round(pw))) {
			Ui.text(g, line, px, cy, Theme.alpha(Theme.MUTED, a), Ui.Font.BODY);
			cy += 11.5f;
		}
		cy += 6;

		float top = cy, bottom = y + h - 10;
		g.enableScissor(Math.round(dx), Math.round(top), Math.round(dx + dw), Math.round(bottom));
		cy -= drawerScroll;
		cy = row(g, mouseX, mouseY, px, cy, pw, "Enabled", m.isEnabled(), m::toggle, a, top, bottom);
		for (Setting<?> setting : m.settings()) {
			switch (setting) {
				case BoolSetting b -> cy = row(g, mouseX, mouseY, px, cy, pw, b.name, b.get(), b::toggle, a, top, bottom);
				case ChoiceSetting c -> cy = choice(g, mouseX, mouseY, px, cy, pw, c, a, top, bottom);
				case NumberSetting n -> cy = slider(g, mouseX, mouseY, px, cy, pw, n, a, top, bottom);
			}
		}
		float content = cy + drawerScroll - top;
		drawerMax = Math.max(0, content - (bottom - top));
		g.disableScissor();
		g.disableScissor();
	}

	private float drawerMax;

	private float row(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, String label, boolean value, Runnable toggle, float a, float top, float bottom) {
		Ui.round(g, x, y, w, 26, 7, Theme.alpha(0xFF222623, a));
		Ui.text(g, label, x + 9, y + 9, Theme.alpha(Theme.TEXT, a), Ui.Font.MEDIUM);
		Ui.toggle(g, x + w - 9 - 22, y + 7, anim("row:" + drawer.id + label, value, 14), a);
		if (y + 26 > top && y < bottom) hit(x, Math.max(y, top), x + w, Math.min(y + 26, bottom), e -> {
			click();
			toggle.run();
		});
		return y + 30;
	}

	private float choice(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, ChoiceSetting c, float a, float top, float bottom) {
		Ui.text(g, c.name, x + 2, y + 2, Theme.alpha(Theme.TEXT, a), Ui.Font.MEDIUM);
		float cx = x, cy = y + 14;
		for (int i = 0; i < c.options.length; i++) {
			String opt = c.options[i];
			float pw = Ui.width(opt, Ui.Font.MEDIUM) + 14;
			if (cx + pw > x + w) {
				cx = x;
				cy += 20;
			}
			boolean selected = c.get() == i;
			boolean over = Theme.inside(mouseX, mouseY, cx, cy, cx + pw, cy + 17);
			float act = anim("chip:" + drawer.id + c.id + i, selected, 16);
			Ui.round(g, cx, cy, pw, 17, 6, Theme.alpha(Theme.mix(over ? 0xFF2C302D : 0xFF222623, Theme.alpha(Theme.COPPER, 0.9f), act), a));
			Ui.text(g, opt, cx + 7, cy + 5, Theme.alpha(Theme.mix(Theme.TEXT, Theme.INK, act), a), Ui.Font.MEDIUM);
			final int index = i;
			if (cy + 17 > top && cy < bottom) hit(cx, Math.max(cy, top), cx + pw, Math.min(cy + 17, bottom), e -> {
				click();
				c.set(index);
				if (drawer == modules().ui) modules().ui.applyAccent();
			});
			cx += pw + 4;
		}
		return cy + 24;
	}

	private float slider(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, NumberSetting n, float a, float top, float bottom) {
		Ui.text(g, n.name, x + 2, y + 2, Theme.alpha(Theme.TEXT, a), Ui.Font.MEDIUM);
		Ui.right(g, n.display(), x + w - 2, y + 2, Theme.alpha(Theme.COPPER_HI, a), Ui.Font.SEMIBOLD);
		float ty = y + 18, frac = (float) n.fraction();
		Ui.round(g, x + 2, ty, w - 4, 4, 2, Theme.alpha(0xFF2F3430, a));
		Ui.round(g, x + 2, ty, Math.max(4, (w - 4) * frac), 4, 2, Theme.alpha(Theme.COPPER, a));
		float kx = x + 2 + (w - 4) * frac;
		Ui.circle(g, kx, ty + 2, dragging == n ? 5.5f : 4.5f, Theme.alpha(0xFFFFFFFF, a));
		if (ty + 8 > top && ty - 4 < bottom) hit(x, ty - 6, x + w, ty + 10, e -> {
			dragging = n;
			dragX1 = x + 2;
			dragX2 = x + w - 2;
			updateSlider(clickX);
		});
		return y + 32;
	}

	private void updateSlider(double mouseX) {
		if (dragging == null) return;
		double t = Math.max(0, Math.min(1, (mouseX - dragX1) / (dragX2 - dragX1)));
		dragging.set(dragging.min + t * (dragging.max - dragging.min));
	}

	private static List<String> wrap(String text, Ui.Font font, int width) {
		List<String> lines = new ArrayList<>();
		StringBuilder line = new StringBuilder();
		for (String word : text.split(" ")) {
			String next = line.isEmpty() ? word : line + " " + word;
			if (Ui.width(next, font) > width && !line.isEmpty()) {
				lines.add(line.toString());
				line = new StringBuilder(word);
			} else {
				line = new StringBuilder(next);
			}
		}
		if (!line.isEmpty()) lines.add(line.toString());
		return lines;
	}

	// ------------------------------------------------------------------ theme page

	private void theme(GuiGraphicsExtractor g, int mouseX, int mouseY, float mx, float y, float mw, float h, float a) {
		float px = mx + 18, pw = mw - 36, cy = y + 52;
		Ui.text(g, "Accent", px, cy, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		cy += 14;
		Theme.Accent[] accents = Theme.Accent.values();
		int cols = 6;
		float sw = (pw - 6 * (cols - 1)) / cols;
		for (int i = 0; i < accents.length; i++) {
			Theme.Accent acc = accents[i];
			float sx = px + (i % cols) * (sw + 6), sy = cy + (i / cols) * 52;
			boolean selected = modules().ui.accent.get() == i;
			boolean over = Theme.inside(mouseX, mouseY, sx, sy, sx + sw, sy + 46);
			float act = anim("acc:" + i, selected, 14), hv = anim("accH:" + i, over, 16);
			Ui.round(g, sx, sy, sw, 46, 9, Theme.alpha(Theme.mix(0xFF1A0E12, 0xFF232724, hv), a), Theme.alpha(Theme.mix(0x14FFFFFF, acc.base, act), a), 1);
			Ui.circle(g, sx + sw / 2, sy + 17, 9, Theme.alpha(acc.base, a));
			Ui.round(g, sx + sw / 2 - 6, sy + 10, 12, 5, 2.5f, Theme.alpha(0x40FFFFFF, a));
			if (act > 0.05f) Ui.icon(g, "check", sx + sw / 2 - 6, sy + 11, 12, Theme.alpha(0xFFFFFFFF, act * a));
			Ui.centered(g, acc.label, sx + sw / 2, sy + 32, Theme.alpha(Theme.mix(Theme.MUTED, Theme.TEXT, act), a), Ui.Font.MEDIUM);
			final int index = i;
			hit(sx, sy, sx + sw, sy + 46, e -> {
				click();
				modules().ui.accent.set(index);
				modules().ui.applyAccent();
			});
		}
		cy += ((accents.length + cols - 1) / cols) * 52 + 10;
		cy = choiceRow(g, mouseX, mouseY, px, cy, pw, "Menu layout", "Switch between spacious cards and a compact grid.", modules().ui.layout, a);
		cy = optionRow(g, mouseX, mouseY, px, cy, pw, "Background blur", "Blur the game behind Lifea menus.", modules().ui.blur.get(), modules().ui.blur::toggle, a);
		cy = optionRow(g, mouseX, mouseY, px, cy, pw, "Menu animations", "Smooth transitions, hovers and scrolling.", modules().ui.animations.get(), modules().ui.animations::toggle, a);
	}

	private float choiceRow(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, String label, String hint, ChoiceSetting choice, float a) {
		boolean over = Theme.inside(mouseX, mouseY, x, y, x + w, y + 34);
		float hv = anim("choice:" + label, over, 16);
		Ui.round(g, x, y, w, 34, 9, Theme.alpha(Theme.mix(Theme.SURFACE, Theme.SURFACE_2, hv), a), Theme.alpha(0x20FFFFFF, a), 1);
		Ui.text(g, label, x + 12, y + 7, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		Ui.text(g, Ui.ellipsize(hint, Ui.Font.BODY, Math.round(w - 145)), x + 12, y + 20, Theme.alpha(Theme.MUTED, a), Ui.Font.BODY);
		String value = choice.display();
		float vw = Ui.width(value, Ui.Font.SEMIBOLD) + 20;
		float vx = x + w - 12 - vw;
		Ui.round(g, vx, y + 6, vw, 22, 7, Theme.alpha(Theme.SURFACE_3, a), Theme.alpha(Theme.COPPER, 0.45f * a), 1);
		Ui.centered(g, value, vx + vw / 2, y + 13, Theme.alpha(Theme.COPPER_HI, a), Ui.Font.SEMIBOLD);
		hit(x, y, x + w, y + 34, e -> {
			click();
			choice.cycle(e.button() == 1 ? -1 : 1);
		});
		return y + 40;
	}

	private float optionRow(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, String label, String hint, boolean value, Runnable toggle, float a) {
		boolean over = Theme.inside(mouseX, mouseY, x, y, x + w, y + 34);
		float hv = anim("opt:" + label, over, 16);
		Ui.round(g, x, y, w, 34, 9, Theme.alpha(Theme.mix(0xFF1A0E12, 0xFF212522, hv), a), Theme.alpha(0x12FFFFFF, a), 1);
		Ui.text(g, label, x + 12, y + 8, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		Ui.text(g, Ui.ellipsize(hint, Ui.Font.BODY, Math.round(w - 58)), x + 12, y + 20, Theme.alpha(Theme.MUTED, a), Ui.Font.BODY);
		Ui.toggle(g, x + w - 12 - 22, y + 11, anim("optT:" + label, value, 14), a);
		hit(x, y, x + w, y + 34, e -> {
			click();
			toggle.run();
		});
		return y + 40;
	}

	private float actionRow(GuiGraphicsExtractor g, int mouseX, int mouseY, float x, float y, float w, String label, String hint, String button, Runnable action, float a) {
		Ui.round(g, x, y, w, 34, 9, Theme.alpha(0xFF1A0E12, a), Theme.alpha(0x12FFFFFF, a), 1);
		Ui.text(g, label, x + 12, y + 8, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		float bw = Ui.width(button, Ui.Font.SEMIBOLD) + 18, bx = x + w - 10 - bw, by = y + 8;
		Ui.text(g, Ui.ellipsize(hint, Ui.Font.BODY, Math.round(w - 32 - bw)), x + 12, y + 20, Theme.alpha(Theme.MUTED, a), Ui.Font.BODY);
		boolean over = Theme.inside(mouseX, mouseY, bx, by, bx + bw, by + 18);
		Ui.glassButton(g, bx, by, bw, 18, anim("act:" + label, over, 16), a);
		Ui.centered(g, button, bx + bw / 2, by + 5, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		hit(bx, by, bx + bw, by + 18, e -> {
			click();
			action.run();
		});
		return y + 40;
	}

	// ------------------------------------------------------------------ settings page

	private void settings(GuiGraphicsExtractor g, int mouseX, int mouseY, float mx, float y, float mw, float h, float a) {
		float px = mx + 18, pw = mw - 36, cy = y + 52;
		var title = modules().titleScreen;
		cy = optionRow(g, mouseX, mouseY, px, cy, pw, "Lifea title screen", "Use the Lifea main menu instead of the vanilla one.", title.isEnabled(), title::toggle, a);
		cy = optionRow(g, mouseX, mouseY, px, cy, pw, "Animated background", "Parallax, glowing bulbs and embers on the title screen.", title.animate.get(), title.animate::toggle, a);
		cy = actionRow(g, mouseX, mouseY, px, cy, pw, "Keybinds", "Menu is Right Shift, zoom is C by default.", "Open", () -> minecraft.gui.setScreen(new KeyBindsScreen(this, minecraft.options)), a);
		cy = actionRow(g, mouseX, mouseY, px, cy, pw, "HUD layout", "Move every HUD module back to its default spot.", "Reset", () -> {
			for (HudModule m : modules().hud()) m.resetPosition();
			TuffConfig.save(modules());
		}, a);
		if (cy < y + h - 22) Ui.text(g, "Settings are saved to config/tuff/config.json", px, y + h - 17, Theme.alpha(Theme.FAINT, a), Ui.Font.BODY);
	}

	// ------------------------------------------------------------------ packs page

	private void loadPacks() {
		PackRepository repo = minecraft.getResourcePackRepository();
		repo.reload();
		enabledPacks = new ArrayList<>(repo.getSelectedIds());
		java.util.Collections.reverse(enabledPacks);
		availablePacks = new ArrayList<>();
		for (String id : repo.getAvailableIds()) if (!enabledPacks.contains(id)) availablePacks.add(id);
		packsDirty = false;
	}

	private void applyPacks() {
		PackRepository repo = minecraft.getResourcePackRepository();
		List<String> bottomFirst = new ArrayList<>(enabledPacks);
		java.util.Collections.reverse(bottomFirst);
		repo.setSelected(bottomFirst);
		minecraft.options.updateResourcePacks(repo);
		packsDirty = false;
	}

	private void packs(GuiGraphicsExtractor g, int mouseX, int mouseY, float mx, float y, float mw, float h, float a) {
		if (enabledPacks == null) loadPacks();
		PackRepository repo = minecraft.getResourcePackRepository();
		float px = mx + 18, pw = mw - 36;
		float colW = (pw - 10) / 2, top = y + 52, listTop = top + 16, bottom = y + h - 34;
		Ui.text(g, "Enabled", px, top, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		Ui.text(g, "Available", px + colW + 10, top, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		int rows = Math.max(enabledPacks.size(), availablePacks.size());
		maxScroll = Math.max(0, rows * 32 - (bottom - listTop));
		scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
		g.enableScissor(Math.round(px - 2), Math.round(listTop), Math.round(px + pw + 2), Math.round(bottom));
		for (int i = 0; i < enabledPacks.size(); i++) {
			packRow(g, mouseX, mouseY, repo, enabledPacks.get(i), px, listTop + i * 32 - scroll, colW, true, i, a, listTop, bottom);
		}
		for (int i = 0; i < availablePacks.size(); i++) {
			packRow(g, mouseX, mouseY, repo, availablePacks.get(i), px + colW + 10, listTop + i * 32 - scroll, colW, false, i, a, listTop, bottom);
		}
		g.disableScissor();

		float by = y + h - 28;
		String more = "Open pack folder & more";
		float mwBtn = Ui.width(more, Ui.Font.SEMIBOLD) + 20;
		boolean overMore = Theme.inside(mouseX, mouseY, px, by, px + mwBtn, by + 20);
		Ui.glassButton(g, px, by, mwBtn, 20, anim("packsMore", overMore, 16), a);
		Ui.centered(g, more, px + mwBtn / 2, by + 6, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		hit(px, by, px + mwBtn, by + 20, e -> {
			click();
			if (packsDirty) applyPacks();
			minecraft.gui.setScreen(new PackSelectionScreen(repo, r -> {
				minecraft.options.updateResourcePacks(r);
				enabledPacks = null;
				minecraft.gui.setScreen(this);
			}, minecraft.getResourcePackDirectory(), Component.literal("Resource packs")));
		});
		String apply = packsDirty ? "Apply changes" : "Up to date";
		float aw = Ui.width(apply, Ui.Font.SEMIBOLD) + 22, ax = px + pw - aw;
		boolean overApply = packsDirty && Theme.inside(mouseX, mouseY, ax, by, ax + aw, by + 20);
		if (packsDirty) Ui.accentButton(g, ax, by, aw, 20, anim("apply", overApply, 16), a);
		else Ui.glassButton(g, ax, by, aw, 20, 0, a * 0.6f);
		Ui.centered(g, apply, ax + aw / 2, by + 6, Theme.alpha(packsDirty ? Theme.INK : Theme.MUTED, a), Ui.Font.SEMIBOLD);
		if (packsDirty) hit(ax, by, ax + aw, by + 20, e -> {
			click();
			applyPacks();
		});
	}

	private void packRow(GuiGraphicsExtractor g, int mouseX, int mouseY, PackRepository repo, String id, float x, float y, float w, boolean enabled, int index, float a, float top, float bottom) {
		if (y + 28 < top || y > bottom) return;
		Pack pack = repo.getPack(id);
		String title = pack == null ? id : pack.getTitle().getString();
		String desc = pack == null ? "" : pack.getDescription().getString().replace('\n', ' ');
		boolean required = pack != null && pack.isRequired();
		boolean fixed = pack != null && pack.isFixedPosition();
		boolean over = Theme.inside(mouseX, mouseY, x, y, x + w, y + 28) && mouseY >= top && mouseY < bottom;
		float hv = anim("pack:" + enabled + id, over, 16);
		Ui.round(g, x, y, w, 28, 8, Theme.alpha(Theme.mix(0xFF1A0E12, 0xFF222623, hv), a), Theme.alpha(enabled ? Theme.alpha(Theme.COPPER, 0.35f) : 0x12FFFFFF, a), 1);
		float textW = w - 20 - (required ? Ui.width("Built-in", Ui.Font.BODY) + 8 : enabled ? 48 : 20);
		Ui.text(g, Ui.ellipsize(title, Ui.Font.SEMIBOLD, Math.round(textW)), x + 10, y + 6, Theme.alpha(Theme.TEXT, a), Ui.Font.SEMIBOLD);
		Ui.text(g, Ui.ellipsize(desc, Ui.Font.BODY, Math.round(textW)), x + 10, y + 17, Theme.alpha(Theme.MUTED, a), Ui.Font.BODY);
		if (required) {
			Ui.text(g, "Built-in", x + w - 10 - Ui.width("Built-in", Ui.Font.BODY), y + 11, Theme.alpha(Theme.FAINT, a), Ui.Font.BODY);
			return;
		}
		float bx = x + w - 22;
		iconButton(g, mouseX, mouseY, enabled ? "close" : "plus", bx, y + 7, a, top, bottom, () -> {
			if (enabled) {
				enabledPacks.remove(id);
				availablePacks.add(0, id);
			} else {
				availablePacks.remove(id);
				enabledPacks.add(0, id);
			}
			packsDirty = true;
		});
		if (enabled && !fixed) {
			if (index > 0) iconButton(g, mouseX, mouseY, "up", bx - 30, y + 7, a, top, bottom, () -> {
				java.util.Collections.swap(enabledPacks, index, index - 1);
				packsDirty = true;
			});
			if (index < enabledPacks.size() - 1) iconButton(g, mouseX, mouseY, "chevron", bx - 15, y + 7, a, top, bottom, () -> {
				java.util.Collections.swap(enabledPacks, index, index + 1);
				packsDirty = true;
			});
		}
	}

	private void iconButton(GuiGraphicsExtractor g, int mouseX, int mouseY, String icon, float x, float y, float a, float top, float bottom, Runnable action) {
		boolean over = Theme.inside(mouseX, mouseY, x - 2, y - 2, x + 14, y + 14) && mouseY >= top && mouseY < bottom;
		if (over) Ui.round(g, x - 2, y - 2, 16, 16, 4, Theme.alpha(0x22FFFFFF, a));
		Ui.icon(g, icon, x, y, 12, Theme.alpha(over ? Theme.COPPER_HI : Theme.MUTED, a));
		if (y + 14 > top && y < bottom) hit(x - 2, y - 2, x + 14, y + 14, e -> {
			click();
			action.run();
		});
	}

	// ------------------------------------------------------------------ input

	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		float z = zoom();
		double x = event.x() / z, y = event.y() / z;
		clickX = x;
		for (int i = hits.size() - 1; i >= 0; i--) {
			Hit h = hits.get(i);
			if (Theme.inside(x, y, h.x1(), h.y1(), h.x2(), h.y2())) {
				h.action().accept(event);
				return true;
			}
		}
		if (!Theme.inside(x, y, wx(), wy(), wx() + ww(), wy() + wh())) {
			onClose();
			return true;
		}
		return super.mouseClicked(event, doubleClick);
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
		if (dragging != null) {
			updateSlider(event.x() / zoom());
			return true;
		}
		return super.mouseDragged(event, dx, dy);
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent event) {
		dragging = null;
		return super.mouseReleased(event);
	}

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double scrollX, double scrollY) {
		if (drawer != null && mouseX / zoom() > drawerLeft) {
			drawerScroll = (float) Math.max(0, Math.min(drawerMax, drawerScroll - scrollY * 18));
		} else {
			scrollTarget = (float) Math.max(0, Math.min(maxScroll, scrollTarget - scrollY * 30));
		}
		return true;
	}

	@Override
	public boolean keyPressed(KeyEvent event) {
		if (event.isEscape()) {
			if (drawer != null) {
				drawer = null;
				return true;
			}
			if (!query.isEmpty()) {
				query = "";
				return true;
			}
		}
		if (page == Page.MODS && drawer == null && event.key() == InputConstants.KEY_BACKSPACE && !query.isEmpty()) {
			query = query.substring(0, query.length() - 1);
			return true;
		}
		return super.keyPressed(event);
	}

	@Override
	public boolean charTyped(CharacterEvent event) {
		if (page == Page.MODS && drawer == null && event.isAllowedChatCharacter() && query.length() < 32) {
			if (query.isEmpty() && event.codepointAsString().isBlank()) return true;
			query += event.codepointAsString();
			scrollTarget = 0;
			return true;
		}
		return super.charTyped(event);
	}

	@Override
	public void onClose() {
		TuffConfig.save(modules());
		minecraft.gui.setScreen(parent);
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
