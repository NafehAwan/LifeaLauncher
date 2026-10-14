package gg.lifea.core.feature;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import gg.lifea.core.config.LifeaConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.util.math.MathHelper;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Waypoints per world/server and dimension, plus an automatic death waypoint. */
public final class Waypoints {
    private record Wp(String name, int x, int y, int z, String dim) {}

    private static boolean wasDead;

    private Waypoints() {}

    private static String worldKey(MinecraftClient c) {
        ServerInfo s = c.getCurrentServerEntry();
        if (s != null) return "server:" + s.address.toLowerCase();
        if (c.getServer() != null) return "local:" + c.getServer().getSaveProperties().getLevelName();
        return "unknown";
    }

    private static JsonArray store(MinecraftClient c) {
        JsonObject all = LifeaConfig.section("waypoints");
        String key = worldKey(c);
        if (!all.has(key) || !all.get(key).isJsonArray()) all.add(key, new JsonArray());
        return all.getAsJsonArray(key);
    }

    private static List<Wp> list(MinecraftClient c) {
        List<Wp> out = new ArrayList<>();
        for (JsonElement e : store(c)) {
            JsonObject o = e.getAsJsonObject();
            out.add(new Wp(o.get("name").getAsString(), o.get("x").getAsInt(), o.get("y").getAsInt(), o.get("z").getAsInt(), o.get("dim").getAsString()));
        }
        return out;
    }

    private static void add(MinecraftClient c, String name) {
        ClientPlayerEntity p = c.player;
        if (p == null || c.world == null) return;
        JsonArray arr = store(c);
        if (name.equals("Death")) {
            for (int i = arr.size() - 1; i >= 0; i--) if ("Death".equals(arr.get(i).getAsJsonObject().get("name").getAsString())) arr.remove(i);
        }
        JsonObject o = new JsonObject();
        o.addProperty("name", name);
        o.addProperty("x", p.getBlockX());
        o.addProperty("y", p.getBlockY());
        o.addProperty("z", p.getBlockZ());
        o.addProperty("dim", c.world.getRegistryKey().getValue().toString());
        arr.add(o);
        while (arr.size() > 50) arr.remove(0);
        LifeaConfig.markDirty();
    }

    public static void addHere(MinecraftClient c) {
        add(c, "Waypoint " + (store(c).size() + 1));
    }

    /** Called every client tick: records where the player died. */
    public static void tick(MinecraftClient c) {
        if (c.player == null) return;
        boolean dead = c.player.isDead();
        if (dead && !wasDead) add(c, "Death");
        wasDead = dead;
    }

    private static final String[] ARROWS = { "↑", "↗", "→", "↘", "↓", "↙", "←", "↖" };

    public static List<String> hudLines(MinecraftClient c, int max) {
        ClientPlayerEntity p = c.player;
        if (p == null || c.world == null) return null;
        String dim = c.world.getRegistryKey().getValue().toString();
        List<String> out = new ArrayList<>();
        list(c).stream()
            .filter(w -> w.dim().equals(dim))
            .sorted(Comparator.comparingDouble(w -> p.squaredDistanceTo(w.x() + 0.5, w.y(), w.z() + 0.5)))
            .limit(max)
            .forEach(w -> {
                double dx = w.x() + 0.5 - p.getX();
                double dz = w.z() + 0.5 - p.getZ();
                int dist = (int) Math.sqrt(dx * dx + dz * dz);
                float target = (float) (MathHelper.atan2(dz, dx) * (180.0 / Math.PI)) - 90f;
                float rel = MathHelper.wrapDegrees(target - p.getYaw());
                int idx = Math.floorMod(Math.round(rel / 45f), 8);
                out.add(ARROWS[idx] + " " + w.name() + "  " + dist + "m");
            });
        return out;
    }
}
