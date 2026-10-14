package gg.lifea.core.screen;

import gg.lifea.core.config.LifeaConfig;
import gg.lifea.core.module.Module;
import gg.lifea.core.module.Modules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Right-Shift menu: a searchable grid of modules in the launcher's blood-red style. */
public class LifeaMenuScreen extends Screen {
    private static final String[] TABS = { "All", "HUD", "Gameplay", "Visual" };
    private static final int CARD_W = 150;
    private static final int CARD_H = 46;
    private static final int GAP = 6;
    private int tab;
    private String query = "";
    private int scroll;
    private final List<int[]> cardRects = new ArrayList<>();
    private final List<Module> cardModules = new ArrayList<>();

    public LifeaMenuScreen() {
        super(Text.literal("Lifea"));
    }

    private int panelW() { return Math.min(width - 40, 3 * CARD_W + 2 * GAP + 24); }
    private int panelH() { return Math.min(height - 40, 300); }
    private int panelX() { return (width - panelW()) / 2; }
    private int panelY() { return (height - panelH()) / 2; }

    private List<Module> visible() {
        List<Module> out = new ArrayList<>();
        String q = query.toLowerCase(Locale.ROOT);
        for (Module m : Modules.all()) {
            if (tab == 1 && m.category != Module.Category.HUD) continue;
            if (tab == 2 && m.category != Module.Category.GAMEPLAY) continue;
            if (tab == 3 && m.category != Module.Category.VISUAL) continue;
            if (!q.isEmpty() && !m.name.toLowerCase(Locale.ROOT).contains(q)) continue;
            out.add(m);
        }
        return out;
    }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        ctx.fill(0, 0, width, height, Theme.OVERLAY);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        renderBackground(ctx, mouseX, mouseY, delta);
        int px = panelX(), py = panelY(), pw = panelW(), ph = panelH();
        ctx.fill(px, py, px + pw, py + ph, Theme.BG2);
        ctx.fill(px, py, px + pw, py + 2, Theme.ACCENT);
        ctx.drawText(textRenderer, "LIFEA", px + 12, py + 12, Theme.TEXT1, true);
        ctx.drawText(textRenderer, "Right-click a module for options", px + 52, py + 12, Theme.TEXT3, false);

        // Edit HUD button
        int bx = px + pw - 82, by = py + 8;
        boolean hoverBtn = mouseX >= bx && mouseX < bx + 72 && mouseY >= by && mouseY < by + 16;
        ctx.fill(bx, by, bx + 72, by + 16, hoverBtn ? Theme.ACCENT_HI : Theme.ACCENT);
        ctx.drawCenteredTextWithShadow(textRenderer, Text.literal("Edit HUD"), bx + 36, by + 4, 0xFFFFFFFF);

        // Tabs + search
        int tx = px + 12;
        for (int i = 0; i < TABS.length; i++) {
            int w = textRenderer.getWidth(TABS[i]) + 12;
            ctx.fill(tx, py + 30, tx + w, py + 44, i == tab ? Theme.BG4 : Theme.BG3);
            ctx.drawText(textRenderer, TABS[i], tx + 6, py + 33, i == tab ? Theme.TEXT1 : Theme.TEXT3, false);
            tx += w + 4;
        }
        String search = query.isEmpty() ? "Type to search…" : query + "_";
        ctx.fill(px + pw - 132, py + 30, px + pw - 12, py + 44, Theme.BG0);
        ctx.drawText(textRenderer, search, px + pw - 128, py + 33, query.isEmpty() ? Theme.TEXT3 : Theme.TEXT1, false);

