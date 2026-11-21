package net.tuffclient.module.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.player.LocalPlayer;
import net.tuffclient.gui.Theme;
import net.tuffclient.setting.BoolSetting;

public final class CoordinatesModule extends HudModule {
	private static final String[] FACING = {"South +Z", "West -X", "North -Z", "East +X"};
	private final BoolSetting direction = add(new BoolSetting("direction", "Show direction", true));

	public CoordinatesModule() {
		super("coordinates", "Coordinates", "Your position and the direction you're facing.", 0.006, 0.15, true);
	}

	@Override
	public void render(GuiGraphicsExtractor g, Font font, boolean preview) {
		LocalPlayer p = Minecraft.getInstance().player;
		String xyz = p == null ? "XYZ 0 64 0" : String.format("XYZ %.0f %.0f %.0f", Math.floor(p.getX()), Math.floor(p.getY()), Math.floor(p.getZ()));
		String facing = "";
		if (direction.get()) {
			float yaw = p == null ? 0 : p.getYRot();
			facing = FACING[Math.floorMod(Math.round(yaw / 90f), 4)];
		}
		int w = Math.max(font.width(xyz), font.width(facing)) + 8;
		int h = facing.isEmpty() ? 15 : 25;
		box(g, w, h);
		g.text(font, xyz, 4, 4, textColor());
		if (!facing.isEmpty()) g.text(font, facing, 4, 14, Theme.MUTED);
	}
}
