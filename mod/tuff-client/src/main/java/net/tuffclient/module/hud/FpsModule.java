package net.tuffclient.module.hud;

import net.minecraft.client.Minecraft;

public final class FpsModule extends TextHudModule {
	public FpsModule() {
		super("fps", "FPS", "Frames per second.", "FPS", 0.006, 0.01, true);
	}

	@Override
	protected String value(Minecraft client, boolean preview) {
		return String.valueOf(client.getFps());
	}
}
