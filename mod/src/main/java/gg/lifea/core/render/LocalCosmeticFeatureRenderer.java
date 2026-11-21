package gg.lifea.core.render;

import gg.lifea.core.net.Cosmetics;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.model.ElytraEntityModel;
import net.minecraft.client.render.entity.model.EntityModelLayers;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.DyedColorComponent;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.item.ModelTransformationMode;
import net.minecraft.util.Identifier;
import net.minecraft.client.render.VertexConsumerProvider;

/** Renders account-local accessories on the local player. No service/backend is involved. */
public final class LocalCosmeticFeatureRenderer extends FeatureRenderer<PlayerEntityRenderState, PlayerEntityModel> {
    private static final Identifier ELYTRA_TEXTURE = Identifier.ofVanilla("textures/entity/elytra.png");
    private final ElytraEntityModel wings;

    public LocalCosmeticFeatureRenderer(PlayerEntityRenderer renderer, EntityRendererFactory.Context context) {
        super(renderer);
        wings = new ElytraEntityModel(context.getPart(EntityModelLayers.ELYTRA));
    }

    @Override
    public void render(MatrixStack matrices, VertexConsumerProvider consumers, int light,
                       PlayerEntityRenderState state, float limbAngle, float limbDistance) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || state.id != client.player.getId()) return;

        String hat = Cosmetics.selected("hat");
        String bandana = Cosmetics.selected("bandana");
        if (!hat.isEmpty() || !bandana.isEmpty()) renderHeadwear(matrices, consumers, light, hat, bandana);

        String wingStyle = Cosmetics.selected("wings");
        if (!wingStyle.isEmpty()) {
            wings.setAngles(state);
            int tint = switch (wingStyle) {
                case "angel" -> 0xFFFFE8B5;
                case "butterfly" -> 0xFFD887FF;
                default -> 0xFFFF5A48;
            };
            renderModel(wings, ELYTRA_TEXTURE, matrices, consumers, light, state, tint);
        }
    }

    private void renderHeadwear(MatrixStack matrices, VertexConsumerProvider consumers, int light, String hat, String bandana) {
        ItemStack item;
        if (!bandana.isEmpty()) {
            item = new ItemStack(Items.LEATHER_HELMET);
            item.set(DataComponentTypes.DYED_COLOR, new DyedColorComponent(0xE11D2E, false));
        } else {
            item = new ItemStack(switch (hat) {
                case "crown" -> Items.GOLDEN_HELMET;
                case "halo" -> Items.END_ROD;
                default -> Items.CARVED_PUMPKIN;
            });
        }
        matrices.push();
        getContextModel().head.rotate(matrices);
        matrices.translate(0.0F, -0.25F, 0.0F);
        MinecraftClient.getInstance().getItemRenderer().renderItem(item, ModelTransformationMode.HEAD,
            light, OverlayTexture.DEFAULT_UV, matrices, consumers, MinecraftClient.getInstance().world, 0);
        matrices.pop();
    }
}
