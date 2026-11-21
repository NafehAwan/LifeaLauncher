package net.tuffclient.gui;

import java.util.Random;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.resources.Identifier;
import net.tuffclient.TuffClient;

/**
 * The smooth Trial Chamber: painted high-resolution layers drawn at the
 * window's real pixel resolution, with slow drift and mouse parallax,
 * flickering bulb glows, a pulsing spawner and soft embers and dust.
 */
public final class TitleBackground {
	private static final int ART_W = 2112;
	private static final int ART_H = 1188;
	private static final float HORIZON = ART_H * 0.70f;
	private static final float[] BULBS_X = {0.13f * ART_W, 0.87f * ART_W};
	private static final float BULB_Y = HORIZON * 0.55f;

	private static Identifier tex(String name) {
		return Identifier.fromNamespaceAndPath(TuffClient.MOD_ID, "textures/gui/title/" + name + ".png");
	}

	private static final Identifier WALL = tex("wall");
	private static final Identifier PILLARS = tex("pillars");
	private static final Identifier FLOOR = tex("floor");
	private static final Identifier SPAWNER = tex("spawner");
	private static final Identifier GLOW = tex("glow");
	private static final Identifier PARTICLE = tex("particle");

	private static final int EMBERS = 40;
	private static final int DUST = 70;
	private final float[] ex = new float[EMBERS], ey = new float[EMBERS], evx = new float[EMBERS], evy = new float[EMBERS], elife = new float[EMBERS], emax = new float[EMBERS];
	private final float[] dx = new float[DUST], dy = new float[DUST], dvx = new float[DUST], dvy = new float[DUST], dlife = new float[DUST], dmax = new float[DUST], dsize = new float[DUST];
	private final Random random = new Random(1734);
	private float time = 8;
	private long last = System.nanoTime();
	private float mx;
	private float my;

	public TitleBackground() {
		for (int i = 0; i < DUST; i++) spawnDust(i, true);
	}

	/** w/h in GUI units; mouse in GUI units. */
	public void render(GuiGraphicsExtractor g, int w, int h, double mouseX, double mouseY, boolean animate) {
		long now = System.nanoTime();
		float dt = Math.min(0.05f, (now - last) / 1e9f);
		last = now;
		if (animate) step(dt);
		float tx = w > 0 ? (float) (mouseX / w * 2 - 1) : 0;
		float ty = h > 0 ? (float) (mouseY / h * 2 - 1) : 0;
		mx = Theme.approach(mx, animate ? tx : 0, dt, 2.5f);
		my = Theme.approach(my, animate ? ty : 0, dt, 2.5f);

		int gs = Ui.guiScale();
		float pw = w * gs, ph = h * gs;
		// cover the window with the 1920x1080 safe area of the art
		float k = Math.max(pw / 1920f, ph / 1080f);
		float drift = (float) Math.sin(time * 0.06) * 34 + mx * 26;
		float lift = my * 10;

		g.pose().pushMatrix();
		g.pose().scale(1f / gs, 1f / gs);
		g.fill(0, 0, Math.round(pw), Math.round(ph), 0xFF0B0C0B);
		layer(g, WALL, pw, ph, k, drift, lift, 0.25f);
		layer(g, FLOOR, pw, ph, k, drift, lift, 1.0f);
		layer(g, PILLARS, pw, ph, k, drift, lift, 0.6f);

		// bulb glows, flickering
		for (int i = 0; i < BULBS_X.length; i++) {
			float f = 0.78f + (float) (Math.sin(time * 3 + i * 4.1) * 0.07 + Math.sin(time * 11.3 + i * 2.3) * 0.05);
			if (Math.sin(time * 0.9 + i * 7) > 0.985) f -= 0.3f;
			float[] p = toScreen(BULBS_X[i], BULB_Y, pw, ph, k, drift, lift, 0.6f);
			glow(g, p[0], p[1], 420 * k, Theme.alpha(0xFFE11D2E, 0.48f * f));
			glow(g, p[0], p[1], 140 * k, Theme.alpha(0xFFFF5360, 0.58f * f));
		}

		// spawner with a breathing glow
		float bob = (float) Math.sin(time * 1.2) * 6;
		float[] sp = toScreen(ART_W / 2f, HORIZON - 30 + bob, pw, ph, k, drift, lift, 0.85f);
		float pulse = 0.8f + (float) (Math.sin(time * 2.1) * 0.12 + Math.sin(time * 7.3) * 0.06);
		float spawnSize = 380 * k;
		glow(g, sp[0], sp[1] - 30 * k, 520 * k, Theme.alpha(0xFFB31226, 0.34f * pulse));
		Ui.image(g, SPAWNER, sp[0] - spawnSize / 2, sp[1] - spawnSize * 0.56f, spawnSize, spawnSize, 520, 520, 0xFFFFFFFF);
		glow(g, sp[0], sp[1] - 36 * k, 160 * k, Theme.alpha(0xFFFF5360, 0.42f * pulse));

		// embers and dust
		for (int i = 0; i < EMBERS; i++) {
			if (elife[i] >= emax[i]) continue;
			float t = elife[i] / emax[i];
			float[] p = toScreen(ex[i], ey[i], pw, ph, k, drift, lift, 0.85f);
			float size = (6 + 6 * (1 - t)) * k;
			int color = Theme.mix(0xFFFFA1A8, 0xFFE11D2E, t);
			Ui.image(g, PARTICLE, p[0] - size / 2, p[1] - size / 2, size, size, 32, 32, Theme.alpha(color, (1 - t) * 0.95f));
		}
		for (int i = 0; i < DUST; i++) {
			float t = dlife[i] / dmax[i];
			float a = (float) Math.sin(t * Math.PI) * 0.35f;
			if (a < 0.02f) continue;
			float[] p = toScreen(dx[i], dy[i], pw, ph, k, drift, lift, 0.5f + dsize[i] * 0.4f);
			float size = (3 + dsize[i] * 5) * k;
			Ui.image(g, PARTICLE, p[0] - size / 2, p[1] - size / 2, size, size, 32, 32, Theme.alpha(0xFFEDE3CC, a));
		}

		// vignette
		int topH = Math.round(ph * 0.3f), botH = Math.round(ph * 0.35f);
		g.fillGradient(0, 0, Math.round(pw), topH, 0xB0080908, 0x00080908);
		g.fillGradient(0, Math.round(ph) - botH, Math.round(pw), Math.round(ph), 0x00080908, 0xD0080908);
		g.pose().popMatrix();
	}

