# Urban Progression and Super Plan

This update retains the existing left-to-right multi-front brawler structure and does not alter either hero asset, animation atlas, source PNG, scale constant, position logic, or draw call. The player progresses through a recognisable town route: storefronts and terraced buildings, streetlights, a pharmacy-style first-aid sign without text, bins, brick walls, parked service vehicles, utility poles, and suburban civic landmarks. The battle plane remains level and shallow, so the existing up/down lanes remain functional.

| System | Rule | Player-facing result |
| --- | --- | --- |
| City route | Each stage uses one urban variation: main street, small-town strip, rain-slick back street, memorial park edge, industrial row, market lane, waterfront road, and stadium precinct. | The setting feels like a journey through the city rather than a blank field or jungle. |
| Health kit | A destroyed crate or barrel can release a first-aid kit. Collecting it restores 35 health, up to the hero’s maximum health. | The player can recover after a tough fight. |
| Power bank | A destroyed crate or barrel can release a blue power bank. Collecting it adds 34 Super charge. | Super charge visibly builds from pickups found in the city. |
| Standard kill reward | Defeating an enemy awards score as before and has a modest chance to drop a power bank or first-aid kit. | Kills remain rewarding without making Super automatic. |
| Tier 1 Super | At one-third charge, **Grenade** is thrown toward the facing direction, explodes at ground level, and damages nearby enemies. Cost: 33 charge. | A local crowd-clearer. |
| Tier 2 Super | At two-thirds charge, **Bazooka** fires a powerful explosive projectile across the lane. It detonates on contact or at the screen edge and deals a larger blast. Cost: 66 charge. | A longer-range, stronger crowd-clearer. |
| Tier 3 Super | At full charge, the hero uses a **walkie-talkie**; a plane silhouette crosses the sky, bombs strike the active field, the screen shakes and colour-flashes, and all standard enemies on-screen are cleared. Cost: 100 charge. | A visible, unmistakable screen-clearing air strike. |
| Input | P1: `T`; P2: `,`; touch: `SP`. Inputs are edge-triggered and show a short on-screen banner so activation is never silent. | The Super is clear to trigger and easy to verify. |

The user’s requested effects—grenade, bazooka, radio call, aircraft pass, bombs, screen shake, colour change, and a full enemy clear—are non-hero visual effects. They will be implemented in the game canvas without modifying the hero artwork.
