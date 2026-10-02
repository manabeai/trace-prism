# algo-vis

Rustコードの任意の箇所に `record!` を置き、実行後に値の履歴をWeb UIで追うローカルVisualizerです。通常の配列・整数・Set・Mapなどをそのまま記録します。アルゴリズム固有の意味はコードから送らず、Algo Viewを画面側で選んで記録済み変数に割り当てます。

## すぐに試す

```sh
npm install
npm run build
npm run serve
```

別のターミナルで、Rustのサンプルを通常のCargoで実行します。

```sh
cargo run --manifest-path examples/Cargo.toml --bin binary-search
cargo run --manifest-path examples/Cargo.toml --bin abc007-c < examples/fixtures/abc007-c-1.in
```

[http://127.0.0.1:4317/](http://127.0.0.1:4317/) を開くと、実行ごとに独立した履歴が表示されます。左上で値の列を選び、列見出しのアイコンで表示形式を変更します。Algo Viewを追加すると必要な値をクリックで割り当てられます。表のseq選択、スライダー、Graph表示は同じ観測位置に連動します。`from` があればその遷移辺、なければspan IDの接頭辞階層をグラフに表示します。

単体の `.rs` ファイルはCLIからも実行できます。サーバー未起動なら自動で立ち上がり、実行後もWeb UIを開ける状態を維持します。

```sh
node bin/algo-vis.mjs run examples/abc007_c.rs < examples/fixtures/abc007-c-1.in
```

`npm link` 後は `algo-vis run ...` と `algo-vis serve` でも呼び出せます。トレースだけ保存するなら `--no-serve` を付けます。記録は `.viz/runs/` にNDJSONとして残り、サーバーの再起動後も実行履歴に表示されます。

## 自分の競プロコードで使う

Cargoプロジェクトにローカルcrateを追加します。Cargoパッケージ名は `algo-vis`、Rustのimport名は `algo_vis` です。

```toml
[features]
default = ["viz"]
viz = ["dep:algo-vis"]

[dependencies]
algo-vis = { path = "/home/mana/programs/algo-visualizer/sdk/rust", optional = true }
```

ソースが単体提出でもコンパイルできるよう、featureがないときだけ空のマクロを定義します。

```rust
#[cfg(feature = "viz")]
use algo_vis::record;
#[cfg(not(feature = "viz"))]
macro_rules! record { ($($tokens:tt)*) => { () }; }

let origin = record!([], a, left, right);
record!([i, j], from: origin, a, left, right);
```

`record!` は可視化用の引数をfeatureなしでは評価しません。通常の `cargo run` はサーバーへ送信し、サーバーがなければ記録だけ無効になってプログラム本体は続きます。標準出力は変更しません。[Rust crateの説明](sdk/rust/README.md)と[実際のサンプル](examples/abc007_c.rs)も参照してください。

`../AtCoder/contest/abc001/a/main.rs` に導入済みです。そのコンテストのCargo設定からは `../../../algo-visualizer/sdk/rust` をpath dependencyとして参照します。標準入力例で `cargo run --manifest-path ../AtCoder/contest/abc001/Cargo.toml --bin a` と、提出用のfeatureなし `rustc` 実行を確認しています。

## データと画面

SDKは [`viz.trace/v2` のsnapshot/patch](protocol/v2/README.md)を送信します。最初の記録が完全なsnapshot、その後は値が変わった名前だけを `put` するpatchです。同値の場合も空のpatchを残し、観測点を失いません。`span` は型付きIDの配列、`from` は同一実行内の過去のseq参照です。UIはseq順に完全な状態を復元します。古いv1の保存済みtraceも読み取れます。

現在のMVPはローカルのRust SDK、受信サーバー、保存、実行履歴、値の履歴表・表示形式、Algo Viewの二分探索・グリッド、関係グラフまで動作します。crateはローカルpath dependencyで、crates.ioには未公開です。固定データの[デザインモック](http://127.0.0.1:4317/?mock)と[コンポーネントカタログ](docs/design-catalog.md)も残しています。`/?legacy` は従来の操作モックです。

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

フロントエンドは [リファクタリング設計](docs/frontend-refactor-design.md) に沿って、trace、実行取得、表示レジストリ、workspace controller を分離しています。履歴の span 展開は TanStack Table v9 の行モデルを使用します。既存 CSS を機能単位で CSS Modules へ移す方針のため、Tailwind は導入していません。
