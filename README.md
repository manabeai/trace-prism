# TracePrism

Rustコードの任意の箇所に `record!` を置き、実行後に値の履歴をWeb UIで追うローカルVisualizerです。通常の配列・整数・Set・Mapなどをそのまま記録します。アルゴリズム固有の意味はコードから送らず、Algo Viewを画面側で選んで記録済み変数に割り当てます。

現在公開しているのは `0.1.0-preview.1` です。Rust SDK とローカル受信サーバーを試すためのプレリリースで、API・保存形式・操作方法は今後変更される可能性があります。

## 公開版を使う

```sh
npm install --global traceprism@preview
traceprism serve
```

別のターミナルで、Rust プロジェクトの `Cargo.toml` に `traceprism = "=0.1.0-preview.1"` を追加し、`record!` を使うプログラムを実行します。ビューワは [http://127.0.0.1:4317/](http://127.0.0.1:4317/) で開けます。npm パッケージには Web ビルドと Rust SDK のソースが含まれ、`traceprism run main.rs` で単体の Rust ファイルも実行できます。実行履歴と一時的なバイナリはコマンドを実行したディレクトリの `.viz/` に保存されます。

## リポジトリから試す

```sh
npm install
npm run build
npm run serve
```

別のターミナルで、Rustのサンプルを通常のCargoで実行します。

```sh
cargo run --manifest-path examples/Cargo.toml --bin binary-search
cargo run --manifest-path examples/Cargo.toml --bin abc007-c < examples/fixtures/abc007-c-1.in
cargo run --manifest-path examples/Cargo.toml --bin dfs
```

[http://127.0.0.1:4317/](http://127.0.0.1:4317/) を開くと、実行ごとに独立した履歴が表示されます。左上で値の列を選び、列見出しのアイコンで表示形式を変更します。Algo Viewを追加すると必要な値をクリックで割り当てられます。TableとGraphは左右に並び、共通のseq選択に連動します。中央の二本線をドラッグして幅を変え、片側を完全に畳むこともできます。`from:` があればGraphは依存関係を初期表示し、**ID tree** ボタンでspan ID階層へ切り替えられます。[DFSサンプルの見方](docs/local-walkthrough.md#4-dfs-の呼び出し木を確認する)も参照してください。

単体の `.rs` ファイルはCLIからも実行できます。サーバー未起動なら自動で立ち上がり、実行後もWeb UIを開ける状態を維持します。

```sh
node bin/traceprism.mjs run examples/abc007_c.rs < examples/fixtures/abc007-c-1.in
```

`npm link` 後は `traceprism run ...` と `traceprism serve` でも呼び出せます。トレースだけ保存するなら `--no-serve` を付けます。記録は `.viz/runs/` にNDJSONとして残り、サーバーの再起動後も実行履歴に表示されます。

通常の `cargo run` では、言語共通の受信サーバーを先に `traceprism serve`（または `npm run serve`）で起動します。SDKは値の記録・送信のみを担当し、Webアプリの起動には関与しません。他言語のSDKも同じ受信サーバーを使う設計です。

## 自分の競プロコードで使う

Cargoプロジェクトにcrateを追加します。Cargoパッケージ名とRustのimport名はいずれも `traceprism` です。リポジトリ内で開発する場合は `version` を `path = "/home/mana/programs/algo-visualizer/sdk/rust"` に置き換えられます。

```toml
[features]
default = ["viz"]
viz = ["dep:traceprism"]

[dependencies]
traceprism = { version = "=0.1.0-preview.1", optional = true }
```

ソースが単体提出でもコンパイルできるよう、featureがないときだけ空のマクロを定義します。

```rust
#[cfg(feature = "viz")]
use traceprism::record;
#[cfg(not(feature = "viz"))]
macro_rules! record { ($($tokens:tt)*) => { () }; }

let origin = record!([], a, left, right);
record!([i, j], from: origin, a, left, right);
```

`record!` は可視化用の引数をfeatureなしでは評価しません。通常の `cargo run` はサーバーへ送信し、サーバーがなければ記録だけ無効になってプログラム本体は続きます。標準出力は変更しません。[Rust crateの説明](sdk/rust/README.md)と[実際のサンプル](examples/abc007_c.rs)も参照してください。

`../AtCoder/contest/abc001/a/main.rs` に導入済みです。そのコンテストのCargo設定では公開済みの `traceprism = "=0.1.0-preview.1"` を使用します。`cargo run --manifest-path ../AtCoder/contest/abc001/Cargo.toml --bin a < ../AtCoder/contest/abc001/a/tests/sample-1.in` でサンプル入力を与えられます。提出用のfeatureなし `rustc` 実行も確認しています。

## データと画面

SDKは [`viz.trace/v2` のsnapshot/patch](protocol/v2/README.md)を送信します。最初の記録が完全なsnapshot、その後は値が変わった名前だけを `put` するpatchです。同値の場合も空のpatchを残し、観測点を失いません。`span` は型付きIDの配列です。`from: 親ID` は同じ型の `fromId` に変換され、`from: FrameRef` は従来どおり過去のseq参照 `from` になります。UIはseq順に完全な状態を復元します。古いv1の保存済みtraceも読み取れます。

現在のMVPはRust SDK、受信サーバー、保存、実行履歴、値の履歴表・表示形式、Algo Viewの二分探索・グリッド、関係グラフまで動作します。

## 開発と品質チェック

```sh
npm run check
npm run build
npm run test:e2e
node protocol/v2/validate.test.mjs
cargo fmt --manifest-path sdk/rust/Cargo.toml -- --check
cargo clippy --manifest-path sdk/rust/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path sdk/rust/Cargo.toml
cargo test --manifest-path examples/Cargo.toml
```

`npm run check` は ESLint、Prettier、アプリとテストの型検査、Vitest を実行します。Husky の pre-commit hook は staged file の整形・lint、型検査、単体テストを実行し、GitHub Actions ではビルド、protocol、Playwright、Rust も検査します。

フロントエンドは [リファクタリング設計](docs/frontend-refactor-design.md) に沿って、trace、実行取得、表示レジストリ、workspace controller を分離しています。[Value 表示形式の追加規則](docs/value-presentations.md) にファイル構成と追加手順を記載しています。履歴の span 展開は TanStack Table v9 の行モデルを使用します。既存 CSS を機能単位で CSS Modules へ移す方針のため、Tailwind は導入していません。

採用した Field Notes の設計規則は [DESIGN.md](DESIGN.md) にまとめています。[デザインフレーバー比較](docs/design-flavor-study.md) は `/flavors` で開けます。同じ履歴を 3 種類のフォント・色・Tooltip で比較できます。

現行画面の静止画は [履歴表](docs/field-notes/workspace-desktop.png)・[モバイル](docs/field-notes/workspace-mobile.png)・[表示形式メニュー](docs/field-notes/format-menu.png)・[遷移グラフ](docs/field-notes/transition-graph.png)で確認できます。

Field Notes の[コンポーネントカタログ](docs/field-notes-catalog.md)は `/catalog` で開けます。色・書体・操作部品・値表示・履歴・オーバーレイを操作しながら確認できます。Storybook は `npm run storybook` で起動し、本番の Value 表示、書式メニュー、Algo View、Workspace の状態を固定 trace で確認できます。

Storybook の構成、fixture、story の追加方法は [Storybook ガイド](docs/storybook.md)を参照してください。静的ビルドは `npm run build:storybook` で検証できます。

手元で一連の動きを試す順序は [ローカル動作確認](docs/local-walkthrough.md)にまとめています。

[値の差分と要素パス](docs/value-differences.md) は、直前 seq との構造比較、Array・Set・Map・Record の型付きパス、および要素別 seq 抽出の境界を定義しています。
