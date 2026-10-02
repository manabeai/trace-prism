# デザインフレーバー比較

選定前の視覚サンプル。`npm run dev` のあと `/flavors` を開く。同じ実行履歴・列・タイムライン・値の詳細を 3 案で切り替えられる。URL の `?theme=prism`、`?theme=graphite`、`?theme=field-notes` で案を直接指定できる。Info アイコンの Tooltip は hover / focus で開く。これらは独立した比較画面で、現行 Workspace の外観は変えていない。

| 案 | フォント | 主な色 | 面・境界 | Tooltip |
| --- | --- | --- | --- | --- |
| Prism | Spline Sans / IBM Plex Mono | 白・淡い青灰・青紫 | 白い面を細い青灰線で区切る。選択位置だけ青紫を強く使う | 白地、短い影、青紫の値 |
| Graphite | Manrope / IBM Plex Mono | 深い青緑・ミント・琥珀 | 暗い面を低コントラストの線で区切り、選択行を明るい緑にする | 濃い青緑の浮いた面、明るい数値 |
| Field Notes | Newsreader 見出し / IBM Plex Sans / IBM Plex Mono | 淡い鉱物色・深緑・銅 | 余白と細い罫線を中心に、角と影を控えめにする | 紙に近い明るい面、見出しだけセリフ体 |

静止画: [Prism](flavors/prism.png)・[Tooltip](flavors/prism-tooltip.png)、[Graphite](flavors/graphite.png)・[Tooltip](flavors/graphite-tooltip.png)、[Field Notes](flavors/field-notes.png)・[Tooltip](flavors/field-notes-tooltip.png)。[モバイルでの比較画面](flavors/mobile.png)も確認できる。

比較するときは、まず表の数値と選択行を長時間読めるか、次に Tooltip が履歴の主役を奪わず内容を伝えるかを見る。選んだ案を本画面に反映するときは、現在の `workspace.css` に混在する固定色をトークンへ寄せ、Kobalte の Tooltip / Popover / Dialog を同じ面・文字・影の規則で揃える。比較画面の CSS をそのまま本画面へコピーすることは前提にしない。
