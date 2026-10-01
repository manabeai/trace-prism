# Data history 操作モック

対象: src/App.tsx、src/ValueView.tsx、src/data.ts、src/styles.css。Mode: Operate。

2026-09-30の指定変更。最新の追加指示は「タブは不要」「実行毎に独立でデータの履歴を取りたいので実行履歴の一覧が必要」。ユーザー: 「あまりアルゴリズムと癒着した感じにしなくていい」「まず、配列とか単独の整数とかset map等の普遍的なデータ構造を時系列順に表示されるUI」。先行モックのアルゴリズム別体験は継承しない。既存の濃紺・細い境界・sans/monoの体系を使用し、データの時系列表示に内容と構造を絞り直す。

## Direction contract

**THESIS:** 実行履歴の一覧から1件を選び、その実行に属する普遍的なデータ構造を、実行内で共通のseqで縦に読む。複数時点の値を同時に見せ、変化の位置を特定できる。

**OWN-WORLD:** 既存の濃紺、フラットなpane、UIのsansと値のmonoを継承。青は選択時点、緑は追加、琥珀色は更新、淡い赤は削除。全ての差分は記号と値を併記する。

**STORY:** 実行ID、開始日時、ソース、入力、終了状態、記録件数を持つ一覧から実行を選ぶ。同名のcount / values等も実行ごとに独立させ、横に並べて記録順に読み下す。データを絞るか、変更なしのセルを省略する。セルの選択でその時点の完全な値と差分を開く。共通の再生位置から前後に移動する。

**FIRST VIEWPORT:** 左236pxに実行履歴3件、中央は選択実行のID・入力と履歴表、下に再生操作。初期選択はrun 003のseq 04。データの列選択は上の「データ」メニューに置く。タブ・Dockview・ドラッグ配置は使わず、Snapshotは右300pxに開閉する。mobileは上部の「実行履歴」メニューで実行を選び、同じ「データ」メニューで列を絞る。Snapshotは履歴と切替表示し、閉じると戻る。

**FORM:** seed key: not applicable — precisely specified data-history revision。アルゴリズム固有の切替・Source主導の構成を廃止するというユーザー指示から、汎用データ型と共通seqの履歴表を実装する。signatureは隣接するsnapshotの比較、全てのデータ型に共通するセル選択とseek。

**MOTION:** 観測値は即時更新。選択行が見切れたときだけ表の内部をスクロールし、記録された変化を余分な動作で補わない。reduced-motionを尊重する。

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 確認する状態

- 整数の正負・0、配列の更新・追加・削除・空、Setの追加・削除・空、Mapのキー追加・削除・値更新・空。
- 異なる型のキーを区別し、Set/Mapの列挙順だけの変更は差分にしない。
- 列の表示切替、全列非表示からの復帰、変更なしセルの省略、名前/型検索。
- 履歴とSnapshotのseek同期、再生、キーボード、末尾再開。
- タブのない履歴とSnapshotの開閉。
- 実行切替時の再生停止、実行別の値・seq・再生位置・列・差分フィルタ・詳細の復元。
- 途中終了した実行の記録保持、選択実行だけのJSON書出し。
- desktop 1440×1000、narrow 1100×900、mobile 390×844。
- サンプルsnapshotのUI。SDK、CLI、Protocol、ライブ接続、任意trace読込は対象外。
