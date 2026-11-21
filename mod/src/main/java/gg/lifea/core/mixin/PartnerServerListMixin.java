package gg.lifea.core.mixin;

import net.minecraft.client.network.ServerInfo;
import net.minecraft.client.option.ServerList;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Keeps the built-in LifeaMC entry in Minecraft's saved multiplayer list. */
@Mixin(ServerList.class)
public abstract class PartnerServerListMixin {
    @Inject(method = "remove", at = @At("HEAD"), cancellable = true)
    private void lifea$protectPartner(ServerInfo server, CallbackInfo ci) {
        if (isLifeaPartner(server.address)) ci.cancel();
    }

    @Inject(method = "set", at = @At("HEAD"), cancellable = true)
    private void lifea$preventPartnerEdit(int index, ServerInfo replacement, CallbackInfo ci) {
        ServerInfo existing = ((ServerList) (Object) this).get(index);
        if (existing != null && isLifeaPartner(existing.address)) ci.cancel();
    }

    private static boolean isLifeaPartner(String address) {
        if (address == null) return false;
        String host = address.trim().toLowerCase().replaceFirst(":25565$", "");
        if (host.startsWith("play.")) host = host.substring(5);
        return host.equals("lifeamc.fun");
    }
}
