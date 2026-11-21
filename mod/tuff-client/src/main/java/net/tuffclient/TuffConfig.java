package net.tuffclient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import net.tuffclient.module.Module;

/** Persists module state to config/tuff/config.json. */
public final class TuffConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("tuff").resolve("config.json");

	private TuffConfig() {
	}

	public static void load(ModuleManager modules) {
		if (!Files.isRegularFile(FILE)) return;
		try {
			JsonElement root = JsonParser.parseString(Files.readString(FILE, StandardCharsets.UTF_8));
			if (!root.isJsonObject()) return;
			JsonObject all = root.getAsJsonObject();
			for (Module m : modules.all()) {
				if (all.has(m.id) && all.get(m.id).isJsonObject()) m.load(all.getAsJsonObject(m.id));
			}
		} catch (IOException | RuntimeException e) {
			TuffClient.LOGGER.warn("Couldn't read Tuff config, using defaults", e);
		}
	}

	public static void save(ModuleManager modules) {
		JsonObject all = new JsonObject();
		for (Module m : modules.all()) all.add(m.id, m.save());
		try {
			Files.createDirectories(FILE.getParent());
			Path tmp = FILE.resolveSibling("config.json.tmp");
			Files.writeString(tmp, GSON.toJson(all), StandardCharsets.UTF_8);
			Files.move(tmp, FILE, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
		} catch (IOException e) {
			TuffClient.LOGGER.warn("Couldn't save Tuff config", e);
		}
	}
}
