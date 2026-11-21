package net.tuffclient;

import java.util.ArrayList;
import java.util.List;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.tuffclient.module.Module;
import net.tuffclient.module.hud.ArmorModule;
import net.tuffclient.module.hud.ClockModule;
import net.tuffclient.module.hud.CoordinatesModule;
import net.tuffclient.module.hud.CpsModule;
import net.tuffclient.module.hud.EffectsModule;
import net.tuffclient.module.hud.FpsModule;
import net.tuffclient.module.hud.HudModule;
import net.tuffclient.module.hud.KeystrokesModule;
import net.tuffclient.module.hud.MemoryModule;
import net.tuffclient.module.hud.PingModule;
import net.tuffclient.module.hud.ServerModule;
import net.tuffclient.module.hud.SpeedModule;
import net.tuffclient.module.util.CrosshairModule;
import net.tuffclient.module.util.FullbrightModule;
import net.tuffclient.module.util.HideScoreboardModule;
import net.tuffclient.module.util.InterfaceModule;
import net.tuffclient.module.util.TitleScreenModule;
import net.tuffclient.module.util.ToggleSprintModule;
import net.tuffclient.module.util.ZoomModule;

public final class ModuleManager {
	private final List<Module> modules = new ArrayList<>();
	private final List<HudModule> hud = new ArrayList<>();

	public final InterfaceModule ui = add(new InterfaceModule());
	public final TitleScreenModule titleScreen = add(new TitleScreenModule());
	public final ZoomModule zoom = add(new ZoomModule());
	public final FullbrightModule fullbright = add(new FullbrightModule());
	public final CrosshairModule crosshair = add(new CrosshairModule());
	public final HideScoreboardModule hideScoreboard = add(new HideScoreboardModule());

	public ModuleManager() {
		add(new ToggleSprintModule());
		add(new FpsModule());
		add(new CpsModule());
		add(new KeystrokesModule());
		add(new ArmorModule());
		add(new CoordinatesModule());
		add(new PingModule());
		add(new EffectsModule());
		add(new ClockModule());
		add(new ServerModule());
		add(new SpeedModule());
		add(new MemoryModule());
	}

	private <M extends Module> M add(M module) {
		modules.add(module);
		if (module instanceof HudModule h) hud.add(h);
		return module;
	}

	public List<Module> all() {
		return modules;
	}

	public List<HudModule> hud() {
		return hud;
	}

	/** Modules shown as cards in the menu. */
	public List<Module> visible() {
		return modules.stream().filter(m -> !m.hidden()).toList();
	}

	public void tick(Minecraft client) {
		for (Module m : modules) {
			if (m.isEnabled()) m.tick(client);
		}
	}

	/** Screen-space top-left of a HUD module, kept fully on screen. */
	public static int[] position(HudModule m, int screenW, int screenH) {
		double s = m.scale.get();
		int w = (int) Math.ceil(m.width() * s);
		int h = (int) Math.ceil(m.height() * s);
		int px = (int) Math.round(m.x * screenW);
		int py = (int) Math.round(m.y * screenH);
		px = Math.max(0, Math.min(screenW - w, px));
		py = Math.max(0, Math.min(screenH - h, py));
		return new int[] {px, py, w, h};
	}

	public static void renderModule(GuiGraphicsExtractor g, Font font, HudModule m, boolean preview) {
		int[] p = position(m, g.guiWidth(), g.guiHeight());
		float s = m.scale.get().floatValue();
		g.pose().pushMatrix();
		g.pose().translate(p[0], p[1]);
		g.pose().scale(s);
		m.render(g, font, preview);
		g.pose().popMatrix();
	}

	public void renderHud(GuiGraphicsExtractor g) {
		Minecraft client = Minecraft.getInstance();
		if (client.gui.hud.isHidden() || client.player == null) return;
		for (HudModule m : hud) {
			if (m.isEnabled()) renderModule(g, client.font, m, false);
		}
	}
}
