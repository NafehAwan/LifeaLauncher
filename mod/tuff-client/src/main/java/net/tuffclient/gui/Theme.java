package net.tuffclient.gui;

/**
 * Tuff palette (ARGB). The accent colours follow the accent picked on the
 * Theme page; everything else is the fixed tuff-stone base.
 */
public final class Theme {
	public enum Accent {
		COPPER("Copper", 0xFFD9824B, 0xFFF0A877, 0xFF9C5530),
		AMETHYST("Amethyst", 0xFFA67CF0, 0xFFC4A6F7, 0xFF6E4AB0),
		MINT("Mint", 0xFF4FC79A, 0xFF8FE3B0, 0xFF2E8B67),
		SKY("Sky", 0xFF5AA9F0, 0xFF8EC9FF, 0xFF2F6FAE),
		ROSE("Rose", 0xFFE8708A, 0xFFF4A3B5, 0xFFA8435A),
		GOLD("Gold", 0xFFE3B23C, 0xFFF2D06B, 0xFF9C7A22),
		CRIMSON("Crimson", 0xFFE11D2E, 0xFFFF5360, 0xFF9B0F1C);

		public final String label;
		public final int base;
		public final int hi;
		public final int lo;

		Accent(String label, int base, int hi, int lo) {
			this.label = label;
			this.base = base;
			this.hi = hi;
			this.lo = lo;
		}
	}

	public static final int BG = 0xFF10080A;
	public static final int SURFACE = 0xFF1A0E12;
	public static final int SURFACE_2 = 0xFF261218;
	public static final int SURFACE_3 = 0xFF351820;
	public static final int BORDER = 0xFF44232C;
	public static final int BORDER_STRONG = 0xFF66303B;
	public static final int TEXT = 0xFFF5ECEE;
	public static final int MUTED = 0xFFB3979D;
	public static final int FAINT = 0xFF765B62;
	public static final int INK = 0xFF20070B;
	public static final int ONLINE = 0xFF6FBF73;
	public static final int DANGER = 0xFFD9584B;
	/** Status bars on mod cards. */
	public static final int ENABLED = 0xFFB31226;
	public static final int ENABLED_HI = 0xFFE11D2E;
	public static final int DISABLED = 0xFF54232C;
	public static final int DISABLED_HI = 0xFF78303C;

	/** Accent colours; reassigned by {@link #apply}. */
	public static int COPPER = Accent.COPPER.base;
	public static int COPPER_HI = Accent.COPPER.hi;
	public static int COPPER_LO = Accent.COPPER.lo;

	private Theme() {
	}

	public static void apply(Accent accent) {
		COPPER = accent.base;
		COPPER_HI = accent.hi;
		COPPER_LO = accent.lo;
	}

	public static int alpha(int argb, float a) {
		int alpha = Math.round(((argb >>> 24) & 0xFF) * Math.max(0, Math.min(1, a)));
		return (alpha << 24) | (argb & 0xFFFFFF);
	}

	public static int mix(int a, int b, float t) {
		t = Math.max(0, Math.min(1, t));
		int r = (int) (((a >> 16) & 0xFF) + (((b >> 16) & 0xFF) - ((a >> 16) & 0xFF)) * t);
		int g = (int) (((a >> 8) & 0xFF) + (((b >> 8) & 0xFF) - ((a >> 8) & 0xFF)) * t);
		int bl = (int) ((a & 0xFF) + ((b & 0xFF) - (a & 0xFF)) * t);
		int al = (int) (((a >>> 24) & 0xFF) + (((b >>> 24) & 0xFF) - ((a >>> 24) & 0xFF)) * t);
		return (al << 24) | (r << 16) | (g << 8) | bl;
	}

	public static boolean inside(double mx, double my, double x1, double y1, double x2, double y2) {
		return mx >= x1 && mx < x2 && my >= y1 && my < y2;
	}

	/** Frame-rate independent easing towards a target. */
	public static float approach(float current, float target, float dt, float speed) {
		return current + (target - current) * (1 - (float) Math.exp(-speed * dt));
	}
}
