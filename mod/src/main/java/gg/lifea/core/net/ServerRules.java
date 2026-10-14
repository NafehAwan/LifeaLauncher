package gg.lifea.core.net;

import gg.lifea.core.module.Modules;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

import java.util.HashSet;
import java.util.List;

/**
 * Lets servers switch Lifea modules off. A server plugin sends a `lifea:modules` payload with module ids to disable
 * (e.g. ["freelook", "fullbright"]); rules reset when you leave the server.
 */
public final class ServerRules {
    public record DisablePayload(List<String> modules) implements CustomPayload {
        public static final Id<DisablePayload> ID = new Id<>(Identifier.of("lifea", "modules"));
        public static final PacketCodec<RegistryByteBuf, DisablePayload> CODEC =
            PacketCodec.tuple(PacketCodecs.STRING.collect(PacketCodecs.toList()), DisablePayload::modules, DisablePayload::new);

        @Override
        public Id<? extends CustomPayload> getId() {
            return ID;
        }
    }

    private ServerRules() {}

    public static void register() {
        PayloadTypeRegistry.playS2C().register(DisablePayload.ID, DisablePayload.CODEC);
        ClientPlayNetworking.registerGlobalReceiver(DisablePayload.ID, (payload, context) ->
            context.client().execute(() -> Modules.setServerDisabled(new HashSet<>(payload.modules()))));
    }
}
