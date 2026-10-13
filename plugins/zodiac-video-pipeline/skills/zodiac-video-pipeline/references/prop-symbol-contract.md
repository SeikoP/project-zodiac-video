# Symbolic visuals — legacy compatibility note

This document is retained for links from existing releases. It must NOT be used to author new story symbols as props.

For new work, use the single canonical `narrative_visual` authoring category and follow
[story-object-contract.md](story-object-contract.md).

A narrative visual can be physical, abstract or symbolic. Its representation
does not create a separate role: use `presentation_mode` for this distinction.
A prop remains `interactive_prop` only when its primary purpose is physical
character interaction. An effect is a reaction accent, not a narrative metaphor.

Legacy `story_symbol`, `symbol_intent`, and authored symbolic props must
remain readable for existing packages; migration must preserve states, events,
scene-bound narrative meaning and lineage, without silent deletion.
