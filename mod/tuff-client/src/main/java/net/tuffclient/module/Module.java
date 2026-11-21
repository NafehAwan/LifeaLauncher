package net.tuffclient.module;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonObject;
import net.minecraft.client.Minecraft;
import net.tuffclient.setting.Setting;

public abstract class Module {
	public final String id;
	public final String name;
	public final String description;
	public final Category category;
	private final List<Setting<?>> settings = new ArrayList<>();
	private boolean enabled;

	protected Module(String id, String name, String description, Category category, boolean enabledByDefault) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.category = category;
		this.enabled = enabledByDefault;
	}

	protected <S extends Setting<?>> S add(S setting) {
		settings.add(setting);
		return setting;
	}

	public List<Setting<?>> settings() {
		return settings;
	}

	/** Hidden modules hold settings but don't appear as mod cards. */
	public boolean hidden() {
		return false;
	}

	public boolean isEnabled() {
		return enabled;
	}

	public void setEnabled(boolean value) {
		if (value == enabled) return;
		enabled = value;
		if (value) onEnable();
		else onDisable();
	}

	public void toggle() {
		setEnabled(!enabled);
	}

	protected void onEnable() {
	}

	protected void onDisable() {
	}

	/** Called at the end of every client tick while enabled. */
	public void tick(Minecraft client) {
	}

	public JsonObject save() {
		JsonObject json = new JsonObject();
		json.addProperty("enabled", enabled);
		JsonObject values = new JsonObject();
		for (Setting<?> s : settings) values.add(s.id, s.toJson());
		json.add("settings", values);
		return json;
	}

	public void load(JsonObject json) {
		if (json.has("enabled")) enabled = json.get("enabled").getAsBoolean();
		if (json.has("settings") && json.get("settings").isJsonObject()) {
			JsonObject values = json.getAsJsonObject("settings");
			for (Setting<?> s : settings) {
				if (values.has(s.id)) s.fromJson(values.get(s.id));
			}
		}
	}
}
