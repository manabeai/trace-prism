# 実行記録の検索

Workspace の検索欄は、現在選択中の run を対象にする。run を切り替えると検索条件・入力中の文字列・ヒット結果も run ごとに切り替わる。条件が完成していれば記録の更新とともに検索結果を再計算する。

## 構文

`変数 [射影] 演算子 [右辺]` を一つの条件とし、完成した条件に `AND` / `OR` を続けられる。複数条件は現時点では左結合で評価する。候補選択と Space による確定は同じ型付き検索モデルを更新する。右辺の `@変数名` は同じ seq の別の記録値を参照する。

例:

```text
left >= 2
A sum >= 50
A < [2, 7, 8]
A == @other_array
visited subsetOf {0, 1, 2, 3}
label contains "exploring"
ok is true
```

文字列・文字は引用符を付けられる。空白を含む文字列は引用符で囲む。数値配列と数値 Set は、それぞれ `[...]`、`{...}` を使う。配列の `<` / `<=` / `>` / `>=` は辞書順であり、Set には順序比較を出さず真部分集合・真上位集合と等値比較を出す。整数は `BigInt` で比較する。

記録値の型は Materializer の全フレームから推定する。先頭が `null`、後で `bool` になる変数は `bool` の操作と `is null` の両方を出す。配列や Set が空で始まる場合は、要素のある観測点から要素型を推定する。実行中に型情報が増えた場合も候補に反映する。

構文チップを使わない自由文検索は、変数名と値のスカラー葉に Unicode NFKC 正規化と大文字小文字を無視した部分一致を行う。配列・Set・Map・record は葉まで辿る。JSON の記号やソースパスは検索対象にしない。

## 境界

- `src/search/model.ts`: 値の型形状、型付き条件、リテラル、正規文字列表現。
- `src/search/grammar.ts`: 型別の射影・演算子・右辺候補と、クリック／入力からの条件更新。
- `src/search/evaluate.ts`: Trace フレーム上の評価。結果は seq ごとの一致変数名と値パスを持つ。
- `src/workspace/search/SearchEditor.tsx`: 検索欄の入力・候補・ヒット移動。Trace の評価規則を持たない。
- `src/workspace/controller.ts`: run ごとの条件を保持し、Table・Graph・seq bar に同一の検索結果を渡す。

`changed` は Materializer が保持する差分パスを使う。最初のフレームには比較元がないためヒットしない。表の値表示には検索の一致パスを渡し、配列要素・Set メンバー・Matrix セル・Map エントリ・record フィールドを個別に強調する。Graph の辺の生成や Table の時系列順は検索結果で変えない。

Map は `size` / `hasKey` / 等値・非等値 / `changed`、record は等値・非等値 / `changed` を扱う。Map や record 全体の右辺には、同型の `@変数名` を使う。型不明の値は `changed` と参照比較を中心に扱う。より複雑なリテラルや record 内フィールドの射影は、この型・文法境界に追加する。
