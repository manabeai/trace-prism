# Workspace component catalog

This catalog is the review surface for the selected **Chromatic index** design. The fixed-data mock is at `/?mock`; the main workspace at `/` now reads recorded runs. Each linked capture shows a state of the design mock, and the component source is [`DesignGalleryV2.tsx`](../src/DesignGalleryV2.tsx) with [`design-gallery-v2.css`](../src/design-gallery-v2.css). The live data implementation is [`LiveWorkspace.tsx`](../src/LiveWorkspace.tsx).

## Visual foundation

| Role | Token | Use |
| --- | --- | --- |
| Ground | `#F0F2FA` | Workspace behind the history surface |
| Surface | `#FFFFFF` | Trace grid, popovers, dialog |
| Ink | `#26314A` | Primary text |
| Muted ink | `#5F6D88` | Metadata and secondary controls |
| Seam | `#CDD5E8` | Pane and cell boundaries |
| Selection / Array | `#526DB6` | Current seq, interactive focus, Array mark |
| Set | `#A35443` | Set column mark |
| Map | `#527865` | Map column mark |
| Algo View | `#654F9B` | Configured view mark and projection |

Interface type is IBM Plex Sans Variable; IDs, source references, seq, and recorded values use IBM Plex Mono. Tabler icons identify actions and visualization modes. Kobalte supplies Dialog and Popover behavior; corvu supplies the resizable split panes.

## Components and review states

| Component | Behavior to inspect | Capture |
| --- | --- | --- |
| Workspace frame | Narrow left column, independent run list beneath value visibility and Algo Views | [Desktop table](design-mocks/index-v3-table.png) |
| Run history | Run selection changes the isolated record stream and resets selected seq | [Desktop table](design-mocks/index-v3-table.png) |
| Span history | Nested ID prefixes group records; current seq has its own selection rail | [Desktop table](design-mocks/index-v3-table.png) |
| Value column header | Current format icon and chevron sit inside the named value's header | [Format popover](design-mocks/index-v3-format-menu.png) |
| Format popover | Icon/name options choose the representation for one value column across every seq | [Format popover](design-mocks/index-v3-format-menu.png) |
| Algo View catalog | Icon/name boxes choose a visualization template | [Catalog dialog](design-mocks/index-v3-algo-catalog.png) |
| Algo View bindings | Every required argument shows a current binding and nearby compatible recorded names; a click assigns one | [Binding dialog](design-mocks/index-v3-bindings.png) |
| Algo View column | A configured visualization renders from each record's materialized values | [Desktop table](design-mocks/index-v3-table.png) |
| Transition graph | Explicit `from` references become record-to-record edges | [Linked graph](design-mocks/index-v3-from-graph.png) |
| Span hierarchy | Without `from`, span prefixes become nodes and records attach to their exact path | [Span graph](design-mocks/index-v3-span-graph.png) |
| Compact layout | On a narrow viewport the side sections precede the horizontally scrollable history | [Mobile view](design-mocks/index-v3-mobile.png) |

The value-format menu is local to a raw value column. The Algo View catalog is global to the run's workspace because adding a view creates a new seq-aligned column. Graph/Table changes only the presentation; neither operation changes the recorded trace. The [receive protocol](../protocol/v2/README.md) contains typed values, `span`, `seq`, and optional `from`; format choices and Algo View argument bindings remain UI configuration.
