# SDKの記述体験とWeb Workspaceのデザイン

状態: レビュー用のデザイン案。2026-09-28。アプリケーション実装には着手していない。

追記（2026-09-29）: 本案を確認するためのSolidJS + Dockview操作モックを追加した。起動方法・確認可能な操作・仮定は [README](../README.md) に記載。以下のAPIとProtocolは引き続き提案段階であり、SDK本体の実装ではない。

設計の順序を **コードへの追記 → 記録される一場面 → 画面での読み取り → 再生操作** とする。まず二分探索・DFS・DPでこの体験を確かめてから、Protocolと実装を確定する。

## 1. 体験の基準

- アルゴリズム本体は普通のRustで書く。可視化のためにコンテナを置き換えない。
- 追加コードから「何を記録し、どこを指し、いつ一場面として見せるか」が読める。
- 画面では、現在値と直前の観測からの変化を同時に把握できる。
- ArrayとGraphなどを並べても、全Widgetは同じ再生cursorに従う。
- 再生を戻したとき、データ・装飾・scope・記録地点が揃って戻る。
- デフォルト配置だけで使い始められ、必要になったらWorkspaceを組み替えられる。

## 2. コードに追記するAPI

### 2.1 最初に覚えるもの

以下は提案する構文であり、実装済みAPIではない。

| API | ユーザーから見た意味 | 例 |
| --- | --- | --- |
| `view!` | この値を観測する | `viz::view!("a", &a)` |
| `vars!` | 複数の変数を名前付きで観測する | `viz::vars!(l, r, mid)` |
| `mark!` | この位置を指す | `viz::mark!("mid", mid, on: "a")` |
| `range!` | この半開区間を示す | `viz::range!("search", l..r, on: "a")` |
| `step!` | ここを一つの再生停止点にする | `viz::step!("比較")` |

名前はユーザーが継続して観測したい対象のkeyとする。同じ `view!("a", ...)` は同じ表示対象を更新し、毎回新しいPanelを作らない。`view!` の返すhandleでも参照できるようにする。

`mark!("mid", mid)` のように `on` がなければ、midを名前付きscalarとしてVariablesに表示する。配列のpointerにしたいときは対象を指定する。対象を暗黙の「直前のview」にすると、コードの並べ替えやWidgetの追加で意味が変わるため採用しない。

`view!` はその場で読む。最初に一度呼んだだけで、その後の変更を自動追跡するAPIにはしない。静的な配列は一度だけ、変更する配列は見たい位置で再度呼ぶ。

### 2.2 stepの二つの記法候補

**A. 採取してから確定する記法を基本案とする。** 既存コードのブロック構造を保ったまま追記できる。

```rust
viz::view!("a", &a);
viz::mark!("mid", mid, on: "a");
viz::range!("search", l..r, on: "a");
viz::step!("比較");
```

この `step!` で三つの観測が一度に画面へ反映される。「比較」は採取済みの値に付くlabelである。提示された初期イメージから、`step!` の位置だけを末尾に変える案になる。

**B. 観測をブロックにまとめる記法も候補とする。** 記録範囲を目で追いやすい。

```rust
viz::step!("比較", {
    viz::view!("a", &a);
    viz::mark!("mid", mid, on: "a");
    viz::range!("search", l..r, on: "a");
});
```

Bを採る場合、ブロックは観測コードのまとまりとし、アルゴリズム本体を包む必要はない。まず基本記法を一つ選び、初期リリースで両方を必須にしない。本書の以降の例と画面案はAを仮定する。

`step!` を先頭に置き、次の `step!` までを自動でまとめる案には、一つ前のstepを次のstepまで送れない問題と、return・再帰境界の扱いがある。即時の確定点を明示できるAかBを優先する。

### 2.3 補助API

| API | 用途 |
| --- | --- |
| `span!` | ループや再帰の実行区間を階層化する |
| `highlight!` | 読み元、更新先、確定済み要素などを明示する |
| `note!` | そのstepに説明を添える |
| `log!` | Timelineと対応するテキスト記録を残す |
| `via:` | matrix・隣接リスト・自作型の解釈を指定する |
| `scope: local` | 再帰呼び出しごとにローカル値を分離する |

