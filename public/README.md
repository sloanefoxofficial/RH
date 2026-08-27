# Sloane Fox — Stand Together

This is a standalone HTML/Canvas browser game. Open `public/sloanefox.html` in a current desktop or mobile browser. There is no build step, server dependency, or external API requirement.

> **Protected heroes:** `hero-male.png` and `fox-female.png` are verified against the supplied archive and remain byte-for-byte unchanged. The game applies only a display-time silhouette edge, restrained colour tightening, and stronger ground shadow while drawing them on the canvas.

## Eight-boss arcade journey

Every existing boss now has a dedicated long level rather than a generic route. Each level uses nine combat fronts, its own wide 16:9 scene, a location-specific living hazard, an original compact arcade moment, a recovery opportunity, and a distinct boss-arena state.

| Level | Boss | Location | World pressure | Arcade moment |
| --- | --- | --- | --- | --- |
| 1 | Anxiety | Rainy Side Street | Bus lane | Skateboard Rush |
| 2 | Depression | Underground Train Station | Platform train | Platform Dash |
| 3 | Toxic Relationship | Old Park Path | Magpie swoop | Fallen Tree Vault |
| 4 | Grief | Rainy Memorial Square | Flooded paving | Puddle Run |
| 5 | Hardship | Industrial Loading Yard | Forklift crossing | Bridge Switch |
| 6 | Financial Stress | Night Market Car Park | Parking barrier | Barrier Dash |
| 7 | Trauma | Emergency District | Ambulance route | Motorbike Escape |
| 8 | Death | Rail Bridge at Dawn | Bridge wind | Last Signal |

All eight scenes keep a shallow 3/4 grounded fighting lane. The original rainy Level 1 city scene intentionally replaces an evaluated cartoon-platform background that did not fit the brawler presentation.

## Controls

| Player | Move | Fire | Jump | Super |
| --- | --- | --- | --- | --- |
| P1 | WASD | F | G | T |
| P2 | Arrow keys | . | / | , |

Touch play provides a D-pad plus **Fire**, **Jump**, and **SP**. The hero roll and hero chain mechanics are absent. Arcade moments always return the player to safe normal control.

## Super progression

| Charge | Readiness label | Action |
| --- | --- | --- |
| 33+ | **● GRENADE READY — PRESS SP** | Grenade: local blast, flash, and shake. |
| 66+ | **▶ ROCKET LAUNCHER READY — PRESS SP** | Rocket Launcher: large projectile, exhaust, wider impact, stronger shake. |
| 100 | **▲ AIR STRIKE READY — PRESS SP** | Air Strike: radio call, visible aircraft, five falling bombs, staggered blasts, and maximum impact. |

Power banks come from cleared fronts, selected breakables, enemy drops, parked-car wrecks, recovery caches, and optional aid interactions. First-aid kits restore health.

## Review addresses

Append one of the following suffixes to `public/sloanefox.html`.

| URL suffix | Review target |
| --- | --- |
| `?demo&stage=0` | Level 1 automated normal-play preview. |
| `?demo&stage=0&inspect=arena` | Anxiety boss-arena state. |
| `?demo&stage=1&inspect=train` | Station train warning/event. |
| `?demo&stage=2&inspect=bird` | Park magpie event. |
| `?demo&stage=4&inspect=forklift` | Industrial Yard forklift event. |
| `?demo&stage=5&inspect=arena` | Night Market boss-arena state. |
| `?demo&stage=6&inspect=ambulance` | Emergency District ambulance event. |
| `?demo&stage=7&inspect=wind` | Rail Bridge wind event. |
| `?demo&stage=7&inspect=arena` | Death boss-arena state. |
| `?demo&stage=0&inspect=walk` | Existing enemy’s grounded walking proof. |
| `?demo&stage=0&inspect=ready33` | Grenade readiness state. |
| `?demo&stage=0&inspect=ready66` | Rocket Launcher readiness state. |
| `?demo&stage=0&inspect=ready100` | Air Strike readiness state. |
| `?demo&stage=0&inspect=airstrike` | Visible aircraft-and-five-bomb Super frame. |
| `?demo&stage=0&inspect=runner` | Support Runner aid reward. |
| `?demo&stage=0&inspect=case` | Pressure Case reward object. |
| `?demo&stage=0&inspect=board` | Community Board reward object. |
| `?demo&stage=2&inspect=arena&hero=female` | Female Fox display-time treatment in the park arena. |

`CREDITS.md` records the CC0 forest source supporting the recomposed Level 3 park scene. `VISUAL_TEST_LOG.md` records the current visual checks and the remaining known quality constraint: protected hero source art is intentionally preserved while their on-screen composite has been strengthened.
