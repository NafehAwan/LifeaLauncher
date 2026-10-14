package gg.lifea.core.net;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;

import java.io.ByteArrayInputStream;
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

    public static void tick(MinecraftClient c) {
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
                    MinecraftClient.getInstance().getTextureManager().registerTexture(tex, new NativeImageBackedTexture(img));
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
