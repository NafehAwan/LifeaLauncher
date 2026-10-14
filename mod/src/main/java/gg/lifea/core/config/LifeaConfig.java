package gg.lifea.core.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Persists module state, HUD layout and waypoints to config/lifea/config.json (per profile, because every Lifea
 * profile has its own game directory). Writes are atomic and debounced by the caller.
 */
public final class LifeaConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("lifea").resolve("config.json");
    private static JsonObject root = new JsonObject();
    private static boolean dirty;

    private LifeaConfig() {}

    public static void load() {
        try {
            if (Files.exists(FILE)) root = JsonParser.parseString(Files.readString(FILE, StandardCharsets.UTF_8)).getAsJsonObject();
        } catch (Exception e) {
            root = new JsonObject();
        }
    }

    public static JsonObject section(String name) {
        if (!root.has(name) || !root.get(name).isJsonObject()) root.add(name, new JsonObject());
        return root.getAsJsonObject(name);
    }

    public static JsonObject entry(String section, String id) {
        JsonObject s = section(section);
        if (!s.has(id) || !s.get(id).isJsonObject()) s.add(id, new JsonObject());
        return s.getAsJsonObject(id);
    }

    public static void markDirty() {
        dirty = true;
    }

    /** Called every few seconds from the client tick; only touches disk when something changed. */
    public static void flushIfDirty() {
        if (!dirty) return;
        dirty = false;
        save();
    }

    public static void save() {
        try {
            Files.createDirectories(FILE.getParent());
            Path tmp = FILE.resolveSibling("config.json.tmp");
            Files.writeString(tmp, GSON.toJson(root), StandardCharsets.UTF_8);
            Files.move(tmp, FILE, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException ignored) {
            // A failed write must never crash the game; the next change retries.
            dirty = true;
        }
    }
}
