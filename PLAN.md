# Game Plan: Sloane Fox — Stand Together

## Risk Tasks

### 1. Enemy-sheet conversion and animation state handoff

- **Why isolated:** The supplied villain atlases are opaque, irregularly structured source sheets rather than clean uniform sprite strips. Rendering them directly creates a screenshot-like appearance and exposes guide-grid backgrounds.
- **Approach:** Extract the usable content regions into transparent per-state frame strips. Drive each enemy from explicit `idle`, `walk`, `telegraph`, `attack`, `hurt`, and `defeat` states, preserving last facing direction and using a timed frame sequence for each state. Use procedural transforms only for static art such as Geist and the bosses.
- **Verify:** Each source-sheet enemy visibly transitions from idle to walk to attack to hurt without beige tile backgrounds, frame popping, frozen screenshots, or reversed motion. Burden Imp’s chain animation must play during a chain hit.

### 2. Multi-lane encounter and stage-progress system

- **Why isolated:** A forward-moving brawler needs lane-based player movement, encounter gates, destructible objects, camera progress, enemy spawning, and boss transitions to remain coordinated.
- **Approach:** Retain the existing depth coordinate as a three-lane-friendly continuous plane. Add front-based progression to each level: an encounter begins, locks the screen’s advance until enemies are cleared, then releases the party toward the next front. Destructible crates and barrels occupy lanes, absorb hits, and drop health, stars, or magical companion rewards.
- **Verify:** Players can move both horizontally and vertically between lanes; clearing an encounter visibly opens the way to the next front. Striking a crate or barrel shows damage and a break state; collecting its reward changes health or Super charge.

### 3. Animated procedural boss behaviour

- **Why isolated:** Boss portraits have no supplied frame sheets, yet they must no longer feel like static cutouts.
- **Approach:** Give bosses readable stateful motion through walking bob and leg-sway transforms, attack anticipation, forward strike/cast thrusts, recoil/hit flash, death spin/fall, and per-boss projectile or summoning patterns.
- **Verify:** Every boss visibly moves while pursuing, telegraphs attacks before damage is applied, recoils when hit, and plays a distinct defeat animation before the next level begins.

## Main Build

The game will be converted from a single-screen skirmish into a staged, Golden Axe-inspired lane brawler while preserving its distinct characters and resilience theme. Each of the eight levels will use multiple short fronts before its boss, with a visible progression counter. The existing fox heroes retain their movement, jumps, charge shots, specials, kick, and male-only chain action. The missing roll input and touch-control defects remain part of the repair work.

The game will add destructible crates and barrels, reward drops, a magical companion encounter, lane-aware enemy pursuit, and staged enemy mixes. Ruminator, Worry Spore, and Burden Imp will use extracted supplied animation frames; Self-Doubt Geist will have programmed hover and cast motion. Bosses will use procedural animation around their supplied portraits.

- **Assets needed:** Transparent enemy frame strips derived from the supplied sheets; a wooden crate; a barrel; a small magical companion; a Super-star pickup; and an optimized Level 3 boss portrait.
- **Verify:**
  - Hero movement direction matches input and remains usable across the full lane depth.
  - Enemy animation direction and state match movement, attack, hit, and defeat events.
  - Players can break objects, receive drops, and visibly gain health or Super charge.
  - Combat fronts clear in sequence and transition into boss encounters without a stuck camera or soft lock.
  - HUD remains readable and control hints match keyboard and touch inputs.
  - No missing assets, screenshot-like frame backgrounds, console errors, or placeholder fallback art appear in the tested run.
  - The live scene aligns with `golden_lane_brawler_visual_target.png` in camera perspective, visual density, prop placement, and colour palette.
