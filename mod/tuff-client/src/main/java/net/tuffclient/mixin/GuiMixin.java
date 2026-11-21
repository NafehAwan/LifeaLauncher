package net.tuffclient.mixin;

import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.tuffclient.TuffClient;
import net.tuffclient.gui.TuffTitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Swaps the vanilla title screen for the Tuff one when the module is on. */
@Mixin(Gui.class)
public abstract class GuiMixin {
	@ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
	private Screen tuff$replaceTitleScreen(Screen screen) {
		if (screen != null && screen.getClass() == TitleScreen.class
				&& TuffClient.modules() != null && TuffClient.modules().titleScreen.isEnabled()) {
			return new TuffTitleScreen();
		}
		return screen;
	}
}