spanは明示的にguardを保持する。

```rust
let _call = viz::span!("dfs({u})");
```

guardの生存期間が実行区間になる。guardは元のデータを借用し続けない。`span!(...);` 単独で一時値を即座に破棄してしまう書き方は診断する。各呼び出しを別IDで記録するため、同名の再帰呼び出しでも区別できる。

`step!` のない観測がspan境界や正常終了に残っていた場合は、無名の観測stepとして確定する方針とする。panic中の不完全な観測は通常の成功stepにしない。基本例ではすべて明示的に確定する。

セッションの準備はmainに一度だけ `let _trace = viz::session();` を置く案とする。以下の関数例では、この準備を済ませた呼び出し元を想定する。トレースを無効にしたbuildでは可視化引数も評価しないため、可視化式にアルゴリズム本体の副作用を置かない。

## 3. 二分探索での記述と画面

```rust
fn lower_bound(a: &[i32], target: i32) -> usize {
    let (mut l, mut r) = (0, a.len());

    viz::view!("a", a);          // 配列は変化しないので一度でよい
    viz::vars!(l, r, target);
    viz::step!("初期状態");

    let _search = viz::span!("二分探索");
    while l < r {
        let mid = l + (r - l) / 2;

        viz::vars!(l, r, mid, target);
        viz::mark!("mid", mid, on: "a");
        viz::range!("search", l..r, on: "a");
        viz::step!("比較");

        if a[mid] < target {
            l = mid + 1;
        } else {
            r = mid;
        }
    }

    viz::vars!(l, r, target);
    viz::range!("search", l..r, on: "a");
    viz::step!("探索終了");
    l
}
```

`vars!` は各scopeのVariables recordを丸ごと採取する。したがって、探索終了では列挙していないmidが残らない。個別に継続保持したいscalarには `view!` / 対象なしの `mark!` を使う。

サンプル配列 `[1,3,4,6,8,9,11,15,18,21,25,30]`、target 11なら、停止点は以下になる。

| Step | label | l | r | mid | 表示 |
| --- | --- | --- | --- | --- | --- |
| 1 | 初期状態 | 0 | 12 | — | 配列全体と初期変数 |
| 2 | 比較 #1 | 0 | 12 | 6 | a[6]、範囲[0,12) |
| 3 | 比較 #2 | 0 | 6 | 3 | a[3]、範囲[0,6) |
| 4 | 比較 #3 | 4 | 6 | 5 | a[5]、範囲[4,6) |
| 5 | 探索終了 | 6 | 6 | — | 空区間[6,6)、結果6 |

`#1` などは説明用の繰り返し番号で、SDKのlabelを動的に作る必要はない。比較によって行われた更新は次の観測に現れる。比較前・更新後を別々に見たければ、その二か所にstepを追加する。

この表のStep 4を [Workspace画面案](workspace-wireframe.svg) として描く。SDKは比較の意味を自動推論しないので、画面には記録された値・rangeと、その差分を示す。

## 4. DFSとDPで同じAPIが成立するか

### 4.1 DFS

グラフの形は一度観測し、再帰呼び出しでは更新される状態だけを観測する。

```rust
// 呼び出し元。頂点keyは0..g.len()とするadapter。
viz::view!("g", &g, via: viz::adjacency_list());
viz::step!("グラフ");

fn dfs(u: usize, g: &[Vec<usize>], seen: &mut [bool]) {
    let _call = viz::span!("dfs({u})");
    seen[u] = true;

    viz::view!("seen", &*seen);
    viz::view!("u", &u, scope: local);
    viz::mark!("current", u, on: "g");
    viz::step!("訪問");

    for &v in &g[u] {
        if !seen[v] {
            dfs(v, g, seen);
        }
    }

    viz::mark!("current", u, on: "g");
    viz::step!("復帰");
}
```

