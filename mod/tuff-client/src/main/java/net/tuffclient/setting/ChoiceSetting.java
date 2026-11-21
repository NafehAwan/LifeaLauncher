package net.tuffclient.setting;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

/** One of a fixed list of options, stored by name so reordering is safe. */
public final class ChoiceSetting extends Setting<Integer> {
	public final String[] options;

	public ChoiceSetting(String id, String name, int index, String... options) {
		super(id, name, index);
		this.options = options;
	}

	public String choice() {
		return options[value];
	}

	public void cycle(int direction) {
		value = Math.floorMod(value + direction, options.length);
	}

	@Override
	public String display() {
		return choice();
	}

	@Override
	public JsonElement toJson() {
		return new JsonPrimitive(choice());
	}

	@Override
	public void fromJson(JsonElement json) {
		if (!json.isJsonPrimitive()) return;
		String name = json.getAsString();
		for (int i = 0; i < options.length; i++) {
			if (options[i].equals(name)) value = i;
		}
	}
}
