# Living Arcade and Super Readiness Acceptance Criteria

## Living-stage rule

A stage is not complete when the background is merely drawn. It must have readable independent life that can affect the player without becoming unfair. Hazards announce themselves before damage, occupy a defined lane, and offer a clear avoidance action. They are stage systems, not character replacements.

| Stage type | Living system | Warning | Player response | Fair consequence |
| --- | --- | --- | --- | --- |
| City street / market | Timed **bus pass** across the back combat lane. Parked cars remain breakable at curbs. | Flashing route sign and bus engine cue before entry. | Move to the near lane or jump at the kerb. | Moderate hit and knockback; never an instant loss. |
| Park / forest | **Magpie swoop** from a marked nesting tree. | Nest rustle, shadow circle, and brief bird call. | Step away from the tree zone or jump. | Small hit and temporary aim interruption. |
| Train station | Train arrival light and platform edge gust. | Blinking warning strip and rail rumble. | Stay off the platform edge. | Small push inward, no fall state. |
| Industrial yard | Forklift path and warning beacon. | Yellow strobe and reversing beeps. | Use a free lane. | Small bump and recoverable knockback. |
| Emergency district | Ambulance light sweep and road closure. | Alternating blue/red pavement markers. | Cross on the dark cycle. | Brief slow rather than a hard stop. |

## Explicit Super readiness rule

The player must know the current and next Super tier by looking at the HUD for less than one second. The gauge is accompanied by a large, tier-coloured readiness panel and a one-time threshold callout.

| Charge range | Always-visible HUD state | Threshold callout | Colour / icon | Activation result |
| --- | --- | --- | --- | --- |
| 0–32 | `CHARGE: FIND POWER BANKS` | None | Blue cells / empty launcher slots | No Super available. |
| 33–65 | `GRENADE READY — PRESS SP` | `GRENADE READY` | Orange grenade silhouette | Local arc and blast. |
| 66–99 | `ROCKET LAUNCHER READY — PRESS SP` | `ROCKET LAUNCHER READY` | Red rocket silhouette with exhaust | Large direct projectile and wide impact. |
| 100 | `AIR STRIKE READY — PRESS SP` | `AIR STRIKE READY` | Gold aircraft silhouette and five bomb pips | Plane, falling bombs, maximum blast sequence. |

The panel must change colour and icon at 33, 66, and 100; it cannot rely on a thin bar alone. Each Super effect must use the same tier colour and identity as the readiness panel.
