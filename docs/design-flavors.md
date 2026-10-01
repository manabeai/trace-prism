# Workspace design candidates

Status: C was selected. A and B remain as comparison history; the fixed-data C mock is at `/?mock`, and the live workspace is at `/`.

## Fixed information architecture

```text
┌───────────────────┬──────────────────────────────────────────────┐
│ Display columns   │ Selected run / span-grouped value history   │
│ Algo views + add  │                                              │
│                   │                                              │
├───────────────────┤                                              │
│ Run history       │                                              │
└───────────────────┴──────────────────────────────────────────────┘
```

The selected run determines the trace. The column controls affect the raw value history. An Algo View is an optional projection configured in the UI by binding recorded values to named arguments; it does not alter the trace or require algorithm semantics in user code. Span groups use the recorded ID path, not source position. Every direction uses the same content and interaction structure, while layout density and the position of the selected-value projection vary.

## A — Specimen sheet

- **Color:** canvas `#EDF2EF`, surface `#FBFDFB`, ink `#17312F`, secondary `#627B77`, seam `#C7D5D0`, active `#157B78`.
- **Type:** `Adwaita Sans` / `Noto Sans CJK JP` for interface; `Adwaita Mono` for IDs and values. Main heading 24/30, section heading 14/20, data 12/18.
- **Layout:** restrained table with quiet alternating span bands, left tree indentation, and one continuous active rail. The main history, not a hero banner, is the visual anchor.
- **Principle:** visually distinguish grouping from selection: span uses surface bands, selected seq uses the active rail.

## B — Instrument desk

- **Color:** chassis `#132533`, panel `#1B3342`, recess `#10202C`, text `#E7F1F2`, seam `#36505B`, signal `#E7AC70`.
- **Type:** `Cantarell` / `Noto Sans CJK JP` for controls; `Adwaita Mono` for trace data and `3270 Nerd Font` for the display heading. Main heading 25/30, section heading 14/20, data 12/18.
- **Layout:** selected-value projection sits in a dedicated right-side instrument panel with seq/span/from readout. The trace stays in a dense measurement lane at left, and the current frame is the single warm signal.
- **Principle:** evoke an instrument that measures execution state, without a generic neon terminal palette or gratuitous glow.

## C — Chromatic index

- **Color:** ground `#F0F2FA`, surface `#FFFFFF`, ink `#26314A`, secondary `#6A7690`, seam `#CDD5E8`, array `#526DB6`, set `#BB705B`, map `#688779`.
- **Type:** `Nimbus Sans Narrow` / `Noto Sans CJK JP` for denser navigation; `Adwaita Mono` for keys and values. Main heading 26/30, section heading 14/19, data 12/18.
- **Layout:** a denser continuous grid where data types carry restrained color keys. Span grouping uses nesting and edge markers; value columns have more visual identity than in A/B.
- **Principle:** color is an indexing system for comparing data structures, not ambient decoration.

## Review before implementation

A initially looked too close to a generic white dashboard; the long continuous history table and structural span rail replace card rows. B initially risked the common black-plus-neon look; the blue-green chassis and warm amber selection avoid that. C initially risked a set of pastel SaaS cards; its color is restricted to data type markers and selected cell states, while the trace remains a continuous grid. Across all three, there are no numbered ornamental labels, gradient washes, or tab bars.

The initial three-way comparison used corvu Resizable and Dialog. In the selected C implementation, Kobalte owns Dialog and Popover, while corvu remains for the resizable split panes.

## Selected direction: C, revised for data and algorithm projections

The comparison resolved on Chromatic index. The current mock uses its ground `#F0F2FA`, surface `#FFFFFF`, ink `#26314A`, seam `#CDD5E8`, array blue `#526DB6`, and set coral `#A35443`. IBM Plex Sans Variable carries the interface; IBM Plex Mono carries values, paths, and seq.

```text
┌────────────────────────┬────────────────────────────────────────────────────┐
│ Recorded values        │ Run / count                 Table | Relation graph │
│ visibility             │                                                    │
│                        │ table: span groups + seq rows + value/view columns │
│ Algo Views + bindings  │ graph: from edges OR span-prefix edges + seq nodes │
├────────────────────────┤                                                    │
│ Run history            │ selected seq / playback                            │
└────────────────────────┴────────────────────────────────────────────────────┘
```

Algo Views are reusable, algorithm-specific renderers bound to ordinary recorded values in the UI. Adding one appends a column, and every seq gets its own rendering from that frame's values. The sample includes a binary-search view and a grid-position view. The raw value columns independently choose render formats; an Array may be numbers or magnitude bars. The graph is an alternate representation of the whole selected run, so the highlighted seq remains synchronized with the table and playback. With valid `from` references, graph edges are `from → seq`. Without `from`, span prefix nodes form the tree and each record hangs from its exact span path.

The distinctive move is the paired representation of the same observation: typed columns support comparison across time, while the relation graph exposes parentage. The interface avoids an algorithm-specific trace protocol: algorithms live in optional UI views and their bindings, not in recorded frame semantics.

## C refinement: compact navigation and local controls

The sidebar is approximately 15% of a 1440px viewport. It only toggles visible value and Algo View columns above the independent run list. Each value column header contains an icon for its active display format; Kobalte Popover presents icon/name choices at that point of use. The Algo View flow opens a Kobalte Dialog with icon/name cards, then shows every required input beside clickable recorded-variable candidates of the correct protocol shape. IBM Plex Sans Variable replaces the condensed display face, and IBM Plex Mono carries seq, source, IDs, and values. Tabler icons mark actions and view choices. The UI copy is English.
