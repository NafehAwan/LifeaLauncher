package net.tuffclient.mixin;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Adds Lifea's translucent crimson glass tint after Minecraft draws its blurred menu backdrop. */
@Mixin(Screen.class)
public abstract class RedGlassMenuMixin {
	@Shadow public int width;
	@Shadow public int height;

	@Inject(method = "extractBackground", at = @At("TAIL"), require = 0)
	private void lifea$tintWorldMenus(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
		Object screen = this;
		if (screen instanceof SelectWorldScreen || screen instanceof JoinMultiplayerScreen) {
			graphics.fill(0, 0, width, height, 0x38E11D2E);
			graphics.fill(0, 0, width, height, 0x1A10080A);
		}
	}
}
