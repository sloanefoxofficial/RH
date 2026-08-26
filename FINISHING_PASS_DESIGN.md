# 16-bit Arcade Finishing Pass

## Creative guardrails

Every existing hero, recurring enemy, boss, and asset remains present and unchanged. The additions below are **systems**, timed events, non-character street interactions, effects, and rewards. They make the existing roster feel less repetitive and make each level build toward the hardship boss already assigned to it.

| Addition | Arcade purpose | Story meaning | Roster impact |
| --- | --- | --- | --- |
| **Racing Thoughts** surge | A brief reinforcement pulse enters from both sides after the fight begins. | Daily pressures rarely arrive one at a time. | Uses only the existing small enemies. |
| **Hold the Line** front | A front releases small waves over a short interval instead of presenting one static group. | Staying present when pressure keeps coming. | Uses only the existing small enemies. |
| **Breakthrough** front | A denser final front has a visible reward cache after it is cleared. | The player creates space to move forward. | Uses existing crate/barrel and pickups. |
| **Resolve streak** | Consecutive quick defeats build a short Focus state, boosting score and making pickups more meaningful. | Small wins build momentum. | No character change. |
| **Resilience cache** | A clearly marked crate/barrel reward appears after a notable clear. | Support and recovery are part of moving forward. | Existing props; health/power rewards only. |
| **Boss warning surge** | Before a boss entry, a short final thought-wave announces the incoming hardship. | The pressure rises before the main confrontation. | Existing small enemies and the existing boss. |
| **Boss escalation** | At around half health, each current boss receives a visible escalation banner and faster existing patterns. | Hardships can intensify, but are still manageable. | No visual, roster, or narrative replacement. |

## Front rhythm

Each level continues to have three fronts and then its established boss. The fronts now rotate by level through **Racing Thoughts**, **Hold the Line**, and **Breakthrough**, so the player must respond to changing pacing rather than simply clear three similarly shaped groups.

The level remains a side-scrolling, grounded 16-bit lane-brawler. Screen banners, curb-level effects, short camera shake, and score popups provide the arcade feedback; neither the heroes nor the existing enemies are moved out of the common ground plane.

## Verification criteria

The finished pass must visibly demonstrate a surge banner, a multi-wave hold, a reward-cache moment, Resolve/Focussed feedback, a boss-warning moment, and a boss escalation banner. The automated `?demo` mode will be used to show the first level’s complete rhythm. Hero asset hashes and all existing roster declarations will be checked before packaging.
