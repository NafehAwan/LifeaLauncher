package gg.lifea.core.module;

import com.google.gson.JsonObject;
import gg.lifea.core.config.LifeaConfig;

/** A toggleable feature. Subclasses override the hooks they need. */
public abstract class Module {
    public enum Category { HUD, GAMEPLAY, VISUAL }

    public final String id;
    public final String name;
    public final String description;
    public final Category category;
    private final boolean defaultEnabled;
    private boolean enabled;

    protected Module(String id, String name, String description, Category category, boolean defaultEnabled) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.defaultEnabled = defaultEnabled;
    }

    protected JsonObject config() {
        return LifeaConfig.entry("modules", id);
    }

    public void load() {
        JsonObject c = config();
        enabled = c.has("enabled") ? c.get("enabled").getAsBoolean() : defaultEnabled;
        if (enabled) onEnable();
    }

    /** Enabled by the player AND not disabled by the current server. */
    public boolean active() {
        return enabled && !Modules.serverDisabled(id);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean on) {
        if (on == enabled) return;
        enabled = on;
        config().addProperty("enabled", on);
        LifeaConfig.markDirty();
        if (on) onEnable();
        else onDisable();
    }

    public void toggle() {
        setEnabled(!enabled);
    }

    /** Optional secondary action (right-click in the menu), e.g. cycling a style. */
    public String optionLabel() {
        return null;
    }

    public void cycleOption() {}

    protected void onEnable() {}

    protected void onDisable() {}

    public void tick() {}
}
