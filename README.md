# Sloane Fox — Stand Together

This package contains the upgraded standalone browser game. Open `public/sloanefox.html` in a modern desktop or mobile browser to play. The game has no build step, package installation, server dependency, or external API requirement for its core combat loop.

## What changed

| Area | Upgrade delivered |
| --- | --- |
| Villains | The Ruminator, Worry Spore, Burden Imp, and Self-Doubt Geist now use clean background-free character assets with live movement, idle motion, telegraphs, attacks, hit recoil, and defeat motion. Burden’s chain attack is now visibly rendered as a swinging chain and projectile strike. |
| Bosses | All eight level bosses now use clean transparent character portraits and the live boss-motion system: pursuit bob, attack wind-up, cast/strike thrust, hit recoil, projectiles, and defeat motion. |
| Brawler structure | Each level now has three combat fronts before the boss. The HUD announces the current front, and the arena advances after the active enemies are cleared. |
| Lane-brawler interaction | The existing up/down depth movement is used as a multi-lane battlefield. Wooden crates and barrels appear in different lanes, can be broken by shots or jump kicks, and release rewards. |
| Rewards | Breakables can drop first-aid kits and power banks that restore health or charge Super attacks. |
| Controls | The two main heroes use movement, fire, jump, and Super only. Roll and chain actions have been removed from controls and touch UI. |
| Testing | A built-in `?demo` mode runs an automated one-player playthrough for visual review of fronts, enemies, breakables, pickups, and the first boss. |

## Controls

| Player | Movement | Fire | Jump | Super |
| --- | --- | --- | --- | --- |
| P1 | WASD | F | G | T |
| P2 | Arrow keys | . | / | , |

On touch devices, use the on-screen D-pad plus Fire, Jump, and Super action buttons. Roll and Chain are not available to either main hero.

## Automated visual review

Open `public/sloanefox.html?demo` to begin the deterministic demonstration. It starts in Level 1 and automatically fights through the three fronts toward the Anxiety boss. This mode is provided for repeatable testing; normal play remains unchanged at `public/sloanefox.html`.

## Notes

The project preserves the existing static HTML/Canvas deployment style so it is easy to host. The `public/` directory is the complete browser-ready game. Design and audit notes are also included in the package root for future development continuity.


## Fantasy fallback update

The latest pass changes **only non-hero presentation**. It replaces the modern city/grid gameplay scene with a warm fantasy landscape: a sunset sky, distant ruins, dead trees, cracked-earth ground, rocks, and a shallow side-scrolling combat band. Enemies, bosses, crates, barrels, and pickups now use direct ground-contact offsets and oval shadows so they read as firmly planted rather than floating.

> **Hero protection verified:** `hero-male.png` and `fox-female.png` are byte-for-byte identical to the original files in the supplied archive. Their source files were not edited or replaced during this pass.



## City route and Super update

The game now travels through a side-scrolling town route with low-rise buildings, lit windows, shop awnings, streetlights, bins, pavement, curbs, drains, cracked asphalt, and a warm city sky. The background is intentionally fuller than the earlier plain field while retaining the level ground plane used by the brawler.

Break crates and barrels to reveal a **red first-aid kit** or **blue power bank**. First aid restores **35 health**. A power bank adds **34 Super charge**. Enemy defeats can also drop the same city pickups, while score remains awarded for every defeat.

| Super charge | Trigger | Attack |
| --- | --- | --- |
| 33+ | P1 `T`, P2 `,`, or `SP` | **Grenade** — a local ground explosion damages nearby enemies. |
| 66+ | P1 `T`, P2 `,`, or `SP` | **Bazooka** — a heavy rocket travels across the lane and detonates on impact. |
| 100 | P1 `T`, P2 `,`, or `SP` | **Air Strike** — radio call, aircraft flyover, bomb strikes, screen shake and flash, then a full standard-enemy clear. |

For repeatable checks, open `public/sloanefox.html?demo&super=33`, `?demo&super=66`, or `?demo&super=100` to start the automated game with the respective Super tier precharged.


## 16-bit arcade finishing pass

The final pass keeps the existing two fox heroes, recurring pressures, and boss roster exactly in place. It makes the existing roster feel more like a fast arcade lane-brawler through changing encounter rhythm rather than by replacing character art.

| Arcade moment | What now happens |
| --- | --- |
| **Racing Thoughts** | A short, signposted reinforcement surge pushes in from both sides using the existing small enemies. |
| **Hold the Line** | A front sends pressure in small successive waves instead of presenting one static group. |
| **Breakthrough** | The final front rewards a clear with a resilience cache, health recovery, Super charge, and a visible power-bank payoff. |
| **Resolve and Focus** | Quick consecutive defeats build Resolve. A four-clear chain triggers Focus, grants a small Super boost, and gives the player’s shots a temporary damage lift. Getting hit breaks the chain. |
| **Boss warning** | A short final wave announces the existing boss before its entry, rather than ending the final front abruptly. |
| **Boss escalation** | At roughly half health, each existing boss visibly escalates, speeds up its existing pattern, and grants a small Super-charge buffer to help the player hold the line. Defeating a boss restores some health and Super charge for the next stage. |

The `?demo` mode remains available for repeatable visual review. It now taps Fire as a player would, rather than holding it, so it can demonstrate the expanded combat rhythm correctly.