画面は中央をGraph、右を現在のuとseen、下を再帰treeにする。`current` はGraph adapterが解決する頂点keyである。外側のuと内側のuは別scopeに属し、混ざらない。

seenをGraphの頂点色にも使う場合、Workspace側で「頂点属性: seen、対応: 頂点index」を一度bindする。長さが同じだけで自動bindしない。グラフの位置は頂点IDに対して保持し、stepごとに全体を再レイアウトしない。

### 4.2 DP

上と左から遷移する経路数DPの例。境界値は初期化済みとする。

```rust
viz::view!("dp", &dp, via: viz::matrix());
viz::step!("初期状態");

for i in 1..rows {
    let _row = viz::span!("row {i}");
    for j in 1..cols {
        dp[i][j] = dp[i - 1][j] + dp[i][j - 1];

        viz::view!("dp", &dp, via: viz::matrix());
        viz::mark!("current", (i, j), on: "dp");
        viz::highlight!("reads", [(i - 1, j), (i, j - 1)], on: "dp");
        viz::step!("更新");
    }
}
```

画面は中央をDP Tableにし、現在cellを青、明示された読み元を紫、前stepから値が変わったcellを琥珀色で示す。行・列indexを固定表示し、大きな表はviewportに応じて仮想化する。

毎回の全体採取・比較には表のサイズに比例するコストがある。基本APIの後に、変更cellのみを指定する観測APIを追加する余地を残す。単なるwire差分化で採取コストまで消えるとは扱わない。

## 5. Workspaceの基本デザイン

初期配置は横長のdesktop画面を想定する。画面案の色・サイズはレビュー用の初期値である。

