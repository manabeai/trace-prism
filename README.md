# TracePrism

## Tauriデスクトップ版（プレビュー）

TracePrismはLinux・macOS・Windows向けのネイティブアプリです。Rust SDK `0.1.0-preview.3` が実行履歴をファイルに記録し、Tauriアプリが読み込みます。アプリのビルドにはNode.js 22.12以降、[`rust-toolchain.toml`](rust-toolchain.toml)で指定するRust 1.93.0、各OSの[Tauri依存パッケージ](https://tauri.app/start/prerequisites/)が必要です。

```sh
npm ci
npm run tauri -- dev
```

LinuxでWebKitGTKをNixから導入する場合は、`npm ci` の後に `nix-shell --run 'npm run tauri -- dev'` を使います。リポジトリの [`shell.nix`](shell.nix) はWebKitGTK・GTK・コンパイラを同一のNix環境から揃えます。`PKG_CONFIG_PATH` だけをNixに向けてホストのリンカを使うと、glibcのバージョンが混ざってリンクに失敗します。Nix環境でのローカルビルドは動作確認用とし、配布用のdebはUbuntuのCI成果物を使用します。

競プロコードの `Cargo.toml` では、ファイル連携版SDKを指定します。

```toml
traceprism = { version = "=0.1.0-preview.3", optional = true }
```

別のターミナルで通常の `cargo run --bin a` などを実行します。SDKは実行ごとのNDJSONを直接書きます。アプリは保存先の各ファイルの先頭行から実行一覧を作り、選択中の実行だけ全記録を読み込みます。受信サーバーは不要です。署名鍵を使わない手元でのビルドは `npm run tauri -- build --no-sign --config src-tauri/tauri.ci.conf.json` で作成できます。

配布用インストーラーは[GitHub Releases](https://github.com/manabeai/trace-prism/releases)で公開します。`v` で始まるタグをpushすると、Tauri公式の`tauri-action`がLinux、macOS（Apple Silicon・Intel）、Windowsの各環境でビルドします。全ジョブ成功後にプレビュー版を公開します。

### アプリの更新

`v0.2.1` 以降の更新対応版は、起動時にプレビュー版の更新を確認します。新しい版があると画面右上のボタンから署名を検証してインストールし、再起動できます。LinuxはAppImage、macOSはApple Silicon・Intel、WindowsはNSISインストーラーが対象です。Linuxの`.deb`は画面右上からReleasesを開き、手動で更新します。更新機能のない`v0.2`からは一度`v0.2.1`を手動でインストールしてください。

タグのCIは更新用ファイルと署名をReleaseへ添付し、全プラットフォームの更新情報を検証した後、`preview-updates`ブランチの`latest.json`を切り替えます。署名用の秘密鍵はリポジトリには含めず、GitHub Actionsの`TAURI_SIGNING_PRIVATE_KEY` Secretに登録します。鍵を失うと既存インストールへの更新を署名できなくなるため、管理者は安全な場所にバックアップしてください。

| OS      | 既定の履歴保存先                                                              |
| ------- | ----------------------------------------------------------------------------- |
| Linux   | `$XDG_DATA_HOME/traceprism/runs`、未設定なら `~/.local/share/traceprism/runs` |
| macOS   | `~/Library/Application Support/traceprism/runs`                               |
| Windows | `%APPDATA%\traceprism\runs`、未設定なら `%LOCALAPPDATA%\traceprism\runs`      |

絶対パスの `TRACEPRISM_RUN_DIR` でSDK・アプリ双方の保存先を変更できます。`VIZ_TRACE_PATH` は1実行だけ出力先を上書きします。書き込み途中の最終行は次回の読み込みまで保留します。

旧版で保存した `.viz/runs/` の `.jsonl` と `.meta.json` は、上記の履歴保存先へコピーするとデスクトップ版でも読めます。

## サンプルを実行する

アプリを開いたまま、別のターミナルでRustのサンプルを通常のCargoで実行します。

```sh
cargo run --manifest-path examples/Cargo.toml --bin binary-search
cargo run --manifest-path examples/Cargo.toml --bin abc007-c < examples/fixtures/abc007-c-1.in
cargo run --manifest-path examples/Cargo.toml --bin dfs
```

実行ごとに独立した履歴がアプリに表示されます。左上で値の列を選び、列見出しのアイコンで表示形式を変更します。Algo Viewを追加すると必要な値をクリックで割り当てられます。TableとGraphは左右に並び、共通のseq選択に連動します。中央の二本線をドラッグして幅を変え、片側を完全に畳むこともできます。`from:` があればGraphは依存関係を初期表示し、**ID tree** ボタンでspan ID階層へ切り替えられます。[DFSサンプルの見方](docs/local-walkthrough.md#4-dfs-の呼び出し木を確認する)も参照してください。

## 自分の競プロコードで使う

Cargoプロジェクトにcrateを追加します。Cargoパッケージ名とRustのimport名はいずれも `traceprism` です。SDKのソースとCIは[独立リポジトリ](https://github.com/manabeai/trace-prism-sdk-rs)で管理します。

```toml
[features]
default = ["viz"]
viz = ["dep:traceprism"]

[dependencies]
traceprism = { version = "=0.1.0-preview.3", optional = true }
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

`record!` は可視化用の引数をfeatureなしでは評価しません。`0.1.0-preview.3` の通常の `cargo run` はファイルへ記録します。保存先を作れない場合もプログラム本体は続き、標準出力は変更しません。[Rust crateの説明](https://github.com/manabeai/trace-prism-sdk-rs#traceprism-rust-crate)と[実際のサンプル](examples/abc007_c.rs)も参照してください。

`../AtCoder/contest/abc001/a/main.rs` に導入済みです。そのコンテストのCargo設定ではファイル連携版の `traceprism = "=0.1.0-preview.3"` を使用します。`cargo run --manifest-path ../AtCoder/contest/abc001/Cargo.toml --bin a < ../AtCoder/contest/abc001/a/tests/sample-1.in` でサンプル入力を与えられます。提出用のfeatureなし `rustc` 実行も確認しています。

## データと画面

SDKは [`viz.trace/v2` のsnapshot/patch](protocol/v2/README.md)を記録します。最初の記録が完全なsnapshot、その後は値が変わった名前だけを `put` するpatchです。同値の場合も空のpatchを残し、観測点を失いません。`span` は型付きIDの配列です。`from: 親ID` は同じ型の `fromId` に変換され、`from: FrameRef` は従来どおり過去のseq参照 `from` になります。UIはseq順に完全な状態を復元します。古いv1の保存済みtraceも読み取れます。

現在のMVPはRust SDK、ファイル保存、実行履歴、値の履歴表・表示形式、Algo Viewの二分探索・グリッド、関係グラフまで動作します。

## 開発と品質チェック

```sh
npm run check
npm run build
npm run test:e2e
node protocol/v2/validate.test.mjs
cargo fmt --manifest-path examples/Cargo.toml -- --check
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
