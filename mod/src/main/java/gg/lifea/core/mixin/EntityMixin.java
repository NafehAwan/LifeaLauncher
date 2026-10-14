package gg.lifea.core.mixin;

import gg.lifea.core.LifeaCore;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Entity.class)
public abstract class EntityMixin {
    /** While freelooking, mouse movement turns the camera, not the player. */
    @Inject(method = "changeLookDirection", at = @At("HEAD"), cancellable = true)
    private void lifea$freelook(double cursorDeltaX, double cursorDeltaY, CallbackInfo ci) {
        if ((Object) this == MinecraftClient.getInstance().player && LifeaCore.FREELOOK.looking()) {
            LifeaCore.FREELOOK.look(cursorDeltaX, cursorDeltaY);
            ci.cancel();
        }
    }
}
