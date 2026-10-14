package gg.lifea.core.mixin;

import gg.lifea.core.LifeaCore;
import net.minecraft.client.render.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(Camera.class)
public abstract class CameraMixin {
    @Shadow
    protected abstract void setRotation(float yaw, float pitch);

    /**
     * Freelook: replace the rotation the camera copies from the player with the free-look angles. Vanilla then places
     * the third-person camera from that rotation, so collision with walls still works.
     */
    @Redirect(method = "update", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/Camera;setRotation(FF)V", ordinal = 0))
    private void lifea$freelookRotation(Camera camera, float yaw, float pitch) {
        if (LifeaCore.FREELOOK.looking()) setRotation(LifeaCore.FREELOOK.yaw(), LifeaCore.FREELOOK.pitch());
        else setRotation(yaw, pitch);
    }
}
