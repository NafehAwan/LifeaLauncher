package gg.lifea.core.hud;

import com.google.gson.JsonObject;
import gg.lifea.core.config.LifeaConfig;
import gg.lifea.core.module.Module;
import gg.lifea.core.screen.Theme;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.List;

/**
 * A draggable HUD element. Position is stored as a fraction of the scaled screen so layouts survive resolution and
 * GUI-scale changes. Default rendering is a compact dark box with one or more lines; subclasses can draw anything.
 */
public abstract class HudModule extends Module {
    private final float defaultX;
    private final float defaultY;
    public float x;
    public float y;
    public float scale = 1f;
    /** Size of the last render in unscaled HUD pixels, used by the editor for hit-testing. */
    public int width = 40;
    public int height = 12;

    protected HudModule(String id, String name, String description, boolean defaultEnabled, float defaultX, float defaultY) {
        super(id, name, description, Category.HUD, defaultEnabled);
        this.defaultX = defaultX;
        this.defaultY = defaultY;
        this.x = defaultX;
        this.y = defaultY;
    }

    @Override
    public void load() {
        super.load();
        JsonObject h = LifeaConfig.entry("hud", id);
        if (h.has("x")) x = h.get("x").getAsFloat();
        if (h.has("y")) y = h.get("y").getAsFloat();
        if (h.has("scale")) scale = h.get("scale").getAsFloat();
    }

    public void saveLayout() {
        JsonObject h = LifeaConfig.entry("hud", id);
        h.addProperty("x", x);
        h.addProperty("y", y);
        h.addProperty("scale", scale);
        LifeaConfig.markDirty();
    }

    public void resetLayout() {
        x = defaultX;
        y = defaultY;
        scale = 1f;
        saveLayout();
    }

    /** Lines for the default box renderer. Return null/empty to draw nothing. */
    protected List<String> lines(MinecraftClient client) {
        return null;
    }

    /** Draw at (0,0) in element space; set width/height. Default: a box with lines. */
    protected void draw(DrawContext ctx, MinecraftClient client, boolean preview) {
        List<String> ls = lines(client);
        if ((ls == null || ls.isEmpty()) && preview) ls = List.of(name);
        if (ls == null || ls.isEmpty()) {
            width = 0;
            height = 0;
            return;
        }
        TextRenderer tr = client.textRenderer;
        int w = 0;
        for (String l : ls) w = Math.max(w, tr.getWidth(l));
        width = w + 8;
        height = ls.size() * 10 + 5;
        ctx.fill(0, 0, width, height, Theme.HUD_BG);
        ctx.fill(0, 0, 2, height, Theme.ACCENT);
        int yy = 3;
        for (String l : ls) {
            ctx.drawText(tr, l, 5, yy, Theme.TEXT1, true);
            yy += 10;
        }
    }

    public final void render(DrawContext ctx, MinecraftClient client, boolean preview) {
        int sw = client.getWindow().getScaledWidth();
        int sh = client.getWindow().getScaledHeight();
        int px = Math.round(x * sw);
        int py = Math.round(y * sh);
        ctx.getMatrices().push();
        ctx.getMatrices().translate(px, py, 0);
        ctx.getMatrices().scale(scale, scale, 1f);
        draw(ctx, client, preview);
        ctx.getMatrices().pop();
    }

    public int screenX(MinecraftClient c) {
        return Math.round(x * c.getWindow().getScaledWidth());
    }

    public int screenY(MinecraftClient c) {
        return Math.round(y * c.getWindow().getScaledHeight());
    }
}
