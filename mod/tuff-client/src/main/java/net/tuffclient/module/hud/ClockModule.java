package net.tuffclient.module.hud;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

import net.minecraft.client.Minecraft;
import net.tuffclient.setting.BoolSetting;

public final class ClockModule extends TextHudModule {
	private static final DateTimeFormatter H24 = DateTimeFormatter.ofPattern("HH:mm");
	private static final DateTimeFormatter H12 = DateTimeFormatter.ofPattern("h:mm a");
	private final BoolSetting twelveHour = add(new BoolSetting("12h", "12-hour clock", false));

	public ClockModule() {
		super("clock", "Clock", "The real-world time.", "", 0.94, 0.01, false);
	}

	@Override
	protected String value(Minecraft client, boolean preview) {
		return LocalTime.now().format(twelveHour.get() ? H12 : H24);
	}
}
