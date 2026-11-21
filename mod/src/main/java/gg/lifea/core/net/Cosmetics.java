package gg.lifea.core.net;

import gg.lifea.core.compat.Compat;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lifea capes for every Lifea player in view. Players without Lifea see vanilla capes, exactly like other clients.
 * Lookups are batched (≤100 UUIDs), cached for 5 minutes, and textures are size-checked before upload to the GPU.
 */
public final class Cosmetics {
    private static final Logger LOGGER = LoggerFactory.getLogger("LifeaCore/Cosmetics");
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private static final long TTL = 5 * 60_000L;
    private static final int MAX_TEXTURE_BYTES = 256 * 1024;

    private static volatile String backend = "";
    private static final Map<UUID, Long> checkedAt = new ConcurrentHashMap<>();
    private static final Map<UUID, String> capeOf = new ConcurrentHashMap<>();
    private static final Map<String, Identifier> textures = new ConcurrentHashMap<>();
    private static final Set<String> loading = ConcurrentHashMap.newKeySet();
    private static boolean inFlight;
    private static int tickCounter;
    private static volatile boolean localCapeLoaded;
    private static volatile Identifier localCapeTexture;
    private static volatile boolean localSkinLoaded;
    private static volatile Identifier localSkinTexture;
    private static volatile String localCapePath = System.getProperty("lifea.cape.path", "");
    private static volatile String localSkinPath = System.getProperty("lifea.skin.path", "");
    private static volatile boolean localSkinSlim = "slim".equalsIgnoreCase(System.getProperty("lifea.skin.model", ""));
    private static volatile Map<String, String> localSelections = new ConcurrentHashMap<>();
    private static volatile long syncCheckedAt;
    private static volatile long syncModified = -1L;
    private static volatile boolean localSyncLoaded;

    private Cosmetics() {}

    public static void configure(String url) {
        String u = url == null ? "" : url.replaceAll("/+$", "");
        backend = u.startsWith("http://") || u.startsWith("https://") ? u : "";
        checkedAt.clear();
    }

    /** Cape texture for a player, or null to keep vanilla. Called from AbstractClientPlayerEntityMixin. */
    public static Identifier capeFor(UUID uuid) {
        String id = capeOf.get(uuid);
        return id == null ? null : textures.get(id);
    }

    /** Loads the selected account's local cape once; never downloads or exposes the file. */
    public static Identifier localCape() {
        if (localCapeLoaded) return localCapeTexture;
        synchronized (Cosmetics.class) {
            if (localCapeLoaded) return localCapeTexture;
            localCapeLoaded = true;
            String configured = localCapePath;
            if (configured.isBlank()) return null;
            try {
                Path path = Path.of(configured);
                if (!Files.isRegularFile(path) || Files.size(path) > MAX_TEXTURE_BYTES) return null;
                NativeImage image = NativeImage.read(Files.readAllBytes(path));
                if (!((image.getWidth() == 64 && image.getHeight() == 32) || (image.getWidth() == 22 && image.getHeight() == 17))) {
                    image.close();
                    return null;
                }
                Identifier texture = Identifier.of("lifea", "cosmetics/local_cape_" + Math.max(0L, syncModified));
                MinecraftClient.getInstance().getTextureManager().registerTexture(texture, Compat.texture(texture.toString(), image));
                localCapeTexture = texture;
            } catch (Exception e) {
                // A missing or invalid local cosmetic must not prevent the player skin from rendering.
                LOGGER.warn("Could not load the selected local cape", e);
            }
            return localCapeTexture;
        }
    }

