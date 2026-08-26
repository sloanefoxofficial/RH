# Structure — Sloane Fox: Stand Together

The existing single-file Canvas implementation will remain a portable static game, but its gameplay code will be organised around explicit data and state rather than one-off frame assumptions. This avoids a risky platform rewrite while allowing the supplied artwork to become real combat animation.

| System | Responsibility | Primary state |
| --- | --- | --- |
| Level fronts | Turns each level into several short encounters before its boss, controls the current front and whether forward movement is gated. | `frontIndex`, `frontsCleared`, `frontLocked` |
| Enemy animation | Selects a clean frame strip and state timing for the supplied Ruminator, Worry, and Burden source sheets. | `animState`, `animTime`, `animFacing`, `attackWindup`, `hurtTime` |
| Enemy AI | Moves enemies along the existing depth plane, selects a target, telegraphs attacks, and creates ranged or chain hit volumes. | `target`, `attackCd`, `attackWindup`, `chainSwing` |
| Boss motion | Adds procedural states to static boss portraits so they walk, wind up, strike or cast, recoil, and fall. | `motionState`, `motionTime`, `attackCd`, `deadTime` |
| Breakables | Spawns lane-aware crates and barrels, takes damage from player actions, and produces rewards. | `kind`, `hp`, `hitFlash`, `breakTime`, `lane` |
| Pickups | Represents health, Super stars, and the magical companion reward, including magnet/pickup feedback. | `kind`, `value`, `life`, `pulse` |
| Combat | Resolves bullets, kicks, chains, melee impact areas, enemy attacks, breakable impacts, and reward collection. | Existing projectile, player, enemy, and effect collections |
| Controls | Maps keyboard and touch inputs to semantic game actions, including the previously unreachable roll action. | `p1roll`, `p2roll` and touch `data-k` values |

The game will preserve the existing continuous depth coordinate (`z`) because it already supports moving up and down the battlefield. The conversion will make this spatial freedom legible through three named visual lanes and lane-positioned props rather than replacing it with rigid movement. The camera will advance in controlled increments after each front is cleared, creating the feeling of travelling through a level rather than surviving a single static screen.
