package net.tuffclient.mixin;

import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerList;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Keeps the built-in LifeaMC entry in Minecraft's saved multiplayer list. */
@Mixin(ServerList.class)
public abstract class PartnerServerListMixin {
	@Inject(method = "remove", at = @At("HEAD"), cancellable = true)
	private void tuff$protectPartner(ServerData server, CallbackInfo ci) {
		if (isLifeaPartner(server.ip)) ci.cancel();
	}

	@Inject(method = "replace", at = @At("HEAD"), cancellable = true)
	private void tuff$preventPartnerEdit(int index, ServerData replacement, CallbackInfo ci) {
		ServerData existing = ((ServerList) (Object) this).get(index);
		if (existing != null && isLifeaPartner(existing.ip)) ci.cancel();
	}

	private static boolean isLifeaPartner(String address) {
		if (address == null) return false;
		String host = address.trim().toLowerCase().replaceFirst(":25565$", "");
		if (host.startsWith("play.")) host = host.substring(5);
		return host.equals("lifeamc.fun");
	}
}
