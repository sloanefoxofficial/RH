# Mobile Layout Fix — Sloane Fox: Stand Together

The portrait layout was repaired after the supplied phone screenshot exposed three failures: the HUD covered the combat lane, the touch controls occupied the fighter’s space, and foreground depth scaling enlarged the hero beyond the visible frame.

The current build uses a dedicated portrait composition. The 16:9 combat field is pinned near the top of the phone, the HUD occupies a reserved band above that field, and the D-pad plus action buttons are anchored inside the lower control area. Touch coordinates use the same viewport dimensions as the canvas, including the simulated portrait review mode.

Portrait depth scaling now has a maximum player scale of `0.50`, which keeps the complete hero visible when he moves toward the front of the lane while retaining enough size for readable play. Landscape play keeps the ordinary depth scale. A boot-order error in the temporary preview flag was also corrected; the game now proceeds past the loading screen normally.

The supplied Male Fox and Female Fox source PNGs remain byte-for-byte unchanged. The source archive was revalidated after the repair.

## Review mode

Use `?demo&stage=0&mobilePreview=1` for the deterministic 390×844 portrait composition preview. On a real phone, open the normal game URL; the same portrait layout activates automatically from the device aspect ratio and coarse-pointer controls.
