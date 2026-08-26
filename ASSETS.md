# Assets — Sloane Fox: Stand Together

**Visual target:** `golden_lane_brawler_visual_target.png`

**Art direction:** A dark, sharp, retro-inspired 2D arcade brawler. The playable surface is a broad, readable multi-lane street with a moody urban backdrop. Blue-black shadows, charcoal pavement, amber streetlight, violet power effects, crimson threat accents, and strong character silhouettes preserve the project’s existing resilience-focused tone.

| Asset group | Available material | Intended use |
| --- | --- | --- |
| Heroes | Male and female fox still portraits plus walk, jump, kick, chain, and large atlas sheets | Existing hero animation pipeline remains the visual anchor. |
| Ruminator | `rumin_atlas.png`, six columns by four action rows, but with opaque guide/background elements | Extract clean idle, walk/run, mental-assault, and hit frames. |
| Worry Spore | `worry_atlas.png`, six columns by four action rows, but with opaque guide/background elements | Extract clean idle, telegraph, ranged mental-assault, and hit frames. |
| Burden Imp | `burden_atlas.png`, five columns by four action rows, including chain-swing frames | Extract clean idle/walk, chain-swing, impact, and hit frames. |
| Self-Doubt Geist | `min_geist.png` static portrait | Use procedural hover, drift, cast, recoil, and defeat motion. |
| Bosses | Individual boss portraits | Use procedural walk bob, attack anticipation/thrust, casting, hit recoil, and defeat motion. |
| Props and rewards | No supplied destructible-prop sheet | Add reusable crate, barrel, magical companion, and star-power assets matching the visual target. |

The enemy sheets must be treated as source material, not rendered directly as screenshots. Frames will be transparently extracted and assigned to explicit animation states.


## Reference-driven 16-bit fantasy lane-brawler visual system

**Visual target:** `golden_lane_visual_target_v2.png` is a non-hero art-direction image created from the user’s provided arcade reference screenshots. It is a guide only and must never replace, edit, recolour, rescale, or otherwise alter `hero-male.png` or `fox-female.png`.

| Element | Required presentation |
| --- | --- |
| Camera and playfield | Left-to-right side-scrolling combat with a shallow 3/4 lane band. The ground remains visibly flat, with only enough depth variation to support up/down movement. No top-down camera, camera tilt, or floating actors. |
| Ground | Warm cracked earth or cobbled trail in brown, ochre, and muted orange. The ground is bright enough to read character feet and shadows. |
| Background | Fantasy ruins, dead trees, rocky ridges, distant fortifications, and a warm sunset or storm sky. Urban buildings, neon grids, and modern city silhouettes are prohibited. |
| Regular villains | Original fantasy grunts in compact 16-bit pixel-art-inspired silhouettes: axe goblin, armored raider, chain warrior, skeletal swordsman, or similarly distinct variants. Their feet anchor to the lane plane and their height remains close to or slightly below the supplied hero height. |
| Bosses | Original fantasy brute, armored champion, warlock, or skeletal commander silhouettes at roughly 1.55–1.85 times the hero height. Each must visibly sit on the ground plane and cast an oval shadow. |
| Props and rewards | Wooden crates and barrels with simple fantasy-metal accents. Blue spirit/flask or magical star pickups; no modern glowing UI treatment. |
| Shading and palette | Chunky high-contrast 16-bit arcade rendering with dark outlines, earthy browns, oranges, gray-blue metals, subdued greens, and restrained blue/gold magical highlights. |
| Protected hero rule | Hero textures, sprites, atlases, source PNG files, scale constants, position logic, and draw calls are out of scope. Only their environment, opponents, and non-hero effects may change. |

### Build constraints

The existing side-scrolling gameplay structure, player control system, and multi-front progression will remain in place. This pass changes only non-hero art direction and its rendering treatment.
