# Visual Review Proof — Corrected Build

The `review_proofs/` folder contains captured browser frames from the corrected build. Each named screenshot corresponds to a deterministic inspection URL documented below. These are supporting evidence only; the playable source remains `public/sloanefox.html`.

| Proof image | Inspection URL suffix | Visible requirement shown |
| --- | --- | --- |
| `walk_grounded_stride.webp` | `?demo&inspect=walk` | An existing Burden Imp labelled `WALKING`, with alternating visible legs and boots on the lane plane as it approaches the stationary hero. |
| `grenade_arc_blast.webp` | `?demo&inspect=grenade` | The first-tier `GRENADE` sequence with the labelled local blast presentation. |
| `rocket_launcher.webp` | `?demo&inspect=rocket` | The labelled `ROCKET LAUNCHER`, with a visibly large projectile and exhaust plume. |
| `airstrike_plane_five_bombs.webp` | `?demo&inspect=airstrike` | The labelled air-strike proof frame: large plane, wings, cockpit/tail silhouette, and five falling bombs with trails. |
| `city_tree_rope_swing.webp` | `?demo&inspect=setpiece` | The Level 1 `CITY ROPE SWING` card, city tree, rope, streetworks trench, and one on-rope hero traversal pose. |

## Verification summary

The final structural checks completed successfully using `validate_game.py`, `validate_finishing_pass.py`, and the extended `validate_arcade_city_expansion.py`. The two protected hero files were additionally checked by SHA-256 against the original supplied archive. The browser console returned no errors after standard title-flow play and the deterministic inspection scenes.
