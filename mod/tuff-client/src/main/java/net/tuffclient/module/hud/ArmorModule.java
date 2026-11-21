package net.tuffclient.module.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.tuffclient.gui.Theme;
import net.tuffclient.setting.BoolSetting;

public final class ArmorModule extends HudModule {
	private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND};
	private final BoolSetting percent = add(new BoolSetting("percent", "Durability as %", false));

	public ArmorModule() {
		super("armor", "Armor Status", "Your armor and held item with durability.", 0.9, 0.62, true);
	}

	@Override
	public void render(GuiGraphicsExtractor g, Font font, boolean preview) {
		LocalPlayer player = Minecraft.getInstance().player;
		java.util.List<ItemStack> stacks = new java.util.ArrayList<>();
		for (EquipmentSlot slot : SLOTS) {
			ItemStack stack = player == null ? ItemStack.EMPTY : player.getItemBySlot(slot);
			if (!stack.isEmpty()) stacks.add(stack);
		}
		if (stacks.isEmpty() && !preview) {
			width = 0;
			height = 0;
			return;
		}
		int y = 2, w = 22;
		boolean any = !stacks.isEmpty();
		if (background.get()) g.fill(0, 0, width, height, 0x9A101210);
		for (ItemStack stack : stacks) {
			g.item(stack, 2, y);
			String text;
			int color = textColor();
			if (stack.isDamageableItem()) {
				int left = stack.getMaxDamage() - stack.getDamageValue();
				float frac = left / (float) stack.getMaxDamage();
				text = percent.get() ? Math.round(frac * 100) + "%" : String.valueOf(left);
				if (frac < 0.15f) color = Theme.DANGER;
				else if (frac < 0.4f) color = 0xFFE2B34A;
			} else {
				text = stack.getCount() > 1 ? String.valueOf(stack.getCount()) : "";
			}
			g.text(font, text, 21, y + 4, color);
			w = Math.max(w, 24 + font.width(text));
			y += 17;
		}
		if (!any) {
			String hint = preview ? "Armor" : "";
			g.text(font, hint, 4, 4, Theme.MUTED);
			w = Math.max(w, font.width(hint) + 8);
			y = 15;
		}
		width = w;
		height = Math.max(15, y + (any ? 1 : 0));
	}
}