    /** Loads the selected account's local skin once. Null keeps Minecraft's normal skin. */
    public static Identifier localSkin() {
        if (localSkinLoaded) return localSkinTexture;
        synchronized (Cosmetics.class) {
            if (localSkinLoaded) return localSkinTexture;
            localSkinLoaded = true;
            String configured = localSkinPath;
            if (configured.isBlank()) return null;
            try {
                Path path = Path.of(configured);
                if (!Files.isRegularFile(path) || Files.size(path) > MAX_TEXTURE_BYTES) return null;
                NativeImage image = NativeImage.read(Files.readAllBytes(path));
                if (!((image.getWidth() == 64 && (image.getHeight() == 64 || image.getHeight() == 32))
                    || (image.getWidth() == 128 && image.getHeight() == 128))) {
                    image.close();
                    LOGGER.warn("Selected local skin must be 64x64, legacy 64x32, or 128x128 PNG");
                    return null;
                }
                if (image.getWidth() != 64 || image.getHeight() != 64) {
                    NativeImage normalized = new NativeImage(64, 64, true);
                    int[] sourcePixels = image.copyPixelsArgb();
                    int sourceHeight = image.getHeight();
                    for (int y = 0; y < 64; y++) {
                        for (int x = 0; x < 64; x++) {
                            if (sourceHeight == 32 && y >= 32) continue;
                            int sourceX = x * image.getWidth() / 64;
                            int sourceY = y * sourceHeight / 64;
                            normalized.setColorArgb(x, y, sourcePixels[sourceY * image.getWidth() + sourceX]);
                        }
                    }
                    image.close();
                    image = normalized;
                }
                Identifier texture = Identifier.of("lifea", "skins/local_" + Math.max(0L, syncModified));
                MinecraftClient.getInstance().getTextureManager().registerTexture(texture, Compat.texture(texture.toString(), image));
                localSkinTexture = texture;
            } catch (Exception e) {
                LOGGER.warn("Could not load the selected local skin", e);
            }
            return localSkinTexture;
        }
    }

    /** True when the selected local skin uses the slim (Alex) arm model. */
    public static boolean localSkinSlim() {
        return localSkinSlim;
    }

    /** Validated cosmetic id selected by the launcher for this game process. */
    public static String selected(String type) {
        if (!Set.of("wings", "hat", "bandana").contains(type)) return "";
        String value = localSyncLoaded ? localSelections.getOrDefault(type, "") : System.getProperty("lifea.cosmetic." + type, "");
        return value.matches("[A-Za-z0-9_-]{1,40}") ? value : "";
    }

    /** Read the launcher's atomic per-instance file at most twice per second. Runs on the client thread. */
    private static void refreshLocalSync() {
        long now = System.currentTimeMillis();
        if (now - syncCheckedAt < 500L) return;
        syncCheckedAt = now;
        String configured = System.getProperty("lifea.cosmetics.path", "");
        if (configured.isBlank()) return;
        try {
            Path path = Path.of(configured);
            if (!Files.isRegularFile(path)) return;
            long modified = Files.getLastModifiedTime(path).toMillis();
            if (modified == syncModified) return;
            JsonObject root = JsonParser.parseString(Files.readString(path)).getAsJsonObject();
            if (!root.has("formatVersion") || root.get("formatVersion").getAsInt() != 1) return;
            String skin = root.has("skinPath") && !root.get("skinPath").isJsonNull() ? root.get("skinPath").getAsString() : "";
            String cape = root.has("capePath") && !root.get("capePath").isJsonNull() ? root.get("capePath").getAsString() : "";
            String variant = root.has("skinVariant") ? root.get("skinVariant").getAsString() : "classic";
            Map<String, String> selections = new ConcurrentHashMap<>();
            if (root.has("cosmetics") && root.get("cosmetics").isJsonObject()) {
                JsonObject values = root.getAsJsonObject("cosmetics");
                for (String key : Set.of("wings", "hat", "bandana")) {
                    if (values.has(key) && values.get(key).isJsonPrimitive()) {
                        String value = values.get(key).getAsString();
                        if (value.matches("[A-Za-z0-9_-]{1,40}")) selections.put(key, value);
                    }
                }
            }
            if (!skin.equals(localSkinPath) || !variant.equals(localSkinSlim ? "slim" : "classic")) {
                destroyLocalTexture(localSkinTexture);
                localSkinTexture = null;
                localSkinLoaded = false;
            }
            if (!cape.equals(localCapePath)) {
                destroyLocalTexture(localCapeTexture);
                localCapeTexture = null;
                localCapeLoaded = false;
            }
            localSkinPath = skin;
            localCapePath = cape;
            localSkinSlim = "slim".equalsIgnoreCase(variant);
            localSelections = selections;
            syncModified = modified;
            localSyncLoaded = true;
        } catch (Exception error) {
            LOGGER.warn("Could not read LifeaCore instance cosmetics sync file", error);
        }
    }

