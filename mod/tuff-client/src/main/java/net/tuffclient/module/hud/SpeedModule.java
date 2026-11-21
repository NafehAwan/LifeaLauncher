package net.tuffclient.module.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;

/** Horizontal speed in blocks per second, smoothed over a few ticks. */
public final class SpeedModule extends TextHudModule {
	private double lastX;
	private double lastZ;
	private double speed;
	private boolean primed;

	public SpeedModule() {
		super("speed", "Speed", "How fast you're moving, in blocks per second.", "Speed", 0.006, 0.33, false);
	}

	@Override
	public void tick(Minecraft client) {
		LocalPlayer p = client.player;
		if (p == null) {
			primed = false;
			return;
		}
		if (primed) {
			double dx = p.getX() - lastX;
			double dz = p.getZ() - lastZ;
			double now = Math.sqrt(dx * dx + dz * dz) * 20;
			speed = speed * 0.6 + now * 0.4;
		}
		lastX = p.getX();
		lastZ = p.getZ();
		primed = true;
	}

	@Override
	protected String value(Minecraft client, boolean preview) {
		return String.format("%.2f m/s", speed);
	}
}
