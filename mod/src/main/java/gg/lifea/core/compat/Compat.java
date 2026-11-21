package gg.lifea.core.compat;

import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.client.texture.AbstractTexture;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.InputUtil;
import net.minecraft.world.World;

import java.util.function.BiConsumer;

/**
 * The few Minecraft calls that differ between supported versions. This copy targets 1.21.4; mod/mc1_21_11 has its own
 * copy with the same signatures, so the rest of LifeaCore is shared unchanged.
 */
public final class Compat {
    private static final String CATEGORY = "category.lifea";

    private Compat() {}

    public static KeyBinding key(String id, int glfwKey) {
        return new KeyBinding(id, InputUtil.Type.KEYSYM, glfwKey, CATEGORY);
    }

    public static void registerHud(BiConsumer<DrawContext, RenderTickCounter> renderer) {
        HudRenderCallback.EVENT.register(renderer::accept);
    }

    public static boolean isClient(World world) {
        return world.isClient;
    }

    public static AbstractTexture texture(String name, NativeImage image) {
        return new NativeImageBackedTexture(image);
    }

    public static void pushHud(DrawContext ctx, float x, float y, float scale) {
        ctx.getMatrices().push();
        ctx.getMatrices().translate(x, y, 0);
        ctx.getMatrices().scale(scale, scale, 1f);
    }

    public static void popHud(DrawContext ctx) {
        ctx.getMatrices().pop();
    }
}
