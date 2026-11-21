package gg.lifea.core.compat;

import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.client.texture.AbstractTexture;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;
import net.minecraft.world.World;

import java.util.function.BiConsumer;

/** 1.21.11 copy of the version layer (same signatures as mod/src/main/java/.../compat/Compat.java). */
public final class Compat {
    /** Shown as "Lifea" in Controls via the key.category.lifea.main translation. */
    private static final KeyBinding.Category CATEGORY = KeyBinding.Category.create(Identifier.of("lifea", "main"));

    private Compat() {}

    public static KeyBinding key(String id, int glfwKey) {
        return new KeyBinding(id, glfwKey, CATEGORY);
    }

    /** HudRenderCallback is deprecated since 1.21.6; the HUD element registry draws in the same place. */
    public static void registerHud(BiConsumer<DrawContext, RenderTickCounter> renderer) {
        HudElementRegistry.addLast(Identifier.of("lifea", "hud"), renderer::accept);
    }

    public static boolean isClient(World world) {
        return world.isClient();
    }

    public static AbstractTexture texture(String name, NativeImage image) {
        return new NativeImageBackedTexture(() -> name, image);
    }

    /** GUI matrices are a 2D Matrix3x2fStack since 1.21.6. */
    public static void pushHud(DrawContext ctx, float x, float y, float scale) {
        ctx.getMatrices().pushMatrix();
        ctx.getMatrices().translate(x, y);
        ctx.getMatrices().scale(scale, scale);
    }

    public static void popHud(DrawContext ctx) {
        ctx.getMatrices().popMatrix();
    }
}