    private static void destroyLocalTexture(Identifier id) {
        if (id != null) MinecraftClient.getInstance().getTextureManager().destroyTexture(id);
    }

    public static void tick(MinecraftClient c) {
        refreshLocalSync();
        if (backend.isEmpty() || c.world == null || inFlight || ++tickCounter % 100 != 0) return;
        long now = System.currentTimeMillis();
        JsonArray uuids = new JsonArray();
        for (AbstractClientPlayerEntity p : c.world.getPlayers()) {
            Long at = checkedAt.get(p.getUuid());
            if (at == null || now - at > TTL) {
                uuids.add(p.getUuid().toString());
                checkedAt.put(p.getUuid(), now);
                if (uuids.size() >= 100) break;
            }
        }
        if (uuids.isEmpty()) return;
        JsonObject body = new JsonObject();
        body.add("uuids", uuids);
        inFlight = true;
        HttpRequest req = HttpRequest.newBuilder(URI.create(backend + "/cosmetics/lookup"))
            .timeout(Duration.ofSeconds(8))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
            .build();
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofString()).whenComplete((res, err) -> {
            inFlight = false;
            if (err != null || res.statusCode() != 200) return;
            try {
                JsonObject all = JsonParser.parseString(res.body()).getAsJsonObject();
                for (JsonElement u : uuids) {
                    UUID uuid = UUID.fromString(u.getAsString());
                    JsonObject eq = all.has(u.getAsString()) ? all.getAsJsonObject(u.getAsString()) : null;
                    if (eq == null || !eq.has("cape")) {
                        capeOf.remove(uuid);
                        continue;
                    }
                    JsonObject cape = eq.getAsJsonObject("cape");
                    String id = cape.get("id").getAsString();
                    capeOf.put(uuid, id);
                    loadTexture(id, cape.get("texture").getAsString());
                }
            } catch (Exception ignored) {
                // Bad response: try again after the TTL.
            }
        });
    }

    private static void loadTexture(String id, String url) {
        if (textures.containsKey(id) || !loading.add(id) || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10)).GET().build();
        HTTP.sendAsync(req, HttpResponse.BodyHandlers.ofByteArray()).whenComplete((res, err) -> {
            loading.remove(id);
            if (err != null || res.statusCode() != 200 || res.body().length > MAX_TEXTURE_BYTES) return;
            byte[] png = res.body();
            MinecraftClient.getInstance().execute(() -> {
                try {
                    NativeImage img = NativeImage.read(new ByteArrayInputStream(png));
                    if (img.getWidth() > 512 || img.getHeight() > 512) {
                        img.close();
                        return;
                    }
                    Identifier tex = Identifier.of("lifea", "cosmetics/" + id.replaceAll("[^a-z0-9_./-]", "_"));
                    MinecraftClient.getInstance().getTextureManager().registerTexture(tex, Compat.texture(tex.toString(), img));
                    textures.put(id, tex);
                } catch (Exception ignored) {
                    // Not a valid PNG: skip this cosmetic.
                }
            });
        });
    }

    public static void clear() {
        checkedAt.clear();
        capeOf.clear();
    }
}
