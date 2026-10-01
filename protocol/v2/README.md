# viz.trace/v2

Status: implemented for the Rust SDK, local `/api/record` receiver, and the main workspace. The receiver persists v2 records as NDJSON; the workspace materializes snapshot/patch state per seq. Previously saved v1 traces are still readable in the workspace.

The [v3 draft](../v3/DRAFT.md) explores characters, collection semantics, and structural trees. It keeps operations out of the wire: the UI may infer candidates from successive observed values. The draft is not an implemented extension to this strict v2 schema.

## Record stream

A trace is UTF-8 NDJSON: one record per line. A WebSocket message may carry the same JSON object. Transport framing does not change the object. The [JSON Schema](trace.schema.json) checks individual records; [`validate.mjs`](validate.mjs) additionally checks stream invariants.

Every record has `format: "viz.trace/v2"`, a `runId`, a decimal-string `seq`, a `span` array, and a `kind`. `seq` is a contiguous unsigned 64-bit counter starting at `"0"` in each run. It orders both materialization and playback. `runId` isolates state, IDs, and source metadata across executions. A run starts with one `snapshot`; further records may be `patch` or full `snapshot` checkpoints. An empty `ops` array is valid: a `record!` call is still a visible observation even when no value changed.

| Field | Meaning |
| --- | --- |
| `span` | Typed scalar ID path. Exact path equality joins records into one logical group; a prefix is its parent. `[]` is the root. |
| `from` | Optional `seq` of an earlier record in the same run. It creates an explicit transition edge. Omission makes no transition claim. |
| `source` | Optional file, one-based line, and optional one-based column. It is metadata, never part of span identity. |
| `values` | On `snapshot`, the **complete materialized named state** after this observation. |
| `ops` | On `patch`, changes applied to the immediately preceding materialized state in `seq` order. |

`from` never changes the patch base. If seq 3 says `from: "0"`, seq 3's patch still applies to the state after seq 2. To compare endpoints of the edge, materialize seq 0 and seq 3 separately. An explicit transition can branch; it does not imply that a program rolled memory back to the source frame.

When a run contains any `from`, the default relation graph draws only those explicit record edges; records without `from` are unlinked roots. When a run has no `from`, the default graph creates nodes for each distinct span prefix and attaches each record to its exact span node. This fallback is a hierarchy view, not an inferred execution transition.

## State and value model

`snapshot.values` and `patch.ops` use stable variable names. A `put` replaces or creates one complete named value. A `drop` removes it; `null` is a present value and is not a drop. A name occurs at most once in a snapshot or patch. A patch can omit a variable, which means that its previous value remains visible. The first snapshot must contain every value known at seq 0; subsequent checkpoints must likewise contain the entire current state. Nested element patches are deliberately outside v2: a producer may replace an Array or Map value with one `put` and a receiver can still compute typed differences for display.

Values are tagged so large integers and non-string Map keys survive language boundaries:

| Tag | Payload | Notes |
| --- | --- | --- |
| `null` | none | Represents a present null value. |
| `bool` | JSON boolean `v` | |
| `int` | decimal-string `v` | Arbitrary precision. No JSON number conversion. |
| `float` | finite decimal-string `v` | Parsed as IEEE-754 binary64 for comparison; NaN and infinity are excluded. |
| `string` | JSON string `v` | Exact Unicode string; no implicit normalization. |
| `array` | ordered `items` | Matrix is an Array of Arrays. |
| `set` | `items` | Order does not matter; structurally duplicate members are invalid. |
| `map` | `entries` of typed scalar `key` and Value | Key order does not matter; duplicate typed keys are invalid. |
| `record` | named `fields` | Field order does not matter; duplicate names are invalid. |

Map keys in v2 are scalars. An Adapter can project a map with composite keys to an Array of key/value Records. `sourceType` is optional metadata such as `Vec<i64>`; renderers bind by protocol shape and variable name, not by a Rust type string. Unknown tags and fields require a new protocol version or an explicit extension, rather than silent interpretation.

## SDK and UI boundary

The user API stays language-specific and minimal, for example `record!([i, j], from: parent, a, mid, ok)` in Rust. The SDK or receiving adapter normalizes this to stable names and typed values. A call can list only the values being observed; the v2 writer maintains prior named state and emits a full snapshot or per-name puts. It must preserve a record even if all observed values equal their previous values. An explicit lifetime-end API would be needed to emit `drop`; the current `record!` API does not infer scope exit.

The wire contains no `binary_search`, `dfs`, `left` role, display format, color, or widget type. Algo View selection, variable-to-argument bindings, Array bars versus numbers, and table versus relation graph are workspace configuration. They can be changed without rewriting a trace.

## v1 migration

The existing v1 event has `format: "viz.trace/v1"`, `seq`, `span`, optional/null `from`, and an array of observed named `values`. It is a partial observation, even though each listed value is a snapshot. A v1-to-v2 bridge keeps `runId`, `seq`, `span`, and the typed values. It emits a v2 `snapshot` for seq 0, then a `patch` with `put` for every listed name in later events (possibly optimizing equal values to an empty `ops` array). It omits null `from`. Names absent from a v1 event remain in accumulated state. v1 does not carry deletion, so the bridge cannot invent `drop`.

Validate the [example stream](example.ndjson) with `node protocol/v2/validate.mjs`; pass another NDJSON path as its first argument. The validator enforces contiguous seq, an initial snapshot, earlier same-run `from`, unique names and collection keys, finite floats, and valid drops in addition to the JSON Schema.
