package net.tuffclient.module.util;

import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.tuffclient.module.Category;
import net.tuffclient.module.Module;

/**
 * See in the dark. Applies a hidden, client-only night vision effect, so it
 * works with every shader and lighting engine and is never sent to servers.
 */
public final class FullbrightModule extends Module {
	public FullbrightModule() {
		super("fullbright", "Fullbright", "See clearly in caves and at night.", Category.VISUAL, false);
	}

	private static boolean isOurs(MobEffectInstance effect) {
		return effect != null && effect.isInfiniteDuration() && !effect.isVisible() && !effect.showIcon();
	}

	@Override
	public void tick(Minecraft client) {
		LocalPlayer player = client.player;
		if (player != null && !player.hasEffect(MobEffects.NIGHT_VISION)) {
			player.addEffect(new MobEffectInstance(MobEffects.NIGHT_VISION, MobEffectInstance.INFINITE_DURATION, 0, false, false, false));
		}
	}

	@Override
	protected void onDisable() {
		LocalPlayer player = Minecraft.getInstance().player;
		if (player != null && isOurs(player.getEffect(MobEffects.NIGHT_VISION))) player.removeEffect(MobEffects.NIGHT_VISION);
	}
}
