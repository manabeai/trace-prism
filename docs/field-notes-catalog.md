# Field Notes コンポーネントカタログ

「紙のやつ」として選んだ Field Notes を、コンポーネント単位で確認する画面。`npm run dev` または `npm run serve` のあと `/catalog` を開く。現行 Workspace でも同じ視覚規則を使用する。

静止画: [デスクトップ](catalog/desktop.png)・[モバイル](catalog/mobile.png)・[棒グラフ](catalog/bars.png)・[Text 表示](catalog/text-mobile.png)・[表示形式 Popover](catalog/popover.png)・[Tooltip](catalog/tooltip.png)・[設定 Dialog](catalog/dialog.png)。表示形式の切替、履歴の選択、ポップアップなどは `/catalog` で操作できる。

## 視覚規則

| 役割 | 値 | 用途 |
| --- | --- | --- |
| Canvas | `#f1f2ec` | 作業面 |
| Sheet | `#fafbf7` | データとオーバーレイの面 |
| Sidebar | `#e9ede6` | 補助ナビゲーション |
| Ink | `#263e39` | 主テキスト |
| Rule | `#cbd6cc` | 領域間の境界 |
| Action | `#3f7065` | 選択・フォーカス・主操作 |
| Copper | `#ae724e` | 変化した値 |

見出しは Newsreader、UI は IBM Plex Sans、記録された値と識別子は IBM Plex Mono。紙らしさはテクスチャや疑似的な影で作らず、面の温度差・細い罫線・余白で表す。浮いた面にだけ弱い影を使う。

## 確認できるもの

- **Foundation:** 色の役割と三種類の文字組み。
- **Controls:** 主操作・補助操作・無効状態・記録値を実際に絞り込む検索入力。
- **Values:** Array の Cells / Bars / Text 切替。変更された要素の色分け。Set / Map / Bool のコンパクト表示。
- **History:** Values / Runs のサイドバー、seq 選択、span 階層のある列表示、Timeline、変更がある seq のみへの絞り込み、選択位置の詳細。サイドバーのチェックと run 選択は局所的な状態見本で、下の固定サンプル trace は切り替わらない。変更 seq の絞り込みは Sequence and inspection の行リストだけに適用し、表と Timeline は全 seq を保持する。
- **Overlays:** Kobalte の Tooltip、Popover、Dialog の質感とキーボード操作。

カタログ内の数値とトレースはデザイン確認用の固定データで、SDK や保存済み実行からは取得しない。カタログの Array 表示は視覚・操作の参考実装で、本番の表示処理は既存の表示レジストリで管理する。Storybook の Value 表示・書式メニュー・Algo View は本番コンポーネントを直接使用する。
