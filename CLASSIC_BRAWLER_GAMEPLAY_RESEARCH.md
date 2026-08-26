# Classic Arcade Brawler Gameplay Research — Original Design Takeaways

## Scope

This research extracts **general gameplay and pacing principles** from Golden Axe, Double Dragon, and genre analysis. It does not authorize copying their characters, art, stage layouts, named mechanics, or specific encounter sequences. Every Sloane Fox event below must be thematically original and use the existing Sloane Fox characters.

## Research synthesis

Classic lane brawlers remain engaging because they mix a simple core fight loop with frequent changes in pressure and place. Golden Axe uses a multi-stage route, magic accumulation, optional moving targets that drop health or magic, temporary creature rides, different enemy habits, and occasional hazards. Double Dragon uses a continuous side-scrolling route, multiple combat techniques, enemy weapons that can be disarmed and used, breakable/throwable objects, environmental danger, transitions, and location changes. Genre guidance emphasizes that the pace depends on short distinct encounters, varied enemy constellations, weak enemies that fall quickly, short breathers after intensity, and memorable boss spaces rather than endless repeated waves.[1] [2] [3]

> **Implementation principle:** The player should regularly see, decide, act, collect, escape, or exploit something between fights. The action should never stall for a long puzzle or a copied set piece.

| Design lesson | Source pattern | Original Sloane Fox interpretation |
| --- | --- | --- |
| Continuous forward journey | Connected stages and quick transitions | A route card and short playable advance connect city spaces rather than stopping at a separate menu after every front. |
| Short encounter rhythm | Mixed groups with changing entry patterns | Nine fronts are recut into compact 20–35 second beats: street-side ambush, two-lane pincer, curb obstacle, power-run, holdout, clean-up, event, boss warning, boss. |
| Breakables as choice | Crates, barrels, and thrown objects | **Pressure cases**, **mental-load crates**, and **community noticeboards** can be hit for power banks, first aid, temporary safety, or a risk/reward nuisance. Existing character assets remain untouched. |
| Moving reward target | Magic/food targets that flee | A **Support Runner**—an original non-combat courier icon—briefly crosses a safe edge lane. A clean hit drops a power bank or aid pack; ignoring it does not fail the level. |
| Temporary alternative action | Mounts or equipment | Distinct short city actions: skateboard run, turnstile dash, park vault, forklift-switch crossing, motorbike escape. They are brief, grounded, and always return normal control safely. |
| Environmental risk | Pits, traps, traffic, narrow areas | Timed buses, nesting-magpie swoops, puddles, platform edges, forklift paths, and warning lights. Every danger has a warning, safe lane, modest damage, and no instant trap. |
| Different enemy behaviour | Pincers, running attacks, weapon carriers | Preserve the existing four pressure types but vary their role: Ruminator anchors a lane, Worry rushes, Geist fires from depth, Burden threatens a chain zone. The combinations—not a new roster—create the puzzle. |
| Breathers and payoff | Food/magic pauses and post-boss transitions | Small recovery cache, scenic transition, a short score burst, and a route reveal follow major intensity spikes. |
| Boss contrast | A distinct final challenge after a route | Each existing boss receives a stage-specific warning, arena dressing, one clear signature hazard, and a final Super/power decision—not a copied boss design. |

## Sloane Fox arcade rhythm

Each long level uses this original sequence:

1. **Arrival beat:** a 5–8 second environmental reveal with a readable location action.
2. **Three compact mixed encounters:** move forward after each clear; no excessive same-enemy walls.
3. **Opportunity beat:** a breakable, support runner, curb-side car, or temporary route choice.
4. **Signature event:** one short fair stage interaction.
5. **Pressure finale:** mixed hostile pattern plus a bank/health decision.
6. **Boss threshold:** warning, unique arena dressing, and existing boss confrontation.
7. **Release:** short route transition and recovery moment.

## References

[1]: https://gamefaqs.gamespot.com/genesis/563326-golden-axe/faqs/82327/gameplay-and-controls "Golden Axe — Gameplay & Controls guide"
[2]: https://en.wikipedia.org/wiki/Double_Dragon_(video_game) "Double Dragon (video game) — gameplay overview"
[3]: https://jiggeh.com/2022/06/03/so-what-makes-a-good-beat-em-up-anyway/ "So, what makes a good beat ’em up, anyway?"
[4]: https://racketboy.com/retro/beatem-ups-101-all-you-need-to-know-about-brawlers "Beat’em-Ups 101: All You Need to Know About Brawlers"
