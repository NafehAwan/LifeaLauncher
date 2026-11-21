package gg.lifea.core.screen;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

/**
 * Turns this Minecraft version's screen callbacks into version-neutral hooks, so Lifea screens are shared between
 * versions. 1.21.4 copy; mod/mc1_21_11 has the 1.21.9+ (Click/KeyInput/CharInput) copy.
 */
public abstract class LifeaScreenBase extends Screen {
    protected LifeaScreenBase(Text title) {
        super(title);
    }

    /** Full-screen backdrop, drawn once per frame before {@link #drawContent}. */
    protected abstract void drawBackdrop(DrawContext ctx);

    protected abstract void drawContent(DrawContext ctx, int mouseX, int mouseY, float delta);

    protected boolean onClick(double x, double y, int button) { return false; }
    protected boolean onDrag(double x, double y, int button) { return false; }
    protected boolean onRelease(double x, double y, int button) { return false; }
    protected boolean onKey(int key, int scancode, int modifiers) { return false; }
    protected boolean onChar(int codepoint) { return false; }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        drawBackdrop(ctx);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        renderBackground(ctx, mouseX, mouseY, delta);
        drawContent(ctx, mouseX, mouseY, delta);
    }

    @Override
    public boolean mouseClicked(double x, double y, int button) {
        return onClick(x, y, button) || super.mouseClicked(x, y, button);
    }

    @Override
    public boolean mouseDragged(double x, double y, int button, double dx, double dy) {
        return onDrag(x, y, button) || super.mouseDragged(x, y, button, dx, dy);
    }

    @Override
    public boolean mouseReleased(double x, double y, int button) {
        return onRelease(x, y, button) || super.mouseReleased(x, y, button);
    }

    @Override
    public boolean keyPressed(int key, int scancode, int modifiers) {
        return onKey(key, scancode, modifiers) || super.keyPressed(key, scancode, modifiers);
    }

    @Override
    public boolean charTyped(char chr, int modifiers) {
        return onChar(chr) || super.charTyped(chr, modifiers);
    }
}