	private static float[] toScreen(float ax, float ay, float pw, float ph, float k, float drift, float lift, float parallax) {
		float x = pw / 2 + (ax - ART_W / 2f) * k - drift * parallax * k;
		float y = ph / 2 + (ay - ART_H / 2f) * k - lift * parallax * k;
		return new float[] {x, y};
	}

	private static void layer(GuiGraphicsExtractor g, Identifier tex, float pw, float ph, float k, float drift, float lift, float parallax) {
		float x = pw / 2 - ART_W * k / 2 - drift * parallax * k;
		float y = ph / 2 - ART_H * k / 2 - lift * parallax * k;
		Ui.image(g, tex, x, y, ART_W * k, ART_H * k, ART_W, ART_H, 0xFFFFFFFF);
	}

	private static void glow(GuiGraphicsExtractor g, float cx, float cy, float radius, int argb) {
		Ui.image(g, GLOW, cx - radius, cy - radius, radius * 2, radius * 2, 256, 256, argb);
	}

	private void step(float dt) {
		time += dt;
		for (int i = 0; i < EMBERS; i++) {
			elife[i] += dt;
			if (elife[i] >= emax[i]) {
				if (random.nextFloat() < dt * 10) {
					ex[i] = ART_W / 2f + (random.nextFloat() - 0.5f) * 100;
					ey[i] = HORIZON - 90;
					evx[i] = (random.nextFloat() - 0.5f) * 24;
					evy[i] = -(40 + random.nextFloat() * 70);
					elife[i] = 0;
					emax[i] = 2 + random.nextFloat() * 2.5f;
				}
				continue;
			}
			ex[i] += (evx[i] + (float) Math.sin(time * 2 + i) * 18) * dt;
			ey[i] += evy[i] * dt;
		}
		for (int i = 0; i < DUST; i++) {
			dlife[i] += dt;
			dx[i] += (dvx[i] + (float) Math.sin(time * 0.4 + i) * 8) * dt;
			dy[i] += dvy[i] * dt;
			if (dlife[i] > dmax[i]) spawnDust(i, false);
		}
	}

	private void spawnDust(int i, boolean anywhere) {
		dx[i] = random.nextFloat() * ART_W;
		dy[i] = anywhere ? random.nextFloat() * ART_H : ART_H * (0.3f + random.nextFloat() * 0.7f);
		dvx[i] = (random.nextFloat() - 0.4f) * 14;
		dvy[i] = -(4 + random.nextFloat() * 12);
		dlife[i] = anywhere ? random.nextFloat() * 10 : 0;
		dmax[i] = 10 + random.nextFloat() * 14;
		dsize[i] = random.nextFloat();
	}
}
