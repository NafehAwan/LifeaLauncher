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

    /*
     * Freelook: replace the rotation the camera copies from the player. Since 1.21.2 Camera.update copies it in two places
     * (riding an experimental minecart = ordinal 0, everything else = ordinal 1), so both are redirected. Redirecting
     * only ordinal 0 (as before) made freelook work only in minecarts. The third call (front view,
     * yaw + 180) is left alone so F5 front view keeps working.
     */
    @Redirect(method = "update", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/Camera;setRotation(FF)V", ordinal = 0))
    private void lifea$freelookMinecart(Camera camera, float yaw, float pitch) {
        apply(yaw, pitch);
    }

    @Redirect(method = "update", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/Camera;setRotation(FF)V", ordinal = 1))
    private void lifea$freelook(Camera camera, float yaw, float pitch) {
        apply(yaw, pitch);
    }

    private void apply(float yaw, float pitch) {
        if (LifeaCore.FREELOOK.looking()) setRotation(LifeaCore.FREELOOK.yaw(), LifeaCore.FREELOOK.pitch());
        else setRotation(yaw, pitch);
    }
}
