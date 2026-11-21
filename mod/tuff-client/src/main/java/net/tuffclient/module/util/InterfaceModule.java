package net.tuffclient.module.util;

import net.tuffclient.gui.Theme;
import net.tuffclient.module.Category;
import net.tuffclient.module.Module;
import net.tuffclient.setting.BoolSetting;
import net.tuffclient.setting.ChoiceSetting;

/** Look-and-feel preferences edited on the Theme page; not shown as a mod card. */
public final class InterfaceModule extends Module {
	public final ChoiceSetting accent;
	public final ChoiceSetting layout = add(new ChoiceSetting("layout", "Menu layout", 0, "Spacious", "Compact"));
	public final BoolSetting blur = add(new BoolSetting("blur", "Background blur", true));
	public final BoolSetting animations = add(new BoolSetting("animations", "Menu animations", true));

	public InterfaceModule() {
		super("interface", "Interface", "Theme and menu preferences.", Category.VISUAL, true);
		String[] names = new String[Theme.Accent.values().length];
		for (Theme.Accent a : Theme.Accent.values()) names[a.ordinal()] = a.label;
		accent = add(new ChoiceSetting("accent", "Accent", Theme.Accent.CRIMSON.ordinal(), names));
	}

	@Override
	public boolean hidden() {
		return true;
	}

	public void applyAccent() {
		Theme.apply(Theme.Accent.values()[accent.get()]);
	}
}
