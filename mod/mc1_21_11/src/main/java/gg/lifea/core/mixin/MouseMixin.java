package gg.lifea.core.mixin;

import gg.lifea.core.LifeaCore;
import gg.lifea.core.feature.Trackers;
import net.minecraft.client.Mouse;
import net.minecraft.client.input.MouseInput;
import org.lwjgl.glfw.GLFW;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Mouse.class)
public abstract class MouseMixin {
    /** Counts clicks for the CPS/keystrokes HUD (read-only; never alters input). 1.21.9+ passes a MouseInput record. */
    @Inject(method = "onMouseButton", at = @At("HEAD"))
    private void lifea$countClick(long window, MouseInput input, int action, CallbackInfo ci) {
        if (action == GLFW.GLFW_PRESS) Trackers.click(input.button());
    }

    /** Scroll adjusts zoom level while zooming instead of changing the hotbar slot. */
    @Inject(method = "onMouseScroll", at = @At("HEAD"), cancellable = true)
    private void lifea$zoomScroll(long window, double horizontal, double vertical, CallbackInfo ci) {
        if (LifeaCore.ZOOM.onScroll(vertical)) ci.cancel();
    }
}
