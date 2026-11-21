package net.tuffclient.setting;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

public final class NumberSetting extends Setting<Double> {
	public final double min;
	public final double max;
	public final double step;

	public NumberSetting(String id, String name, double value, double min, double max, double step) {
		super(id, name, value);
		this.min = min;
		this.max = max;
		this.step = step;
	}

	@Override
	public void set(Double v) {
		double snapped = Math.round(v / step) * step;
		value = Math.max(min, Math.min(max, snapped));
	}

	public void nudge(int direction) {
		set(value + step * direction);
	}

	/** Position of the value between min and max, 0..1. */
	public double fraction() {
		return (value - min) / (max - min);
	}

	@Override
	public String display() {
		return step >= 1 ? String.valueOf(Math.round(value)) : String.format("%.1f", value);
	}

	@Override
	public JsonElement toJson() {
		return new JsonPrimitive(value);
	}

	@Override
	public void fromJson(JsonElement json) {
		if (json.isJsonPrimitive()) set(json.getAsDouble());
	}
}
