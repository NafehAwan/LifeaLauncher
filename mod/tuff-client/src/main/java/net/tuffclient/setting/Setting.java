package net.tuffclient.setting;

import com.google.gson.JsonElement;

/** A user-editable module option, shown in the module's settings panel. */
public abstract sealed class Setting<T> permits BoolSetting, ChoiceSetting, NumberSetting {
	public final String id;
	public final String name;
	protected T value;

	protected Setting(String id, String name, T value) {
		this.id = id;
		this.name = name;
		this.value = value;
	}

	public T get() {
		return value;
	}

	public void set(T value) {
		this.value = value;
	}

	/** Human-readable value for the settings panel. */
	public abstract String display();

	public abstract JsonElement toJson();

	public abstract void fromJson(JsonElement json);
}
