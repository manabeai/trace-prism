# Raw Traceの階層と遷移、可視化Recipe

状態: 2026-09-30時点のProtocol/API設計経緯を残した文書。本文の `from` はFrameRefによるseq参照だけを前提としており、現在はID参照の `fromId` も実装済み。snapshot/patchを含む現行の仕様は [v2 Protocol](../protocol/v2/README.md) を参照。他言語SDKと汎用Recipeエンジンは未実装。

## 核心

コード側が送るのは、観測したデータと、それを整理するための**汎用的な構造情報**だけにする。`dfs`や`binary_search`というアルゴリズム種別、頂点の色や「この変数は訪問済み」という意味は送らない。

```text
通常のコード
  └─ 言語別SDK（Rustならrecord!([i,j], from: origin, u, seen)）
       └─ Raw Trace: run / seq / 名前付きの値 / 階層パス / 遷移元
            ├─ そのまま履歴表に表示
            └─ UI側のRecipeで変数を役割にbinding
                 └─ Graph / Tree / Arrayなどの可視化
```

`span`はイベントの所属先を示すIDの配列で、**配列の値が同じなら同じグループ、prefixが親**になる。`from`は実行の遷移元となる**観測イベントのID**である。この二つは独立している。`seq`は依然として全イベントの記録順であり、再生・patch適用の正本となる。

| 軸 | 型 | 役割 |
| --- | --- | --- |
| `seq` | run内の一意な単調ID | いつ観測したか。Frameの識別子にも使う |
| `span` | 型付きIDの配列 | どの階層に置くか。同じIDなら記録位置によらず同じグループ |
| `from` | 既存Frameの`seq`、任意 | どの観測から遷移したか。グラフの辺を作る |
| `values` | 名前と型付き値の列 | 現行SDKがそのFrameで観測したsnapshot |
| `ops` | snapshot / patch | 将来の差分圧縮用。現行wireにはまだ無い |

## 配列IDによる階層

たとえば二重ループで`[i, j]`を使う。UIは`[i]`を親グループ、`[i,j]`をその子として構築する。親を表す専用のopen/closeイベントや、`[i]`自体のFrameは不要である。

```text
span [2]
 ├─ span [2,0]   seq 17
 └─ span [2,1]   seq 18, seq 19
span [3]
 └─ span [3,0]   seq 20
```

`seq 18`と`seq 19`は同じspanに属していても別の観測である。どのコード位置から送られても`[2,1]`が後で再び現れたら同じ論理グループに入る。呼び出しインスタンスごとに分けたい場合は、呼び出し番号など一意な値をIDへ足す。つまり、この`span`は**論理的な階層キー**であり、RAIIの実行区間そのものではない。

二つの`for`が両方`i`で回り、どちらも`record!([i], ...)`を送れば、**同じiは同じグループになる**。これはIDの等価性から導く意図的な挙動である。二つのループを分けたい場合は、`[0, i]`と`[1, i]`のように名前空間になるIDを一段足す。二重ループなら`[0, i, j]`とすれば`[0, i]`の下に`j`を並べられる。

`record!`のコード位置はsource metadataとして別に保存できるが、デフォルトのspan identityには混ぜない。各`record!`の位置を自動でIDに加えると、同じ`[i,j]`へ二箇所から記録する際に別グループへ分裂し、「IDが同じなら同じグループ」に反する。将来、ソース位置での絞り込みやグルーピングをUIに追加しても、それはこの基本ルールを変えない派生表示とする。

セグメントは型を保つ。`2`と`"2"`を同一のIDにしない。wireでは整数を十進文字列付きのtagged valueにして、JavaScriptの安全整数範囲に依存しない。空配列`[]`はrunのrootである。UIで各階層を`i`、`j`、`再帰深さ`などと呼ぶ設定はRecipeに置き、IDにアルゴリズム名を強制しない。

## 遷移元のID

`from`は`span`の配列ではなく、**一つのFrame ID**を参照する。同じ`span`に複数Frameを入れられるため、`from: [2,1]`だとどれからの遷移か曖昧になるからである。Frame IDはSDKが発行する`seq`を使い、ユーザーが別の一意IDを全観測に付ける必要はない。

```json
{
  "format": "viz.trace/v1",
  "runId": "run-1790739000000-1234",
  "seq": "19",
  "span": [{"t":"int","v":"2"},{"t":"int","v":"1"}],
  "from": "17",
  "values": [{"name":"u","value":{"t":"int","v":"2"}}]
}
```

