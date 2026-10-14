package gg.lifea.core.mixin;

import gg.lifea.core.LifeaCore;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
    /** Hide the vanilla crosshair when the custom crosshair module draws its own. */
    @Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true)
    private void lifea$customCrosshair(DrawContext context, RenderTickCounter tickCounter, CallbackInfo ci) {
        if (LifeaCore.CROSSHAIR.active()) ci.cancel();
    }
}
