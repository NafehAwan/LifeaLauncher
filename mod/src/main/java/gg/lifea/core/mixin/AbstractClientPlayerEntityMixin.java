package gg.lifea.core.mixin;

import gg.lifea.core.net.Cosmetics;
import net.minecraft.client.network.AbstractClientPlayerEntity;
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
        Identifier cape = Cosmetics.capeFor(((AbstractClientPlayerEntity) (Object) this).getUuid());
        if (cape == null) return;
        SkinTextures t = cir.getReturnValue();
        cir.setReturnValue(new SkinTextures(t.texture(), t.textureUrl(), cape, cape, t.model(), t.secure()));
    }
}
