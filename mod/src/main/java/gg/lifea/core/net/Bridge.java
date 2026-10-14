package gg.lifea.core.net;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import gg.lifea.core.feature.Trackers;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Connection to LifeaLauncher on 127.0.0.1 (port + token come from -Dlifea.bridge.* system properties set by the
 * launcher). Sends FPS stats for the Boost page and presence; receives the backend URL and social token.
 * Everything is optional: without the launcher the mod works fully offline.
 */
public final class Bridge {
    private static final AtomicReference<WebSocket> SOCKET = new AtomicReference<>();
    private static final String PORT = System.getProperty("lifea.bridge.port");
    private static final String TOKEN = System.getProperty("lifea.bridge.token");
    private static final String INSTANCE = System.getProperty("lifea.instance", "");
    private static long nextAttempt;
    private static long nextFps;

    private Bridge() {}

    public static boolean available() {
        return PORT != null && TOKEN != null;
    }

    public static void tick() {
        if (!available()) return;
        long now = System.currentTimeMillis();
        WebSocket ws = SOCKET.get();
        if (ws == null && now >= nextAttempt) {
            nextAttempt = now + 10_000;
            connect();
        }
        if (ws != null && now >= nextFps) {
            nextFps = now + 30_000;
            float[] s = Trackers.drainFpsStats();
            if (s != null) {
                JsonObject o = new JsonObject();
                o.addProperty("type", "fps");
                o.addProperty("avg", s[0]);
                o.addProperty("low1", s[1]);
                o.addProperty("samples", (int) s[2]);
                send(o);
            }
        }
    }

    private static void connect() {
        HttpClient.newHttpClient()
            .newWebSocketBuilder()
            .buildAsync(URI.create("ws://127.0.0.1:" + PORT), new WebSocket.Listener() {
                private final StringBuilder buf = new StringBuilder();

                @Override
                public void onOpen(WebSocket ws) {
                    SOCKET.set(ws);
                    JsonObject hello = new JsonObject();
                    hello.addProperty("type", "hello");
                    hello.addProperty("token", TOKEN);
                    hello.addProperty("instanceId", INSTANCE);
                    ws.sendText(hello.toString(), true);
                    ws.request(1);
                }

                @Override
                public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                    buf.append(data);
                    if (last) {
                        handle(buf.toString());
                        buf.setLength(0);
                    }
                    ws.request(1);
                    return CompletableFuture.completedFuture(null);
                }

                @Override
                public CompletionStage<?> onClose(WebSocket ws, int code, String reason) {
                    SOCKET.compareAndSet(ws, null);
                    return CompletableFuture.completedFuture(null);
                }

                @Override
                public void onError(WebSocket ws, Throwable error) {
                    SOCKET.compareAndSet(ws, null);
                }
            })
            .exceptionally(e -> null);
    }

    private static void handle(String text) {
        try {
            JsonObject o = JsonParser.parseString(text).getAsJsonObject();
            if ("config".equals(o.has("type") ? o.get("type").getAsString() : "")) {
                String url = o.has("backendUrl") && !o.get("backendUrl").isJsonNull() ? o.get("backendUrl").getAsString() : "";
                Cosmetics.configure(url);
            }
        } catch (Exception ignored) {
            // Malformed message from the launcher: ignore.
        }
    }

    public static void send(JsonObject o) {
        WebSocket ws = SOCKET.get();
        if (ws != null) ws.sendText(o.toString(), true);
    }

    public static void presence(String server) {
        JsonObject o = new JsonObject();
        o.addProperty("type", "presence");
        if (server != null) o.addProperty("server", server);
        send(o);
    }
}
