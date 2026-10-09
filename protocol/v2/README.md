# viz.trace/v2

Rust SDKが書き出し、Tauriアプリが読み取るNDJSON形式。1行が1回の `record!` に対応する。[JSON Schema](trace.schema.json)が各行の形を、[`validate.mjs`](validate.mjs)が実行全体の整合性を検証する。既存のv1記録もWorkspaceで読み込める。[v3草案](../v3/DRAFT.md)は未実装であり、この形式の要件ではない。

## 記録とID

各行には `format: "viz.trace/v2"`、`runId`、`seq`、`span`、`kind` が必要。`seq` は実行ごとに `"0"` から始まる連続した十進文字列のu64で、状態復元とTable再生の唯一の順序になる。実行は必ず `snapshot` で始まり、以後は `patch` または完全な `snapshot` を送れる。値が変わらなくても空の `ops` を持つ記録を残せる。

| フィールド | 意味 |
| --- | --- |
| `span` | 型付きスカラーのIDパス。完全一致するIDは同じ論理グループ。接頭辞が親。`[]` はroot。 |
| `fromId` | 任意の親IDパス。以前の記録の `span` と型まで一致させる。同じIDが複数回記録された場合は、対象より前の最新の記録へ結ぶ。 |
| `from` | 互換用のseq参照。同一実行の以前の記録を直接指定する。SDKの `FrameRef` がこれに対応する。 |
| `source` | 任意のファイル名、1始まりの行番号・列番号。IDには含めない。 |
| `values` | `snapshot` 時点の名前付き値の完全な状態。 |
| `ops` | `patch` の操作。直前のseqの状態へ適用する。 |

`fromId` と `from` は同じ記録に同時指定できない。どちらもpatchの適用元を変えず、Graphに描く依存辺だけを指定する。例えばseq 3がseq 0を親にしても、seq 3のpatchはseq 2までの状態へ適用する。`fromId` は同じ実行で以前に観測されたIDだけを参照できる。未解決の外部IDを辺として推測しない。

ID比較では型を維持し、数値の表記差は正規化する。例えば `int: "-0"` と `int: "0"`、`float: "1e0"` と `float: "1.0"` はそれぞれ同一IDだが、整数と浮動小数点数は別IDとなる。

Graphは `fromId` または `from` が一つでもあれば、これらの依存辺を初期表示する。**ID tree** へ切り替えると、span IDを一意なノードにまとめ、接頭辞による木を描く。`span: [v]` の記録だけなら、rootの直下に各 `v` が並ぶ。**From links** で依存辺へ戻せる。Tableは常にseqに従って状態を復元し、同じspan IDの記録は一つのグループへまとめる。Graphの表示切替はtraceを書き換えない。

## 値と差分

`snapshot.values` は名前付き値の全量。`patch.ops` の `put` は一つの名前を追加・置換し、`drop` は削除する。`null` は値として存在する状態であり、削除ではない。patchに載らない名前は直前の状態から引き継ぐ。ネストした要素へのwire上のpatchはv2では扱わず、ArrayやMapも一つの `put` で置換できる。表示側は復元後の値から要素単位の差分を計算する。

値は型付きタグで表す。

| タグ | 内容 |
| --- | --- |
| `null` | null値 |
| `bool` | JSONの真偽値 `v` |
| `int` | 十進文字列 `v`。大きな整数の精度を維持する |
| `float` | 有限数の十進文字列 `v` |
| `string` | 文字列 `v` |
| `array` | 順序付きの `items`。Matrixや隣接リストもArrayの組合せ |
| `set` | 順序に意味のない `items` |
| `map` | 型付きスカラー `key` と値の `entries` |
| `record` | 名前付き `fields` |

Mapのキーはスカラーに限定する。複合キーはAdapterでArray等へ射影できる。`sourceType` は `Vec<i64>` のような元言語の型名を残す任意のメタデータであり、Protocolの型判定には使わない。

## SDKとの対応

Rustでは `record!([v], from: u, adjacency, seen, v)` の `from: u` を型付きの `fromId: [u]` に変換する。複数セグメントなら `record!([i, j], from: [pi, pj], ...)` と書ける。従来の `let parent = record!(...); record!(..., from: parent, ...)` は `FrameRef` を `from` のseqとして送る。いずれも公開マクロは `record!` だけで、Graphの描き方やアルゴリズム名をコード側へ埋め込まない。他言語SDKも、同じ型付きIDパスへ正規化すればよい。

v1形式は観測した値だけを載せる部分更新として読み込む。v2へ変換するときは最初の記録を `snapshot`、以後を名前ごとの `put` を持つ `patch` とし、指定のない値を引き継ぐ。v1に削除情報はないため `drop` を推測しない。

検証例:

```sh
node protocol/v2/validate.mjs protocol/v2/example.ndjson
```

validatorはseqの連続性、同一実行の過去の `from`・`fromId`、値名やMapキーの重複、有限のfloat、存在しない値の `drop` を検査する。
