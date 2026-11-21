package gg.lifea.core.mixin;

import gg.lifea.core.net.Cosmetics;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.entity.player.PlayerSkinType;
import net.minecraft.entity.player.SkinTextures;
import net.minecraft.util.AssetInfo;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
    /** Lifea skins/capes (1.21.11): swap in the selected textures; vanilla renders them, the cape also as elytra. */
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void lifea$skinAndCape(CallbackInfoReturnable<SkinTextures> cir) {
        AbstractClientPlayerEntity player = (AbstractClientPlayerEntity) (Object) this;
        SkinTextures t = cir.getReturnValue();
        boolean localPlayer = player == MinecraftClient.getInstance().player;
        Identifier skin = localPlayer ? Cosmetics.localSkin() : null;
        Identifier cape = localPlayer ? Cosmetics.localCape() : Cosmetics.capeFor(player.getUuid());
        if (skin == null && cape == null) return;
        AssetInfo.TextureAsset capeAsset = cape == null ? null : new AssetInfo.TextureAssetInfo(cape, cape);
        cir.setReturnValue(new SkinTextures(
            skin == null ? t.body() : new AssetInfo.TextureAssetInfo(skin, skin),
            cape == null ? t.cape() : capeAsset,
            cape == null ? t.elytra() : capeAsset,
            skin == null ? t.model() : Cosmetics.localSkinSlim() ? PlayerSkinType.SLIM : PlayerSkinType.WIDE,
            skin == null && t.secure()
        ));
    }
}
