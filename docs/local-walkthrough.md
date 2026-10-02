# ローカルで `record!` を試す

サーバーを起動し、小さな Rust プログラムを自分で作成して実行し、ブラウザで値の履歴を確認する手順。すべてのコマンドは algo-vis リポジトリのルートで実行する。作成するサンプルは Git 管理外の `.viz/tutorial/` に置く。

## 1. ビューワのサーバーを起動する

ターミナル A:

```sh
npm ci
npm run build
npm run serve
```

`algo-vis: http://127.0.0.1:4317/` と表示されたら、そのターミナルを開いたままにする。ブラウザで [http://127.0.0.1:4317/](http://127.0.0.1:4317/) を開く。`npm link` 済みなら `npm run serve` の代わりに `algo-vis serve` でもよい。

## 2. サンプルの Rust コードを書く

別のターミナル B で以下を順番に実行する。

```sh
mkdir -p .viz/tutorial/src
cat > .viz/tutorial/Cargo.toml <<'TOML'
[package]
name = "algo-vis-local-demo"
version = "0.1.0"
edition = "2021"

[dependencies]
algo-vis = { path = "../../sdk/rust" }
TOML
```

```sh
cat > .viz/tutorial/src/main.rs <<'RUST'
use algo_vis::record;

fn main() {
    let a = vec![2, 5, 8, 11, 15];
    let target = 10;
    let (mut left, mut right) = (0, a.len());
    let (mut mid, mut ok) = (0, false);

    let origin = record!([], a, target, left, right, mid, ok);
    let mut iteration = 0;
    while left < right {
        mid = (left + right) / 2;
        ok = a[mid] >= target;
        let compared = record!([iteration], from: origin, a, left, right, mid, ok);
        if ok {
            right = mid;
        } else {
            left = mid + 1;
        }
        record!([iteration, 1], from: compared, a, left, right, mid, ok);
        iteration += 1;
    }

    println!("{left}");
}
RUST
```

`record!` の第1引数が span ID の配列。`from:` は遷移元の記録を指定し、その参照が Graph 表示の辺になる。値は通常の `Vec` や整数・bool をそのまま渡している。

## 3. 実行して履歴を見る

```sh
cargo run --manifest-path .viz/tutorial/Cargo.toml
```

標準出力は `3`。ブラウザを更新すると、左下の **Runs** に新しい `main.rs` の実行が増える。選択して、以下を確認する。

1. **Table** で seq 0 から進めると `left`、`right`、`mid`、`ok` が更新される。`[iteration]` と `[iteration, 1]` が span の階層に分かれる。
2. `a` 列の見出しのアイコンを押して **Bars** に切り替える。同じ配列を棒グラフとして表示できる。
3. **Graph** に切り替える。`from:` で指定した遷移を辺として追える。
4. 同じ `cargo run` を再実行する。**Runs** に別の実行が追加され、前回の履歴も残る。

記録ファイルは `.viz/runs/` に保存される。ターミナル A のサーバーを `Ctrl+C` で止めてから `npm run serve` で再起動しても、実行履歴を読み直せる。

**Runs に追加されない場合:** サーバーが起動中か確認する。`record!` を含むプログラムを普通の `cargo run` で実行すること。SDK はサーバーを自動起動せず、未起動なら記録だけを無効化してプログラム本体を続ける。`VIZ_PORT` を変更した場合はサーバーと SDK の両方に同じ値を設定する。
