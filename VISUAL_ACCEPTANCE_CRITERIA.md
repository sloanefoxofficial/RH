# Corrected Arcade Presentation Acceptance Criteria

## Enemy approach

Every existing minor enemy must visibly alternate two grounded foot positions while its body leans forward and advances. The feet must touch the lane shadow. Ranged variants may still attack at range, but must first close to a clearly visible medium distance. A small step-dust chip and the name/health bar should move with the actor, making its direction of travel obvious.

## Three Super tiers

| Tier | Visible sequence required | Minimum screen time |
| --- | --- | --- |
| **Grenade** | `GRENADE` label, arcing projectile, glowing fuse/trail, local orange blast ring, small shake, warm flash. | 0.85 seconds from launch to aftermath. |
| **Rocket Launcher** | `ROCKET LAUNCHER` label, large launcher-body rocket, flame/exhaust trail across the lane, wide red-orange impact, stronger shake, red flash. | 1.15 seconds from launch to impact. |
| **Air Strike** | `AIR STRIKE` radio call, large plane with distinct wings, cockpit, and tail crossing the top half of screen, five large falling bombs with yellow trails, staggered ground detonations, maximum shake, and gold-white flash. | 3.2 seconds from call to final detonation. |

## Route and level events

Each level must show a **seven-front** counter. After Front 3 is cleared, the route cannot continue until the player completes the level-specific set piece. The full screen must show the event title, control cue, physical obstacle, a short traversal animation, and a power-bank reward.

For Level 1, the city-tree rope swing must show the tree, rope, broken street trench, and a hero movement along the rope to the far side. Later levels must use their own distinct physical obstacle and control cue, selected from the existing crossing list.

## Review URLs

The build will expose separate deterministic inspection URLs: `?demo&inspect=walk`, `?demo&inspect=grenade`, `?demo&inspect=rocket`, `?demo&inspect=airstrike`, and `?demo&inspect=setpiece`. These will stop at, or repeat, the relevant moment rather than fast-forwarding past it.
