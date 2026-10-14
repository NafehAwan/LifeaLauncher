package gg.lifea.core.screen;

/** Launcher colours, ARGB. Matches src/renderer/styles/tokens.css. */
public final class Theme {
    public static final int BG0 = 0xFF0B0607;
    public static final int BG2 = 0xFF181013;
    public static final int BG3 = 0xFF21151A;
    public static final int BG4 = 0xFF2B1B21;
    public static final int LINE = 0xFF3D252D;
    public static final int TEXT1 = 0xFFF6EEF0;
    public static final int TEXT2 = 0xFFC4AFB4;
    public static final int TEXT3 = 0xFF8A7076;
    public static final int ACCENT = 0xFFE11D2E;
    public static final int ACCENT_HI = 0xFFFF3B4A;
    public static final int ACCENT_LO = 0xFF9B0F1C;
    public static final int SUCCESS = 0xFF3DDC84;
    public static final int WARNING = 0xFFFFB020;
    public static final int HUD_BG = 0x8C0B0607;
    public static final int OVERLAY = 0xC80B0607;

    private Theme() {}

    public static int alpha(int argb, int alpha) {
        return (argb & 0x00FFFFFF) | (alpha << 24);
    }
}
