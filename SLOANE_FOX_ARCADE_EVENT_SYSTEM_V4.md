# Sloane Fox — Original Arcade Event System V4

## Arcade loop

The goal is not to reproduce any other game’s stages. The goal is to give Sloane Fox the same *kind* of forward momentum: a fight, a small surprise, a decision, a reward, a short breath, then a new kind of pressure. Every event is brief, readable, optional where possible, and grounded in the game’s theme of confronting everyday pressure.

| Beat | Player-facing event | Purpose | Failure state |
| --- | --- | --- | --- |
| **1. Arrival** | A location-specific animated environmental reveal. | Establishes mood and shows the level’s active hazard. | None. |
| **2. Street skirmish** | A quick mixed group enters from distinct lanes. | Teaches the current enemy combination. | Standard combat damage only. |
| **3. Breakable choice** | A **Pressure Case** or **Mental-Load Crate** is reachable during the fight. | Fire or kick it for a chance at first aid, a power bank, or a small risk event. | No reward if ignored. |
| **4. Support Runner** | A bright, original courier crosses an edge lane for 4 seconds. | A responsive moving target that drops one aid/power reward when hit. | It exits; no punishment. |
| **5. Threat beat** | A stage hazard has a warning then a short path: bus, magpie, platform signal, forklift, etc. | Makes the scenery part of gameplay. | Recoverable damage/knockback; no instant fail. |
| **6. Relief cache** | A low-pressure short window after a hard front. | Restores a little health and enough charge to make the next Super decision meaningful. | None. |
| **7. Signature moment** | Skateboard, turnstile dash, park vault, bridge switch, motorbike, or signal action. | Breaks combat rhythm for under two seconds and moves the route forward. | Prompt can be retried safely; control is always returned. |
| **8. Pressure finale** | The highest mixed enemy pattern plus curb-side hazard/breakable. | Tests crowd handling without an endless wall. | Standard combat damage only. |
| **9. Boss threshold** | Boss warning, a specific arena dressing, and a last power/health decision. | Makes the existing boss feel like the level conclusion. | Standard boss loss rules. |

## Original interaction kit

| System | Input | Visual role | Reward / consequence |
| --- | --- | --- | --- |
| **Pressure Case** | Fire or kick | A strapped city equipment case, never a copied crate. | 55% power bank, 30% first aid, 15% alarm ping that adds one weak Worry Spore. |
| **Support Runner** | Fire | A small original courier device with a reflective delivery vest colour and rolling pack. | Drops one marked power bank or first-aid kit, then exits. |
| **Community Board** | Fire | A noticeboard at the far edge with positive resilience cards. | Briefly slows new hostile spawning and adds a score bonus. |
| **Safe Lane Marker** | Movement / Jump | Flashing street/platform markers before environmental traffic. | Avoiding a hazard awards a small `SAFE MOVE` score burst. |
| **Curb-side car** | Fire | Existing roadside destructible. | Power drop and small local blast; avoid standing beside it. |
| **Set-piece control** | Prompted Fire / Jump / lane steering | Original city-route action. | Safe forward advance and guaranteed power bank. |

## Eight stage event identities

| Level | Place | Featured living events | Distinct set piece |
| --- | --- | --- | --- |
| Anxiety | Sunset Side Street | Bus pass, support runner, breakable Pressure Case. | Skateboard Rush. |
| Depression | Underground Station | Arrival signal, turnstile board, edge gust. | Platform Dash. |
| Toxic Relationship | Park Forest Path | Nest warning, magpie swoop, rain puddle. | Fallen Tree Vault. |
| Grief | Memorial Square | Candle-light board, slow fountain spray, quiet relief cache. | Puddle Run. |
| Hardship | Industrial Yard | Forklift beacon, moving pallet lane, heavy load crate. | Bridge Switch. |
| Financial Stress | Night Market Car Park | Parking barrier, flashing deal board, bus/taxi lane. | Barrier Dash. |
| Trauma | Emergency District | Light sweep, ambulance road marker, signal crate. | Motorbike Escape. |
| Death | Rail Bridge at Dawn | Rail signal, wind gust, final support cache. | Last Signal. |

## Difficulty rules

Each nine-front stage stays long by changing *situations*, not merely multiplying enemy health. Early fronts use one or two pressure types; later fronts add a pincer, ranged line, hazard timing, breakable decision, or recovery opportunity. Weak enemies remain quick to defeat. Heavy Burdens are used as deliberate anchors rather than filler. Bosses keep their existing art and roster, but gain stage-specific arena context.
