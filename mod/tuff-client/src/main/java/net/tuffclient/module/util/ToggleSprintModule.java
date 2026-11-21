package net.tuffclient.module.util;

import net.minecraft.client.Minecraft;
import net.tuffclient.module.Category;
import net.tuffclient.module.Module;

/** Keeps the sprint key held so you never have to double-tap or hold it. */
public final class ToggleSprintModule extends Module {
	public ToggleSprintModule() {
		super("toggle_sprint", "Toggle Sprint", "Always sprint while moving forward.", Category.UTILITY, false);
	}

	@Override
	public void tick(Minecraft client) {
		if (client.player != null && client.gui.screen() == null) client.options.keySprint.setDown(true);
	}

	@Override
	protected void onDisable() {
		Minecraft.getInstance().options.keySprint.setDown(false);
	}
}
