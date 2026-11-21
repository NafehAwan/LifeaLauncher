package net.tuffclient.module.util;

import net.tuffclient.module.Category;
import net.tuffclient.module.Module;
import net.tuffclient.setting.BoolSetting;

/** Replaces the vanilla title screen with the animated Tuff one. */
public final class TitleScreenModule extends Module {
	public final BoolSetting animate = add(new BoolSetting("animate", "Animated background", true));

	public TitleScreenModule() {
		super("title_screen", "Title Screen", "The animated Trial Chamber title screen. Turn off for the vanilla menu.", Category.VISUAL, true);
	}
}
