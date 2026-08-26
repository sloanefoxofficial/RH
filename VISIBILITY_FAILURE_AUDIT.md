# Delivered-Build Visibility Failure Audit

The user feedback is accurate: the previous implementation contained logic for routes, Super tiers, crossings, and enemy movement, but several features did not communicate their purpose strongly enough during play.

| Requirement | Why the delivered build did not satisfy it visibly | Required correction |
| --- | --- | --- |
| Enemies walk toward the player | Existing enemies changed world position but used static cut-out artwork with only a three-pixel side shift. Ranged types stopped too far away. | Add visible alternating leg/boot motion and stride/lean, keep feet grounded, bring ranged enemies much closer before firing, and emit clear footfall feedback. |
| Grenade versus rocket launcher versus air strike | Effects existed but moved and resolved too quickly, and their scale was not sufficiently distinct. | Slow and enlarge each sequence; show explicit effect labels; use small, local grenade effects; a long, large rocket; and a screen-dominating aircraft plus several visibly falling bombs. |
| Air strike | The aircraft silhouette was too small and only on-screen briefly. Bombs were not obvious in ordinary play. | Render a larger 16-bit aircraft with wings, cockpit, fuselage, tail, and bomb-bay release; lengthen bomb travel and explosion hold. |
| Longer levels | Five fronts were still insufficiently long for the requested arcade journey. | Expand to seven combat fronts, maintain regular power rewards, and place the level set piece after the third front. |
| Level-specific special action | The crossing ran as a small in-canvas state with a brief banner, making it easy to miss and not feel like a gate. | Create a visibly gated set-piece state with a large on-screen title, environmental drawing, clear control prompt, hero traversal motion, and a reward before the route resumes. |

## Acceptance criteria

A tester must be able to identify all of the following from the screen alone: enemy stride, feet on the lane, grenade arc and local blast, rocket body and exhaust, aircraft profile, falling bomb trail, seven-front counter, and a large Level 1 rope-swing gate. A test run should not rely on reading documentation to discover any of these features.