この例は現行wireの主要フィールドを示す。実際のRust SDKはソース位置、producer、実行プロセス情報も付ける。`seq 19`の観測が`seq 17`を遷移元として持つ。`seq 18`が途中にあっても、履歴の時系列は`17,18,19`のまま、グラフには`17 → 19`を描ける。別のFrameも`from: "17"`にすれば一つの状態から複数の枝が出る。

`from`は同一run内の**確定済みで現在より前のFrame**だけを指す。自分自身、未来、別runへの参照はエラーとする。この制約ならライブ表示で到着したprefixだけを使ってグラフを作れる。`from`がなければ辺は未指定であり、時系列で直前のFrameからの遷移だと勝手に断定しない。UIは時系列順の線を別の表現として重ねられる。

Frame単位の観測グラフは時系列方向にのみ辺を張る。`from`が一つなら各Frameの入次数は高々1で、形は分岐するforestに限られる。同じアルゴリズム上の頂点を再訪しても新しいFrameになる。頂点IDなどの**論理的な状態キー**でFrameをまとめて循環を描く機能は、Recipeの投影として別に定義する。`span`のIDとGraphの頂点IDも混同しない。

## SDK APIの形

Rust SDKで公開するマクロは`record!`一つとする。第1引数はspanのID配列、その直後に任意の`from: FrameRef`を置き、残りを記録する変数の列とする。次はRustでの記法である。

```rust
for i in 0..rows {
    for j in 0..cols {
        let origin = record!([i, j], u, seen);
        record!([i, j], from: origin, u, seen);
    }
}

// 式やフィールドは明示した表示名で記録する
record!([], current = state.current, heap = &heap);
```

二箇所の`record!`は完全に同じ`[i,j]`に所属する。`[i]`のFrameを別途作らなくても、UIはprefixのグループを構築できる。先頭の`0`のような固定IDは必須ではない。二つのループで同じ`[i]`が衝突し、分けたい場合だけ、`[0,i]`と`[1,i]`のように識別子を足す。

識別子`u`は表示名`"u"`とその時点の`&u`に展開する。マクロは対象をmoveせずに借用し、その呼び出し内でシリアライズする。`&heap`のような明示的な借用も受け付けるが、通常の変数には不要。識別子以外の式、別名で表示したい値、同名変数の衝突を避けたい値には`名前 = 式`を使う。各式は1回だけ評価し、同じFrameの観測として確定する。

`from`は必要な場合だけ、ID配列の直後に`from: origin`と書く。値の別名指定`name = expression`とは構文を分けてある。`from`という名前の変数を記録したい場合は`record!([i], from)`と書ける。`record!`は`FrameRef`を返す。`FrameRef`はrun内のFrame IDを指す軽いhandleで、元のRust値を借用し続けない。rootは第1引数を`[]`とする。後続の`step!`や別の`view!`を必須にしない。

ここにDFS用マクロはない。`i`、`j`、`u`は通常の変数であり、`span`のセグメントに何を使うか、`from`にどのhandleを渡すかもアルゴリズムに依存しない。既存コードに`parent`、`path`、`stack`などの値があれば、それらも普通の観測値として送れる。

### 言語別SDKとProtocolの境界

変数名の推定は**Rustの`record!`が提供する記法上の省略**であり、Protocolの機能ではない。SDK内部では全言語とも、`span`、任意の`from`、`(安定したキー, 値)`の列という同じ入力に正規化する。現行wireは名前付きsnapshotを送り、将来Entityのsnapshot/patchへ拡張する。変数名をソースから読めない言語でも、Protocolを変えずに実装できる。

```text
Rust        record!([i, j], from: origin, u, seen)
Python      viz.record([i, j], from_=origin, u=u, seen=seen)
TypeScript  viz.record([i, j], {u, seen}, {from: origin})
```

これらは各言語のSDK構文例であり、共通の関数シグネチャではない。Rustの識別子、Pythonのkeyword引数、TypeScriptのobject shorthandは同じ名前付き観測へ落とす。名前の取得にスタック解析や実行時のソース解析を要求しない。式や同名変数の区別が必要なら各SDKで明示キーを指定できるようにする。キーは同一runでどのEntityを継続観測するかを決めるため、単なる画面上のラベルとは分離して扱う。`FrameRef`もSDK上のhandleであり、Protocolではrun内のFrame IDへ変換する。

