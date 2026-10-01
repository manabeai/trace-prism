# ImpeccableによるWorkspaceモックの調整

実施日: 2026-09-29

## 使用したスキル

- 公式: https://github.com/pbakaus/impeccable
- スキル: Impeccable v4.4.0
- 取得commit: `114ea1d3838fca73b253af45f873b9c4f5f213c8`
- インストール先: `/home/mana/.codex/skills/impeccable`
- 適用範囲: `reference/polish.md`、`reference/operate.md`、`reference/craft-floor.md`
- 対象: 既存の二分探索Workspaceの静的モック

## 判断と変更

操作用UIとして、観測値と再生位置を読むことを優先した。既存の暗色パレット、Source / Array / Variables / Timelineの配置、SDK記法を維持して調整した。

| 観察 | 対応 |
| --- | --- |
| codeが11pxで、最も読みたい記録地点を追いにくい | codeを13px、標準UIテキストを14pxへ拡大 |
| 補助テキストが弱く、indexや前stepの値が読み取りにくい | 補助色を明るくしてコントラストを確保 |
| 中央の差分カードが同じ重みで三つ並ぶ | pointerとrangeの二行に整理。配列未変更は短い補足へ |
| 選択値が配列、中央下部、右側に重複する | 詳細を右側のSelectionに集約 |
| 現在値と前stepの値の桁位置が揃っていない | 等幅・右揃えに統一 |
| 記号アイコンの字体と線の太さが不揃い | 操作用の記号を統一したSVG線画へ変更 |
| Panelがカードの集合に見える | 外形の角丸を抑え、タブと仕切りを中心に整理 |

## 成果物と限界

- [調整後のモック](workspace-wireframe.png)
- [調整前のモック](workspace-wireframe-before-impeccable.png)
- [編集可能なSVG](workspace-wireframe.svg)

二分探索の観測値は既存案と同じ。サンプル配列に対し、Step 4は `l=4, r=6, mid=5`、直前は `l=0, r=6, mid=3` である。

成果物はdesktop向けの静的モック。再生ボタン、docking、キーボード操作の実装や、mobile用レイアウトの動作を検証したものではない。ProtocolとSDKの実装は今回の変更に含まない。

## 確認

SVGを画像として描画して確認した。主要な文字色と背景色の組み合わせは4.5:1以上。XMLの構文とMarkdownのローカルリンクも確認した。

Impeccableの `detect --json docs/workspace-wireframe.svg` は指摘なし（`[]`）だった。launcherが解決した検出CLIの `--version` 出力は `4.0.0`（スキルのmetadata versionとは別）。検出器の対象範囲内での結果であり、静的SVG上の操作の実装やWeb全体のアクセシビリティを保証するものではない。
