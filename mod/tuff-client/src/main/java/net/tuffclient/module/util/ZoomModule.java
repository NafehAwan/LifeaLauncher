package net.tuffclient.module.util;

import net.minecraft.client.Minecraft;
import net.tuffclient.gui.Theme;
import net.tuffclient.module.Category;
import net.tuffclient.module.Module;
import net.tuffclient.setting.BoolSetting;
import net.tuffclient.setting.NumberSetting;

/** Hold the zoom key (C by default) to zoom in smoothly. */
public final class ZoomModule extends Module {
	public final NumberSetting factor = add(new NumberSetting("factor", "Zoom level", 4, 1.5, 12, 0.5));
	public final BoolSetting smooth = add(new BoolSetting("smooth", "Smooth zoom", true));
	public final BoolSetting cinematic = add(new BoolSetting("cinematic", "Cinematic camera while zoomed", true));
	private boolean held;
	private float current = 1;
	private boolean restoreSmooth;
	private long last = System.nanoTime();

	public ZoomModule() {
		super("zoom", "Zoom", "Hold C to zoom in. Set how far in its settings.", Category.UTILITY, true);
	}

	public void setHeld(boolean held) {
		Minecraft client = Minecraft.getInstance();
		if (held == this.held) return;
		this.held = held;
		if (held) {
			if (cinematic.get()) {
				restoreSmooth = client.options.smoothCamera;
				client.options.smoothCamera = true;
			}
		} else if (cinematic.get()) {
			client.options.smoothCamera = restoreSmooth;
		}
	}

	public boolean isZooming() {
		return isEnabled() && held;
	}

	/** Multiplier applied to the camera field of view. */
	public float fovMultiplier() {
		long now = System.nanoTime();
		float dt = Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		float target = isZooming() ? (float) (1 / factor.get()) : 1;
		current = smooth.get() ? Theme.approach(current, target, dt, 14) : target;
		return current;
	}
}
