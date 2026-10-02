# 値の差分と要素パス

差分は trace の wire format には含めない。`materialize` が各 seq の状態を復元した直後に、同じ実行内の直前の seq と比較して `Frame.deltas` を生成する。`from` は遷移グラフの辺を表すだけで、この比較基準は変えない。`Frame.changed` は `deltas` が空でない変数名から導出する。値が変わらない `put` や空の patch は履歴には残るが、変更として扱わない。

各変数の差分は `ValueChange[]` として保持する。変化の種類は `added`、`removed`、`updated`。`path` はその変数の値からの型付きパスで、以下のセグメントを使う。

| セグメント | 対象 | 同一性 |
| --- | --- | --- |
| `{ kind: 'index', index }` | Array の要素 | 0 始まりの位置 |
| `{ kind: 'member', value }` | Set の要素 | Value の型付き構造 |
| `{ kind: 'key', key }` | Map の値 | Scalar の型タグと値 |
| `{ kind: 'field', name }` | Record のフィールド | 名前 |

配列は位置ごとに再帰比較するため、要素の挿入で後続位置がずれた場合はそれぞれの位置に差分が出る。Set・Map・Record は列挙順を同一性に含めない。`int(1)` と `string("1")` は別の要素・キーとして扱う。数値の同一性は v2 の validator に合わせ、`int` は整数値、`float` は有限の binary64 値で判定する。変数全体の新規出現や削除、値の種別変更は空パス `[]` に記録する。最初の観測で付いた `added` は初期値の出現を表し、既存要素の変更を意味しない。

`framesWithChangeAt(frames, name, path)` で、指定要素に差分が関係した seq を抽出できる。指定パスと差分パスの接頭辞関係を使うため、親要素の置換や変数全体の追加も子要素の検索に一致する。描画側には `ValueFormat.render(value, changes)` で同じ差分を渡す。Array の Cells・Bars・Matrix と Set・Map・Record の表示は、この情報から現在表示中の要素を強調する。削除された要素は現在値の中に存在しないため、差分データには残るがセルとしては表示されない。今後の要素別フィルタはマスの CSS や DOM を調べず、この ViewModel の差分を参照する。

差分は観測された二状態の構造比較であり、`push`、`swap` など実際に呼ばれた操作の記録ではない。途中で打ち消された変更は復元できない。対応する Value 種別を増やすときは `trace/diff.ts` の構造比較・パス定義を更新し、表示形式は必要なパスを参照する。
