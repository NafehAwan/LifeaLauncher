package gg.lifea.core.feature;

import java.util.ArrayDeque;
import java.util.Arrays;

/** Click, frame-time and combo tracking. All allocation-free on the hot path. */
public final class Trackers {
    private Trackers() {}

    /* ---- CPS: timestamps of clicks in the last second (fed by MouseMixin) ---- */
    private static final ArrayDeque<Long> LEFT = new ArrayDeque<>();
    private static final ArrayDeque<Long> RIGHT = new ArrayDeque<>();

    public static void click(int button) {
        long now = System.currentTimeMillis();
        if (button == 0) LEFT.addLast(now);
        else if (button == 1) RIGHT.addLast(now);
    }

    private static int count(ArrayDeque<Long> q) {
        long cutoff = System.currentTimeMillis() - 1000;
        while (!q.isEmpty() && q.peekFirst() < cutoff) q.pollFirst();
        return q.size();
    }

    public static int leftCps() {
        return count(LEFT);
    }

    public static int rightCps() {
        return count(RIGHT);
    }

    /* ---- Frame times for the Boost page (avg FPS and 1% low) ---- */
    private static final int FRAMES = 4096;
    private static final float[] FRAME_MS = new float[FRAMES];
    private static int frameCount;
    private static int frameIdx;
    private static long lastFrame;

    public static void frame() {
        long now = System.nanoTime();
        if (lastFrame != 0) {
            float ms = (now - lastFrame) / 1_000_000f;
            if (ms < 1000f) {
                FRAME_MS[frameIdx] = ms;
                frameIdx = (frameIdx + 1) % FRAMES;
                if (frameCount < FRAMES) frameCount++;
            }
        }
        lastFrame = now;
    }

    /** {avgFps, onePercentLowFps, samples}, or null when there is not enough data. Resets the window. */
    public static float[] drainFpsStats() {
        if (frameCount < 120) return null;
        float[] copy = Arrays.copyOf(FRAME_MS, frameCount);
        float total = 0;
        for (float f : copy) total += f;
        Arrays.sort(copy);
        float p99 = copy[Math.min(copy.length - 1, (int) Math.floor(copy.length * 0.99))];
        float[] out = { 1000f * copy.length / total, 1000f / p99, copy.length };
        frameCount = 0;
        frameIdx = 0;
        return out;
    }

    /* ---- Combo: consecutive hits without taking damage ---- */
    private static int combo;
    private static long lastHit;
    private static int lastHurtTime;

    public static void hitEntity() {
        combo++;
        lastHit = System.currentTimeMillis();
    }

    public static void tickCombo(int hurtTime) {
        if (hurtTime > lastHurtTime) combo = 0;
        lastHurtTime = hurtTime;
        if (combo > 0 && System.currentTimeMillis() - lastHit > 3000) combo = 0;
    }

    public static int combo() {
        return combo;
    }
}
