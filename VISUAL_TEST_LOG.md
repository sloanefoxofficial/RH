# Live Visual Test Log

## 26 August 2026 — Eight-level hazard integration

The live Level 2 inspection at `?demo&stage=1&inspect=train` confirms that the 16:9 field is preserved, the Underground Train Station scene reads as a station, the protected hero file is still rendered without source modification, and the train event appears visibly behind the brawler lane.

The check also confirms the unresolved visual constraint: the protected hero art still reads more detailed and cut-out-like than the low-resolution station treatment. No hero source asset was edited. Future presentation work must improve scene density, framing, shadows, and supporting animation without claiming that the styles are fully unified.

The hazard extension now covers every existing level: bus, train, magpie, puddle, forklift, parking barrier, ambulance, and bridge wind. Each can be shown through a deterministic `?demo&stage=N&inspect=TYPE` address.

## 26 August 2026 — Industrial Yard and Rail Bridge live checks

Level 5 at `?demo&stage=4&inspect=forklift` now reads as a container yard, with stacked cargo, crane framing, skyline depth, a worn material-rich ground plane, and a visible forklift event. Level 8 at `?demo&stage=7&inspect=wind` now reads separately as an elevated rail bridge, with steel lattice frames, gantries, signal lights, city depth, and visible wind streaks.

These two screens demonstrate that Levels 5 and 8 now have separate scene identities and hazards. They do **not** establish final visual acceptance. The hero-to-scene art mismatch remains visible, and the user was correct that this is not yet at the intended rich classic-arcade finish.

## 26 August 2026 — Rail Bridge arena check

The Level 8 test at `?demo&stage=7&inspect=arena` confirms that the bridge route switches into a signal-framed final-arena state, while keeping the central shallow combat lane open. The same screen also clearly displays `▲ AIR STRIKE READY — PRESS SP` at full Super charge.

The arena state is functional and visibly distinct. It is not a claim of final art acceptance: the scene is more structured than the previous fallback, but it still does not yet reach the material richness and cohesion requested by the user.

## 26 August 2026 — Night Market and Emergency District finale checks

Level 6 at `?demo&stage=5&inspect=arena` shows a night market composition with layered stalls, coloured lamps, awnings, and market-specific arena lights. Level 7 at `?demo&stage=6&inspect=arena` shows an emergency district with rain, hospital/service architecture, ambulance-bay dressing, and contrasting red/blue warning lamps.

Both locations read differently from the Industrial Yard and Rail Bridge stages. The final check still identifies the same core limitation: the supplied hero render style is more detailed than the low-resolution environment art. Hero source files remain untouched. The level pass is structurally complete, but the user should not be told that it matches the requested classic arcade visual standard without resolving that cohesion issue.

## 26 August 2026 — Display-only hero treatment correction

Two initial offscreen-canvas display treatments were tested in Level 6 and failed visibly: the hero did not render. Those implementations were removed from the active draw path. The source hero files were never edited. The active replacement uses a direct canvas transform that draws each hero frame at low logical resolution with nearest-neighbour scaling and a silhouette outline built from repeated draw passes; it avoids the intermediate image buffer entirely. A new live check is required before any claim about visual improvement.

## 26 August 2026 — Conservative hero display treatment accepted for testing

The Level 6 check at `?demo&stage=5&inspect=arena&heroDisplay=conservative` confirms the hero is visible again after the low-resolution transform attempts were removed. The active display-only treatment uses a conservative dark silhouette edge, restrained contrast/saturation adjustment, and stronger ground shadow. It keeps the hero planted more firmly in the lane without touching the source PNGs.

The low-resolution/offscreen pixel transform was rejected because it made the hero disappear in live rendering. It is not part of the active result.

## 26 August 2026 — Both hero display verification

The Female Fox was checked at `?demo&stage=2&inspect=arena&hero=female`. She renders visibly in the park lane with the same conservative outline and ground-shadow treatment used by the Male Fox. The review HUD now correctly reads `P1 · FEMALE FOX` when that deterministic demo option is used.

Both protected heroes now use the same display-only drawing path. Their source files remain unchanged, as confirmed by the protected-asset validators.

## 26 August 2026 — Normal startup flow

The non-demo title screen opens correctly and advertises `8 levels · 8 bosses`. Selecting `1 Player` reaches the protected hero selector, which visibly presents both supplied hero identities without replacing their source artwork. The normal start path is intact up to character selection.

## 26 August 2026 — Normal Level 1 entry

After choosing the Male Fox and starting normally, the game reaches the Level 1 briefing: `ANXIETY`, `Sunset Side Street`, and `FRONT 1 / 9`. This confirms the ordinary user path begins the intended long first boss route rather than a short generic level.

## 26 August 2026 — Level 1 city correction

The normal-play Level 1 check exposed the CraftPix city image as a poor fit because it read as a cartoon platform scene. It was removed from the live asset map. The replacement test at `?demo&stage=0&inspect=arena&streetFix=1` shows the original rainy side street: layered closed-shop facades, rainy skyline, material-rich pavement, a clear wide brawler lane, and no unrelated foreground character.

## 26 August 2026 — Air Strike inspection defect found

The Level 1 air-strike inspection continues to show the rainy side street, grounded hero, and falling bomb effects. However, the deterministic test frame freezes too late in the sequence, after the aircraft has moved off-screen. This does not prove the required visible plane. The inspection timing must be corrected to hold the aircraft on-screen with the bomb line before final verification.

## 26 August 2026 — Air Strike inspection corrected

The retimed inspection at `?demo&stage=0&inspect=airstrike&superCheck=planeVisible` visibly shows the aircraft crossing the upper-left of the rainy city scene with the bomb line beneath it. The highest Super tier now has the intended direct visual proof: plane, bombs, and wide-screen impact staging.

## 26 August 2026 — Tiered Super readiness checks

The deterministic Level 1 checks confirm the lower tiers are visibly distinct before activation: `● GRENADE READY — PRESS SP` at the first threshold and `▶ ROCKET LAUNCHER READY — PRESS SP` at the second. Together with the corrected aircraft-and-bombs Air Strike inspection, the three-stage Super progression is now visually demonstrated.
