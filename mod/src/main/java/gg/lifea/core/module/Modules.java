package gg.lifea.core.module;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Registry of all modules plus the set the current server has disabled (lifea:modules payload). */
public final class Modules {
    private static final List<Module> ALL = new ArrayList<>();
    private static final Set<String> SERVER_DISABLED = new HashSet<>();

    private Modules() {}

    public static <T extends Module> T register(T m) {
        ALL.add(m);
        return m;
    }

    public static List<Module> all() {
        return Collections.unmodifiableList(ALL);
    }

    public static void loadAll() {
        for (Module m : ALL) m.load();
    }

    public static void tickAll() {
        for (Module m : ALL) if (m.active()) m.tick();
    }

    public static boolean serverDisabled(String id) {
        return SERVER_DISABLED.contains(id);
    }

    public static void setServerDisabled(Set<String> ids) {
        SERVER_DISABLED.clear();
        SERVER_DISABLED.addAll(ids);
    }

    public static void clearServerRules() {
        SERVER_DISABLED.clear();
    }
}
