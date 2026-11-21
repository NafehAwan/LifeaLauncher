package gg.lifea.core.render;

import gg.lifea.core.net.Cosmetics;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.ElytraEntityModel;
import net.minecraft.client.render.entity.model.EntityModelLayers;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.render.item.ItemRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.DyedColorComponent;
import net.minecraft.item.ItemDisplayContext;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.util.Identifier;

/**
 * 1.21.11 copy: account-local accessories on the local player, submitted through the render command queue that
 * replaced VertexConsumerProvider for entity features in 1.21.9. No backend involved.
 */
public final class LocalCosmeticFeatureRenderer extends FeatureRenderer<PlayerEntityRenderState, PlayerEntityModel> {
    private static final Identifier ELYTRA_TEXTURE = Identifier.ofVanilla("textures/entity/elytra.png");
    private final ElytraEntityModel wings;
    private final ItemRenderState headItem = new ItemRenderState();

    public LocalCosmeticFeatureRenderer(FeatureRendererContext<PlayerEntityRenderState, PlayerEntityModel> renderer, EntityRendererFactory.Context context) {
        super(renderer);
        wings = new ElytraEntityModel(context.getPart(EntityModelLayers.ELYTRA));
    }

    @Override
    public void render(MatrixStack matrices, OrderedRenderCommandQueue queue, int light, PlayerEntityRenderState state, float limbAngle, float limbDistance) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || state.id != client.player.getId() || state.invisible) return;

        String hat = Cosmetics.selected("hat");
        String bandana = Cosmetics.selected("bandana");
        if (!hat.isEmpty() || !bandana.isEmpty()) renderHeadwear(client, matrices, queue, light, state, hat, bandana);

        String wingStyle = Cosmetics.selected("wings");
        if (!wingStyle.isEmpty()) {
            wings.setAngles(state);
            int tint = switch (wingStyle) {
                case "angel" -> 0xFFFFE8B5;
                case "butterfly" -> 0xFFD887FF;
                default -> 0xFFFF5A48;
            };
            matrices.push();
            matrices.translate(0.0F, 0.0F, 0.125F);
            renderModel(wings, ELYTRA_TEXTURE, matrices, queue, light, state, tint, 1);
            matrices.pop();
        }
    }

    private void renderHeadwear(MinecraftClient client, MatrixStack matrices, OrderedRenderCommandQueue queue, int light,
                                PlayerEntityRenderState state, String hat, String bandana) {
        ItemStack item;
        if (!bandana.isEmpty()) {
            item = new ItemStack(Items.LEATHER_HELMET);
            item.set(DataComponentTypes.DYED_COLOR, new DyedColorComponent(0xE11D2E));
        } else {
            item = new ItemStack(switch (hat) {
                case "crown" -> Items.GOLDEN_HELMET;
                case "halo" -> Items.END_ROD;
                default -> Items.CARVED_PUMPKIN;
            });
        }
        client.getItemModelManager().clearAndUpdate(headItem, item, ItemDisplayContext.HEAD, client.world, null, 0);
        if (headItem.isEmpty()) return;
        matrices.push();
        PlayerEntityModel model = getContextModel();
        model.getRootPart().applyTransform(matrices);
        model.applyTransform(matrices);
        matrices.translate(0.0F, -0.25F, 0.0F);
        headItem.render(matrices, queue, light, OverlayTexture.DEFAULT_UV, state.outlineColor);
        matrices.pop();
    }
}
