# viz.trace/v3 — value and structural model (draft)

Status: design proposal. The current Rust SDK, receiver, validator, and workspace implement [`viz.trace/v2`](../v2/README.md). They do **not** accept the examples below yet. v3 uses a new `format` identifier because the v2 schema rejects unknown tags and fields. Existing v2 traces remain valid v2 traces; a future reader should support both versions.

## What a record says

Keep the v2 envelope: `runId`, contiguous decimal-string `seq`, `span`, optional `from`, and `snapshot`/`patch`. `span` is grouping identity. `from` is a directed edge to an earlier record. Neither determines the state against which a patch is applied: materialization always proceeds in `seq` order.

The wire records observations, not operations:

| Layer | Question | Contract |
| --- | --- | --- |
| `values` / `ops` | What values are observable after this record? | Complete snapshot, or `put`/`drop` against the immediately previous `seq`. |
| UI-derived diff | What changed between two observed values? | Derived from consecutive materialized states; not a statement about the program's methods. |
| UI-derived operation candidate | Which familiar operation could explain that change? | Heuristic interpretation only; never a trace fact. |

There is no `actions`, `operation`, or `cause` field in the trace. The UI compares the materialized states at `seq - 1` and `seq`. An explicit `from` edge is independent of that chronological comparison; a graph view may also compare the values at the edge endpoints, but it must label that comparison separately. No inference reconstructs unobserved intermediate states.

## Value algebra

Retain `null`, `bool`, decimal-string `int`, `float`, `string`, `array`, `set`, `map`, and `record` from v2. Add `char` and structural trees. A `sourceType` such as `VecDeque<i32>` is diagnostic metadata, not the wire type or a renderer instruction.

| Value | v3 contract |
| --- | --- |
| `char` | `{ "t": "char", "v": "x" }`; exactly one Unicode scalar value. This is distinct from a one-character `string`. Languages without a character type may emit `string`. |
| `string` | Arbitrary Unicode string; no normalization. |
| `int` | Canonical signed decimal string of arbitrary precision. |
| `float` | Binary floating-point value as a round-trippable decimal string; optional `width: 32 | 64` identifies the source precision, default 64. Preserve `-0`. Permit `"nan"`, `"+inf"`, `"-inf"` as explicit non-finite values; do not silently turn them into `null`. NaN payload bits are outside this protocol. |
| `array` | Ordered `items`. Nested arrays express a matrix without asserting that it is rectangular. Optional sequence semantics described below. |
| `set` | Unordered, structurally unique `items`. Iteration order is not an identity or operation history. |
| `map` | Unordered `entries`; v3 keys may be any Value, including tuples represented as arrays or records. Duplicate keys under typed structural equality are invalid. SDK adapters may be required when a host serializer cannot encode a composite key. |
| `record` | Named fields; suitable for user structs and individual tree nodes. |
| `tree` | Explicit, stable scalar node IDs, ordered child IDs, root IDs, and a `record` of fields per node. Supports arbitrary rooted trees. |
| `binary_tree` | Compact complete binary tree with implicit heap-indexed links and one `record` per node. Suitable for segment trees, including lazy propagation state. |

Typed structural equality distinguishes `char("1")`, `string("1")`, and `int(1)`. For floats it preserves negative zero in values; collection-key equality and NaN handling need a single canonical rule in the v3 validator before implementation. Map and Set order are presentation-neutral and must not create false changes when a hash iteration order varies.

### Sequence semantics

An ordinary array remains `{ "t": "array", "items": [...] }`. An adapter may attach `semantics` to describe the *source structure* without selecting a UI widget:

```json
{ "t": "array", "semantics": { "kind": "queue", "front": "first" }, "items": [] }
{ "t": "array", "semantics": { "kind": "stack", "top": "last" }, "items": [] }
{ "t": "array", "semantics": { "kind": "priority_queue", "layout": "binary_heap" }, "items": [] }
```

`vector`, `deque`, `queue`, `stack`, and `priority_queue` are initial semantic kinds. This metadata describes the observed structure; it does **not** say which methods were called. Queue items are in logical front-to-back order. A `binary_heap` stores the actual heap-array order: for zero-based index `i`, its children are `2i+1` and `2i+2`. This is **not** priority-sorted order. Priority direction (`min`, `max`, or custom) is optional adapter-supplied metadata; a type name alone must not assert it. The default renderer can still display any of these as an array. Other renderers can use the semantics to display front, top, or heap levels.

An optional `itemIds` array, with one stable scalar ID per item, allows duplicate equal values to retain identity across movement. It is omitted for ordinary containers whose elements have no stable IDs. Position alone is then the only identity, so a diff cannot prove which duplicate moved.