```text
┌──────────────────────────────────────────────────────────────────┐
│ Trace名 / 記録状態                        Open / Export / Layout  │
├──────────────────────────────────────────────────────────────────┤
│ 再生操作  前 / 再生 / 次  速度      Step 4 / 5       Follow live   │
├──────────────┬─────────────────────────────────┬─────────────────┤
│ Source       │ Array / Graph / DP / Heap       │ Variables       │
│ Objects      │                                 │                 │
│              │ 値・index・pointer・range       │ 現在値 / 前の値 │
│ 記録地点     │                                 │                 │
│              │ 選択要素と変更点                │ Selection       │
├──────────────┴─────────────────────────────────┴─────────────────┤
│ Timeline: spanの階層 + step列                        Logs         │
│ seek / fold / step into / step over / step out                     │
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 常に見えるもの

Trace名、記録状態、再生操作、cursor位置はapp shellに置く。Timeline Panelを閉じても再生できるようにする。

「記録中 / 記録完了 / 中断」と「再生中 / 一時停止」を別々に表示する。UIのpauseはプログラムを停止する操作ではない。ライブ実行中に過去へseekしたらfollowを解除し、明示的な「最新へ戻る」で追従を再開する。

### 5.2 Array

- cellに値、上にindexを表示する。positionとvalueを同じ文字として扱わない。
- pointerは名前付きの矢印にする。複数pointerが重なるときはレーンを分ける。
- rangeは半開区間の帯と境界線で示す。空区間も境界位置として残す。
- 直前stepとの差分は色と数値の併記にする。色だけに意味を依存させない。
- 長い配列は横scrollまたは仮想化する。小さいarrayでは全体を見せる。
- 値が未変更でもpointerだけ動くstepを残す。

### 5.3 Graph / Tree / Heap / Queue

Graphは頂点と辺を安定IDで選択する。ドラッグした頂点の座標はWorkspace設定に保存し、履歴の状態とは独立させる。Treeはrootと親子関係を使って配置する。

Heapは同じデータを「配列」と「二分木」で並べて表示できる。片方の選択はもう片方にも反映する。Queueは先頭・末尾と論理順序を示し、内部のring bufferの配置とは区別する。

隣接stepでは差分を短く補間してよいが、遠い位置へのseekでは補間を省く。記録されていないswap経路を実際の操作としてアニメーション化しない。

### 5.4 Source / Variables / Logs

Sourceが示すのは **記録地点** である。SDK呼び出しによって採取したtraceから、CPUが現在その行で停止しているかのような表示はしない。対応するsourceがない場合も、ファイル名・行番号から再生できる。

Variablesはscopeごとに現在値と前の観測値を並べる。再帰では現在のscopeを基本表示し、親scopeを展開できる。同名変数を値の更新として混同しない。

LogsはSDKがstepと対応付けたログと、プログラムのstdout/stderrを区別する。後者だけから厳密な実行stepを推定しない。

### 5.5 Timeline

左側でspan tree、右側でframeの位置を表示する。選択したstepはコードとデータ表示に共通のcursorを設定する。

| 操作 | 意味 |
| --- | --- |
| 前 / 次 | 隣接する記録済みFrameへ移動 |
| 再生 | 指定速度でFrameを進める |
| step into | 子Spanを展開して次のFrameへ |
| step over | 現在のSpan内またはその外の次のFrameへ。途中の子Span内のFrameは飛ばす |
| step out | 現在のSpanとその子孫の外にある次のFrameへ |
| span選択 | 先頭Frameへ移動。末尾へも移動可能 |
| 折りたたみ | Timelineの表示だけを変更 |

step over/outは記録済みのFrame間移動であり、コード実行の制御ではない。移動先がまだ記録されていない場合、ライブ記録中なら未到達、記録完了後なら移動先なしとして示す。

全Widgetの状態は同じFrameとして公開する。ロード中に、一部だけが新しいstepになることを避ける。seek要求が連続した場合は最新要求を優先し、古い計算結果を画面に戻さない。

### 5.6 ドッキングとレイアウト

タブをドラッグして移動し、中央dropでタブ化、辺へのdropで分割する。splitterでresizeする。Panelを閉じてもEntityやtraceは消えない。Objectsから再度開ける。

初期presetは「Array」「Graph」「DP」の三つ。変えるのは中央Widgetとbindingだけで、操作位置は維持する。レイアウトは別の設定として保存し、traceファイルの再生内容と独立させる。

SolidJS + Dockviewを第一案とする。DockviewのJavaScript APIを薄いWorkspace Hostで包み、PanelのmountでSolidの `render()`、disposeで返されたcleanupを呼ぶ。非表示Panelでは描画負荷を止め、表示時に現在cursorの状態へ同期する。この接続は公式のPanel lifecycleとSolidのmount APIから導く設計である。[Dockview Panel rendering](https://dockview.dev/docs/core/panels/rendering/)、[Solid render](https://docs.solidjs.com/reference/rendering/render)

現行公式資料ではJavaScript用の公開packageは `dockview`。ドッキング・タブ・resize・layout保存は標準版に含まれるため、今回の主要操作に対応する。[Dockview packages](https://dockview.dev/typedocs/modules/dockview-core.html)、[Dockview feature table](https://dockview.dev/docs/overview/licence/)

### 5.7 空状態とエラー状態

- 起動直後: 「traceを開く」と二分探索サンプルへの入口を置く。
- 初めてのEntity: 対応するWidgetを初期layoutへ追加する。以後の更新で増殖させない。
- Entityのない時点へseek: Panelを維持して「この時点では未作成」と表示する。
- sourceなし: 再生を続け、source Panelは記録地点の情報を表示する。
- 中断trace: 再生可能な最後のstepと中断状態を表示する。
- ライブ待機: 最後のstepを保って「次の記録を待機」と表示する。

## 6. 実装へ進む前の確認点

基本のstep記法をA/Bから選び、二分探索の5場面で記録位置と表示内容の対応を確定する。そのうえで同じAPIをDFSの再帰scopeとDPのcell更新へ適用する。

画面については、まず中央の可視化の情報量、Source / Variables / Timelineの配分、差分とpointerの見分けやすさを確認する。見た目の完成度と同時に、空区間・scope復帰・逆再生でも意味を誤読しないかを確認する。

実装の最初の到達点は、この二分探索サンプルを **SDK → 保存trace → Workspaceで前後再生** まで通すこととする。その後にGraph / 再帰、DP、Heap / Queue、ライブ接続の順で広げる。
