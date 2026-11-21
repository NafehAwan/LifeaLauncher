package net.tuffclient.module.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;

public final class ServerModule extends TextHudModule {
	public ServerModule() {
		super("server", "Server address", "The server you're connected to.", "", 0.4, 0.01, false);
	}

	@Override
	protected String value(Minecraft client, boolean preview) {
		ServerData server = client.getCurrentServer();
		if (server == null) return preview ? "play.example.net" : client.hasSingleplayerServer() ? "Singleplayer" : null;
		return server.ip;
	}
}