### Trees

An explicit tree can encode irregular or sparse structure:

```json
{
  "t": "tree",
  "roots": [{ "t": "int", "v": "1" }],
  "nodes": [
    { "id": { "t": "int", "v": "1" },
      "children": [{ "t": "int", "v": "2" }, { "t": "int", "v": "3" }],
      "value": { "t": "record", "fields": [
        { "name": "aggregate", "value": { "t": "int", "v": "9" } },
        { "name": "lazy", "value": { "t": "int", "v": "2" } }
      ] } }
  ]
}
```

Node IDs must be unique and stable across observations. Every child ID must exist, each node has at most one parent, roots have none, and cycles are invalid. The example is abbreviated; a complete value would include nodes 2 and 3. Node fields have no algorithm-specific reserved names. A segment-tree adapter may put `aggregate`, `lazy`, and an interval in those fields, but the protocol only knows that they are values on a tree node.

For a complete binary tree, avoid transmitting child links:

```json
{
  "t": "binary_tree",
  "logicalLeaves": "3",
  "capacity": "4",
  "nodes": [
    { "t": "record", "fields": [{ "name": "aggregate", "value": { "t": "int", "v": "9" } }, { "name": "lazy", "value": { "t": "null" } }] }
  ]
}
```

The example `nodes` is abbreviated. A valid value has exactly `2 * capacity - 1` records. `capacity` is a positive power of two and `0 <= logicalLeaves <= capacity`. `nodes[0]` is node ID 1, with child IDs `2i` and `2i+1`; leaves have IDs `capacity` through `2 * capacity - 1`. The padded leaves still occupy nodes. Node fields may include a half-open range if the producer knows it. This does not prescribe whether a lazy tag has been pushed or what a monoid means; it exposes the actual state supplied by an adapter.

A custom lazy segment tree cannot generally be reconstructed from a serializer of its root object. An SDK adapter/projection must inspect its data and lazy arrays (or public accessors) and emit one of these structural values. In Rust, the existing `record!([i], seg = projection(&seg))` form leaves the algorithm code largely unchanged. The projection is data-structure-specific, not algorithm-specific.

## Derived changes and operation candidates

`patch.ops` means whole named-value replacement/removal. It never means an array push or map insertion. After materialization, the ViewModel derives changes from two consecutive observations of the same named value. It may then produce *candidate* operation labels. This derived data is not written back into the trace.

| Before → after | Certain observation | Possible UI wording |
| --- | --- | --- |
| `[1, 2] → [1, 2, 3]` | One suffix item appeared. | “Append-like change”; `push` is a candidate, not a fact. |
| `[a, b] → [b, a]` | Positions 0 and 1 changed. | “Swap-like change”; two assignments are equally possible. |
| Queue `[a, b] → [b, c]` | First item disappeared and last item appeared. | “Front removal + back addition”; order and number of actual calls are unknown. |
| Heap array `[9, 6, 7] → [10, 9, 7, 6]` | Item multiset gained 10; several positions changed. | “Insertion-like heap change”; no claim about internal sift steps. |
| Set `{a} → {a, b}` | Member `b` appeared. | “Added member”; not proof that `insert` was called once. |
| Map `{k: 1} → {k: 2}` | The value at key `k` changed. | “Key updated”; not proof of a specific Map API call. |

The exact diff is the primary output. Candidate labels can be ranked by structural fit but must remain explicitly marked as inferred. If several explanations fit equally well, show the diff without picking one. If intermediate changes cancel out, the observations cannot reveal them. If equal items repeat and no `itemIds` are present, movement of individual items is ambiguous. If a collection is first observed at the current record, there is no earlier observed value for a delta. A heap's internal sift cannot be reconstructed step by step unless the program records its intermediate states.

This policy applies even when a collection carries `semantics.kind`: knowing that a value is a queue or priority queue constrains plausible explanations, but does not reveal which operations ran. The SDK does not instrument standard container methods. The public user-facing API remains `record!` with values and optional `from` only.

## Size and compatibility

v3 keeps whole named-value `put` as the first implementation step; this is enough for correctness and for moderate trees. Re-recording a large segment tree at every step is O(tree size) per observation. Element/node patches and periodic checkpoints are an independent later optimization, with the same materialized value semantics. They are state compression, not operation capture.

The first implementation milestone should validate and display `char`, sequence semantics, and tree values, while retaining v2 playback. Operation-like explanations belong solely to the ViewModel and must retain their inferred status.
