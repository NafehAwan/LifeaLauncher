package net.tuffclient.module.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.PlayerInfo;

public final class PingModule extends TextHudModule {
	public PingModule() {
		super("ping", "Ping", "Your latency to the server.", "Ping", 0.006, 0.26, false);
	}

	@Override
	protected String value(Minecraft client, boolean preview) {
		if (client.player == null || client.getConnection() == null) return preview ? "42 ms" : null;
		PlayerInfo info = client.getConnection().getPlayerInfo(client.player.getUUID());
		if (info == null) return preview ? "42 ms" : null;
		return info.getLatency() + " ms";
	}
}
