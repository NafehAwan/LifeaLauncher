package gg.lifea.core.mixin;

import net.minecraft.client.option.SimpleOption;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Raw access to an option's value, bypassing its validator (used for zoom FOV and fullbright gamma). */
@Mixin(SimpleOption.class)
public interface SimpleOptionAccessor {
    @Mutable
    @Accessor("value")
    void lifea$setValue(Object value);
}
