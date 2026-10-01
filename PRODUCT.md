# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

SolidJS＋TypeScriptの操作モック。ユーザーの「タブは不要」という指定を受け、Dockviewを外して履歴表と詳細パネルを直接構成する。Rust SDKのsnapshot送信と最小限の受信画面を別ルートに実装した。

## Users

競技プログラミングのアルゴリズムを実装し、値の変化を時系列で追いたい人。ユーザーは設計の専門家であり、技術概念を過度に簡略化しない。

## Product Purpose

名前付きの汎用データ構造を観測し、値の変化を時系列で理解する。2026-09-30のユーザー指示により、アルゴリズム固有の画面を中心にする方針を変更した。まず整数・配列・Set・Mapの履歴UIを作る。二分探索やDFS等への依存を表示モデルに持ち込まない。

## Operating Context

ローカルのCLIからコードを実行し、Web Workspaceでtraceを確認する構想。保存traceの再生とライブ表示を想定する。まずSDK記法とWeb画面を設計し、それから本体の実装に進むという順序が指定されている。

## Capabilities and Constraints

- 専用コンテナを強制せず、通常のVec、配列、隣接リスト、自作型を少量のSDK呼び出しで観測する。
- 値、観測境界、汎用的なspan ID配列と任意の遷移元Frame IDだけをコードから送り、アルゴリズムの意味はVisualizer側のRecipeと変数bindingで与える。spanは配列IDの完全一致で同一グループ、prefixで親子とする。異なるループを分けたい場合はID側に識別子を含める。snapshot + patchは記録の時系列に適用する。
- タブは不要。実行履歴の一覧から1件を選び、その実行に属するデータと時系列を表示する。
- 実行IDごとにオブジェクト定義・snapshot・seqを分離する。同名データを別実行と結合しない。
- 再生位置・列の表示状態・差分フィルタ・詳細の選択は実行別に保持し、実行の切替時は再生を停止する。
- 今回は汎用データを記録順に並べる操作モック。縦軸を共通のseq、横軸を名前付きのデータとし、複数時点の値を同時に読む。
- 追加・削除・更新を、データ型に対応した意味で示す。配列はindex、Setは所属、Mapは型付きキーで比較する。
- 記録内容はサンプルであり、実際のRustプロセスには接続しない。

## Evidence on Hand

- `docs/experience-design.md`: SDKと画面の先行設計案。APIは提案段階。
- `docs/workspace-wireframe.svg`: 先行案の配色参照。アルゴリズム別の構成は今回の中心にしない。
- `src/data.ts`、`src/ValueView.tsx`: 汎用の観測値と型別の描画。
- `docs/design.md`: Protocolの初期設計メモ。視覚デザインの仕様ではない。

## Product Principles

- 全Widgetの観測時点を揃える。
- 記録の事実と、補助的な表示・操作を分離する。
- データ構造を置き換える負担をユーザーに要求しない。
- 操作に必要な情報を優先し、専門的な名前を正確に使う。
