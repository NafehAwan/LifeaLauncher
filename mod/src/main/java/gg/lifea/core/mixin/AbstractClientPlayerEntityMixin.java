package gg.lifea.core.mixin;

import gg.lifea.core.net.Cosmetics;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    /** Lifea capes: swap in the equipped cape texture; vanilla renders it (and the elytra) as usual. */
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void lifea$cape(CallbackInfoReturnable<SkinTextures> cir) {
        AbstractClientPlayerEntity player = (AbstractClientPlayerEntity) (Object) this;
        SkinTextures t = cir.getReturnValue();
        boolean localPlayer = player == MinecraftClient.getInstance().player;
        Identifier skin = localPlayer ? Cosmetics.localSkin() : null;
        Identifier cape = localPlayer ? Cosmetics.localCape() : Cosmetics.capeFor(player.getUuid());
        if (skin == null && cape == null) return;
        cir.setReturnValue(new SkinTextures(
            skin == null ? t.texture() : skin,
            skin == null ? t.textureUrl() : "",
            cape == null ? t.capeTexture() : cape,
            cape == null ? t.elytraTexture() : cape,
            skin == null ? t.model() : Cosmetics.localSkinModel(),
            skin == null && t.secure()
        ));
    }
}
