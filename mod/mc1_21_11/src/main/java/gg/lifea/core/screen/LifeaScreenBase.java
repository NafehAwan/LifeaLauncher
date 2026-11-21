package gg.lifea.core.screen;

import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.input.CharInput;
import net.minecraft.client.input.KeyInput;
import net.minecraft.text.Text;

/**
 * 1.21.11 copy: maps the 1.21.9+ input records (Click, KeyInput, CharInput) onto the version-neutral hooks used by the
 * shared Lifea screens. Since 1.21.6 Screen draws renderBackground itself before render, so render only draws content
 * (drawing the background twice per frame would also trip the "blur once per frame" check).
 */
public abstract class LifeaScreenBase extends Screen {
    protected LifeaScreenBase(Text title) {
        super(title);
    }

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
        drawContent(ctx, mouseX, mouseY, delta);
    }

    @Override
    public boolean mouseClicked(Click click, boolean doubled) {
        return onClick(click.x(), click.y(), click.button()) || super.mouseClicked(click, doubled);
    }

    @Override
    public boolean mouseDragged(Click click, double dx, double dy) {
        return onDrag(click.x(), click.y(), click.button()) || super.mouseDragged(click, dx, dy);
    }

    @Override
    public boolean mouseReleased(Click click) {
        return onRelease(click.x(), click.y(), click.button()) || super.mouseReleased(click);
    }

    @Override
    public boolean keyPressed(KeyInput input) {
        return onKey(input.key(), input.scancode(), input.modifiers()) || super.keyPressed(input);
    }

    @Override
    public boolean charTyped(CharInput input) {
        return onChar(input.codepoint()) || super.charTyped(input);
    }
}