現行 `algo-vis` Rust crate はローカルCargoプロジェクトのdefault featureで有効になる。`node bin/traceprism.mjs serve`が起動していれば通常の`cargo run`からlocalhostへ送信し、同じソースを単体で提出するとfallbackマクロが空展開される。SDKは `viz.trace/v2` の最初のsnapshotと、その後の変更名に対するpatchを生成する。実際の設定と提出可能なサンプルは[README](../README.md)と[examples/abc007_c.rs](../examples/abc007_c.rs)を参照。

`from`が必要な箇所でhandleを関数に渡すのが重い場合は、後からスコープ内の次のFrameだけに遷移元を適用するguardを検討できる。ただし初期APIは明示的な`from: FrameRef`を基準とし、暗黙の「直前の同じspan」解決は導入しない。

## 将来のpatchとグラフの関係

既存のsnapshot + patchは**記録順のEntity状態**に対して適用する。`entity.patch.baseVersion`が指すのは、直前までMaterializerが保持していたそのEntityのversionであり、`from`先のFrameにおけるversionではない。`from`をpatchの基底にすると、兄弟分岐のあいだで更新された共有配列やSetを失う。

UIで辺を選んだときは、遷移元Frameと現在FrameをそれぞれMaterializeして値の差を計算する。その差は**二つの観測結果の差**であって、辺の内部で実行された操作列を証明するものではない。中間に別のFrameがあれば、その変更も含み得る。この区別を表示文言にも反映する。

## VisualizerのRecipe

Raw Traceにアルゴリズム名はない。VisualizerでRecipeを選び、変数を役割に割り当てる。同じtraceに違うRecipeを何度でも適用でき、Recipeを変更しても元のtraceは変わらない。

```json
{
  "id": "dfs-view",
  "bindings": {
    "graph": {"entity":"g","shape":"adjacency-list"},
    "current": {"entity":"u"},
    "visited": {"entity":"seen","mapping":"array-index-true"}
  },
  "spanLabels": ["outer", "inner"],
  "views": ["history", "graph", "transition-graph"]
}
```

Recipeは大きく三つの設定を持つ。**Binding**はEntity・field・index・scopeへの参照、**Projection**は`seen[i]`を頂点`i`の表示状態へ変換する規則、**View**は履歴表・元データのGraph・Frame遷移グラフ等の選択である。組み込みのアルゴリズムRecipeも、ユーザー定義Recipeも同じ仕組みで構成する。Trace内で任意のRecipeコードを自動実行しない。

別runにRecipeを適用するとき、Entity IDはrun固有なので、名前・構造・scopeから候補を提示し、bindingを検証する。同名候補が複数あれば自動確定しない。binding不足でもRaw Traceは再生できる。

`from`があればFrame間の遷移は正確に表示できる。一方、`g`・`u`・`seen`だけから「なぜこの頂点へ進んだか」「再帰の親はどれか」を一意に推定することはできない。正確な呼び出し経路まで必要なら、`from`を記録するか、元のコードが持つ`path`・`parent`・stackを通常の値として送る。Recipeが推定した辺は明示された`from`の辺と区別する。

## この案の判断点

1. 公開マクロは`record!`だけにする。第1引数がspan ID配列、後続は名前を推定する変数列。値を記録し、遷移元に使えるFrameRefを返す。span専用APIやSpanRefは作らない。
2. `span`はopen/closeを要する区間ではなく、**ID配列の完全一致とprefix**で作る論理階層にする。同じIDに任意個の観測を置ける。
3. `from`は階層パスではなくFrame IDを指す。これで遷移元を一意に決め、分岐を表せる。複数の入力が一つのFrameへ合流する表現は初期案の対象外とする。
4. `seq`は全観測の時系列、`from`は指定された遷移、Recipeは表示の解釈である。三者を独立させる。
5. 単独値も複数値も`record!`で採取する。アルゴリズム名やUIのroleはコードに書かない。

複数の遷移元を一つのFrameに持たせたい場合は、`from`を配列へ拡張するか、実行の遷移とデータ依存（DPの複数参照元）を別の関係として持つかを、実例で決める。初期案は実行の遷移元を一つに限定する。
