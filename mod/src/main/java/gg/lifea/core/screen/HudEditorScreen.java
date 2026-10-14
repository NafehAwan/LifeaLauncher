package gg.lifea.core.screen;

import gg.lifea.core.config.LifeaConfig;
import gg.lifea.core.hud.HudModule;
import gg.lifea.core.module.Module;
import gg.lifea.core.module.Modules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;

/** Drag HUD elements, scroll to scale, snap to a 4 px grid and screen edges. Layout saves per profile. */
public class HudEditorScreen extends Screen {
    private static final int SNAP = 4;
    private final Screen parent;
    private HudModule dragging;
    private double grabX;
    private double grabY;

    public HudEditorScreen(Screen parent) {
        super(Text.literal("Edit HUD"));
        this.parent = parent;
    }

    private HudModule at(double mx, double my) {
        MinecraftClient c = MinecraftClient.getInstance();
        HudModule hit = null;
        for (Module m : Modules.all()) {
            if (!(m instanceof HudModule h) || !h.active()) continue;
            int x = h.screenX(c), y = h.screenY(c);
            int w = Math.round(Math.max(h.width, 20) * h.scale), hh = Math.round(Math.max(h.height, 10) * h.scale);
            if (mx >= x && mx < x + w && my >= y && my < y + hh) hit = h;
        }
        return hit;
    }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        ctx.fill(0, 0, width, height, 0x60000000);
        for (int x = 0; x < width; x += 32) ctx.fill(x, 0, x + 1, height, 0x14FFFFFF);
        for (int y = 0; y < height; y += 32) ctx.fill(0, y, width, y + 1, 0x14FFFFFF);
        ctx.fill(width / 2, 0, width / 2 + 1, height, 0x30E11D2E);
        ctx.fill(0, height / 2, width, height / 2 + 1, 0x30E11D2E);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        renderBackground(ctx, mouseX, mouseY, delta);
        MinecraftClient c = MinecraftClient.getInstance();
        HudModule hover = dragging != null ? dragging : at(mouseX, mouseY);
        for (Module m : Modules.all()) {
            if (!(m instanceof HudModule h) || !h.active()) continue;
            h.render(ctx, c, true);
            int x = h.screenX(c), y = h.screenY(c);
            int w = Math.round(Math.max(h.width, 20) * h.scale), hh = Math.round(Math.max(h.height, 10) * h.scale);
            int col = h == hover ? Theme.ACCENT_HI : 0x80FFFFFF;
            ctx.fill(x - 1, y - 1, x + w + 1, y, col);
            ctx.fill(x - 1, y + hh, x + w + 1, y + hh + 1, col);
            ctx.fill(x - 1, y, x, y + hh, col);
            ctx.fill(x + w, y, x + w + 1, y + hh, col);
        }
        String hint = "Drag to move · Scroll to resize · Right-click to reset · Esc to finish";
        int tw = textRenderer.getWidth(hint);
        ctx.fill(width / 2 - tw / 2 - 6, 6, width / 2 + tw / 2 + 6, 20, Theme.BG2);
        ctx.drawText(textRenderer, hint, width / 2 - tw / 2, 9, Theme.TEXT2, false);
        if (hover != null) ctx.drawText(textRenderer, hover.name + "  " + Math.round(hover.scale * 100) + "%", mouseX + 10, mouseY + 10, Theme.TEXT1, true);
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        HudModule h = at(mx, my);
        if (h == null) return super.mouseClicked(mx, my, button);
        if (button == 1) {
            h.resetLayout();
            return true;
        }
        MinecraftClient c = MinecraftClient.getInstance();
        dragging = h;
        grabX = mx - h.screenX(c);
        grabY = my - h.screenY(c);
        return true;
    }

    @Override
    public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging == null) return super.mouseDragged(mx, my, button, dx, dy);
        int w = Math.round(dragging.width * dragging.scale), h = Math.round(dragging.height * dragging.scale);
        int nx = MathHelper.clamp((int) Math.round((mx - grabX) / SNAP) * SNAP, 0, Math.max(0, width - w));
        int ny = MathHelper.clamp((int) Math.round((my - grabY) / SNAP) * SNAP, 0, Math.max(0, height - h));
        if (Math.abs(nx + w - width) < 6) nx = width - w;
        if (Math.abs(ny + h - height) < 6) ny = height - h;
        dragging.x = nx / (float) width;
        dragging.y = ny / (float) height;
        return true;
    }

    @Override
    public boolean mouseReleased(double mx, double my, int button) {
        if (dragging != null) {
            dragging.saveLayout();
            dragging = null;
            return true;
        }
        return super.mouseReleased(mx, my, button);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double horizontal, double vertical) {
        HudModule h = at(mx, my);
        if (h == null) return false;
        h.scale = MathHelper.clamp(Math.round((h.scale + (vertical > 0 ? 0.1f : -0.1f)) * 10f) / 10f, 0.5f, 2.5f);
        h.saveLayout();
        return true;
    }

    @Override
    public void close() {
        LifeaConfig.save();
        MinecraftClient.getInstance().setScreen(parent);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
