# Sloane Fox — Stand Together

This package contains the revised standalone HTML/Canvas browser game. Open `public/sloanefox.html` in a current desktop or mobile browser. It has no build step, server dependency, or external API requirement.

> **Protected character assets verified.** `hero-male.png` and `fox-female.png` match the supplied original archive byte-for-byte. The existing four recurring-pressure characters and all eight existing boss declarations remain present.

## The revised arcade journey

The game is now structured as a **long-form nine-front arcade level**. Every existing boss level uses a different pixel-art location, a compact arcade moment, more mixed pressure after the moment, a boss-warning wave, and the existing boss. Difficulty rises through enemy mixtures, lane control, sustain, and Super-charge decisions—not through traps or forced animations.

| Level | Location | Arcade moment |
| --- | --- | --- |
| 1 — Anxiety | Sunset Side Street | **Skateboard Rush** — Jump on, steer through cones, then auto-dismount at a safe curb. |
| 2 — Depression | Underground Train Station | **Platform Dash** — Fire the turnstile and jump the platform gap. |
| 3 — Toxic Relationship | City Park Forest Path | **Fallen Tree Vault** — Jump the low trunk. |
| 4 — Grief | Rainy Memorial Square | **Puddle Run** — Jump a flooded pavement section. |
| 5 — Hardship | Industrial Loading Yard | **Forklift Crossing** — Fire the bridge switch. |
| 6 — Financial Stress | Night Market Car Park | **Barrier Dash** — Jump the parking arm. |
| 7 — Trauma | Emergency District | **Motorbike Escape** — Fire to start and steer through an open lane, then auto-dismount safely. |
| 8 — Death | Rail Bridge at Dawn | **Last Signal** — Jump the rail break and fire the signal box. |

Each stage now uses hard-edged tile geometry, layered facade and structure detail, stepped kerbs, shallow 3/4 pavement perspective, rooftop and storefront depth, and a clear lower combat lane. Props remain on the horizon or lane edges so they frame rather than obscure combat. The heroes are rendered larger for arcade readability while their source PNG files remain unchanged.

## Controls

| Player | Move | Fire | Jump | Super |
| --- | --- | --- | --- | --- |
| P1 | WASD | F | G | T |
| P2 | Arrow keys | . | / | , |

Touch controls provide a D-pad plus **Fire**, **Jump**, and **SP**. The two heroes have no roll or chain action. When an arcade moment appears, use the on-screen prompt; every action finishes in a safe position and normal movement returns automatically.

## Super progression

| Charge | Super |
| --- | --- |
| 33+ | **Grenade** — labelled arc, local blast, warm flash, and small shake. |
| 66+ | **Rocket Launcher** — labelled heavy projectile, exhaust, wide impact, stronger shake. |
| 100 | **Air Strike** — labelled radio call, recognisable plane, five falling bombs, staggered blasts, maximum impact. |

The HUD now announces readiness before activation with a full-size, tier-coloured panel: **● GRENADE READY — PRESS SP** at 33, **▶ ROCKET LAUNCHER READY — PRESS SP** at 66, and **▲ AIR STRIKE READY — PRESS SP** at 100. Each readiness tier has its own orange, red, or gold panel and gauge colour.

Power banks appear after every cleared front, plus selected breakables, enemy drops, and wrecked curb-side cars. First-aid kits restore health.

## Living stage hazards

The active stages now include readable environmental pressure without forced traps. City, market, and square stages periodically give a short route warning then send a large bus through the marked back road lane; staying in the near lane avoids it. The park has nesting magpies that show a nest/shadow warning, then swoop through a defined space. Parked cars remain curb-side breakables rather than blocking the fight.

## Original arcade events

The level route now alternates compact fights with short original interaction beats: **Pressure Cases** can be shot or kicked for a power bank or first-aid reward; **Community Boards** briefly protect the team and drop a bank; **Support Runners** cross an edge lane for a few seconds and drop an aid reward when hit; and a designated relief front grants a recovery cache after pressure. These systems use the existing Fire, Jump, movement, pickup, and Super controls. They are original Sloane Fox world interactions, not copied characters or stages.

The combat route also uses tighter left-centre player framing and denser, stage-specific ground material—cracked asphalt/grit in the city, leaves and roots in the park, worn tile/rail material at the station, and rough industrial wear in the yard.

## Deterministic review URLs

Add the following suffixes after `public/sloanefox.html`.

| URL suffix | Review target |
| --- | --- |
| `?demo&inspect=walk` | Grounded visible stride for an existing Burden Imp. |
| `?demo&inspect=grenade` | Grenade Super tier. |
| `?demo&inspect=rocket` | Rocket Launcher Super tier. |
| `?demo&inspect=airstrike` | Plane-and-five-bomb Air Strike proof frame. |
| `?demo&stage=0&inspect=setpiece` | Level 1 Skateboard Rush. |
| `?demo&stage=1&inspect=setpiece` | Level 2 train-station Platform Dash. |
| `?demo&stage=2&inspect=setpiece` | Level 3 park Fallen Tree Vault. |
| `?demo&stage=6&inspect=setpiece` | Level 7 Emergency District Motorbike Escape. |
| `?demo&stage=0` | Normal automated play preview from Level 1. |
| `?demo&stage=0&inspect=bus` | Held city bus-pass review scene. |
| `?demo&stage=2&inspect=bird` | Held park magpie-swoop review scene. |
| `?demo&inspect=ready33` | Held Grenade readiness panel. |
| `?demo&inspect=ready66` | Held Rocket Launcher readiness panel. |
| `?demo&inspect=ready100` | Held Air Strike readiness panel. |
| `?demo&stage=0&inspect=runner` | Held Support Runner reward interaction. |
| `?demo&stage=0&inspect=case` | Held Pressure Case interaction. |
| `?demo&stage=0&inspect=board` | Held Community Board interaction. |

The project root includes the journey and difficulty design documents together with validation scripts for future maintenance.