        // Cards
        cardRects.clear();
        cardModules.clear();
        int gridX = px + 12, gridY = py + 52, gridH = ph - 60;
        int cols = Math.max(1, (pw - 24 + GAP) / (CARD_W + GAP));
        ctx.enableScissor(gridX, gridY, px + pw - 12, gridY + gridH);
        List<Module> mods = visible();
        for (int i = 0; i < mods.size(); i++) {
            Module m = mods.get(i);
            int cx = gridX + (i % cols) * (CARD_W + GAP);
            int cy = gridY + (i / cols) * (CARD_H + GAP) - scroll;
            if (cy + CARD_H < gridY || cy > gridY + gridH) continue;
            boolean hover = mouseX >= cx && mouseX < cx + CARD_W && mouseY >= cy && mouseY < cy + CARD_H && mouseY >= gridY && mouseY < gridY + gridH;
            boolean blocked = Modules.serverDisabled(m.id);
            ctx.fill(cx, cy, cx + CARD_W, cy + CARD_H, hover ? Theme.BG4 : Theme.BG3);
            ctx.fill(cx, cy, cx + 2, cy + CARD_H, m.isEnabled() && !blocked ? Theme.ACCENT : Theme.LINE);
            ctx.drawText(textRenderer, m.name, cx + 8, cy + 6, Theme.TEXT1, false);
            String sub = blocked ? "Disabled by this server" : m.optionLabel() != null ? m.optionLabel() : m.category.name().charAt(0) + m.category.name().substring(1).toLowerCase(Locale.ROOT);
            ctx.drawText(textRenderer, textRenderer.trimToWidth(sub, CARD_W - 50), cx + 8, cy + 18, blocked ? Theme.WARNING : Theme.TEXT3, false);
            // toggle
            int sx = cx + CARD_W - 30, sy = cy + 6;
            ctx.fill(sx, sy, sx + 22, sy + 10, m.isEnabled() ? Theme.ACCENT : Theme.BG0);
            ctx.fill(m.isEnabled() ? sx + 13 : sx + 1, sy + 1, m.isEnabled() ? sx + 21 : sx + 9, sy + 9, 0xFFFFFFFF);
            if (hover) ctx.drawText(textRenderer, textRenderer.trimToWidth(m.description, CARD_W - 16), cx + 8, cy + 31, Theme.TEXT2, false);
            cardRects.add(new int[] { cx, cy, CARD_W, CARD_H });
            cardModules.add(m);
        }
        ctx.disableScissor();
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        int px = panelX(), py = panelY(), pw = panelW();
        if (mx >= px + pw - 82 && mx < px + pw - 10 && my >= py + 8 && my < py + 24) {
            MinecraftClient.getInstance().setScreen(new HudEditorScreen(this));
            return true;
        }
        int tx = px + 12;
        for (int i = 0; i < TABS.length; i++) {
            int w = textRenderer.getWidth(TABS[i]) + 12;
            if (mx >= tx && mx < tx + w && my >= py + 30 && my < py + 44) {
                tab = i;
                scroll = 0;
                return true;
            }
            tx += w + 4;
        }
        for (int i = 0; i < cardRects.size(); i++) {
            int[] r = cardRects.get(i);
            if (mx >= r[0] && mx < r[0] + r[2] && my >= r[1] && my < r[1] + r[3] && my >= py + 52) {
                Module m = cardModules.get(i);
                if (button == 1) m.cycleOption();
                else m.toggle();
                return true;
            }
        }
        return super.mouseClicked(mx, my, button);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double horizontal, double vertical) {
        scroll = Math.max(0, scroll - (int) (vertical * 20));
        return true;
    }

    @Override
    public boolean charTyped(char chr, int modifiers) {
        if (Character.isLetterOrDigit(chr) || chr == ' ') {
            query += chr;
            scroll = 0;
            return true;
        }
        return super.charTyped(chr, modifiers);
    }

    @Override
    public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (keyCode == GLFW.GLFW_KEY_BACKSPACE && !query.isEmpty()) {
            query = query.substring(0, query.length() - 1);
            return true;
        }
        if (keyCode == GLFW.GLFW_KEY_RIGHT_SHIFT) {
            close();
            return true;
        }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }

    @Override
    public void removed() {
        LifeaConfig.save();
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
