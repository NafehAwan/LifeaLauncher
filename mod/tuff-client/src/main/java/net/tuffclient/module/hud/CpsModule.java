package net.tuffclient.module.hud;

import java.util.ArrayDeque;

import net.minecraft.client.Minecraft;

/** Clicks per second, sampled every frame so fast clicks between ticks still count. */
public final class CpsModule extends TextHudModule {
	private static final ArrayDeque<Long> LEFT = new ArrayDeque<>();
	private static final ArrayDeque<Long> RIGHT = new ArrayDeque<>();
	private static boolean wasLeft;
	private static boolean wasRight;

	public CpsModule() {
		super("cps", "CPS", "Left and right clicks per second.", "CPS", 0.006, 0.08, true);
	}

	/** Called from the HUD render every frame, even when this module is hidden, so Keystrokes can reuse it. */
	public static void sample(Minecraft client) {
		long now = System.currentTimeMillis();
		boolean left = client.options.keyAttack.isDown();
		boolean right = client.options.keyUse.isDown();
		if (left && !wasLeft) LEFT.addLast(now);
		if (right && !wasRight) RIGHT.addLast(now);
		wasLeft = left;
		wasRight = right;
		while (!LEFT.isEmpty() && now - LEFT.peekFirst() > 1000) LEFT.removeFirst();
		while (!RIGHT.isEmpty() && now - RIGHT.peekFirst() > 1000) RIGHT.removeFirst();
	}

	public static int left() {
		return LEFT.size();
	}

	public static int right() {
		return RIGHT.size();
	}

	@Override
	protected String value(Minecraft client, boolean preview) {
		return left() + " | " + right();
	}
}
