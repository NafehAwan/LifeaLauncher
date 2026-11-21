package net.tuffclient.module.util;

import net.tuffclient.module.Category;
import net.tuffclient.module.Module;

/** Hides the sidebar scoreboard (applied by the HUD element hook in TuffClient). */
public final class HideScoreboardModule extends Module {
	public HideScoreboardModule() {
		super("hide_scoreboard", "Hide Scoreboard", "Removes the sidebar scoreboard for a cleaner screen.", Category.VISUAL, false);
	}
}
