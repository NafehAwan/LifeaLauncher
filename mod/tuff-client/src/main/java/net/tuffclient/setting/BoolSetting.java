package net.tuffclient.setting;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

public final class BoolSetting extends Setting<Boolean> {
	public BoolSetting(String id, String name, boolean value) {
		super(id, name, value);
	}

	public void toggle() {
		value = !value;
	}

	@Override
	public String display() {
		return value ? "On" : "Off";
	}

	@Override
	public JsonElement toJson() {
		return new JsonPrimitive(value);
	}

	@Override
	public void fromJson(JsonElement json) {
		if (json.isJsonPrimitive()) value = json.getAsBoolean();
	}
}
