# Storybook ガイド

Field Notes を適用した実コンポーネントの状態を独立して確認するため、Solid 向け Storybook を使う。`/catalog` は画面上の部品を概観するカタログ、Storybook は実装単位と状態を確認する開発環境として使い分ける。

## 起動と検証

```sh
npm run storybook
npm run build:storybook
```

開発サーバーは [http://127.0.0.1:6006/](http://127.0.0.1:6006/) で開く。静的成果物は `storybook-static/` に生成され、Git から除外する。CI でも静的ビルドを実行する。アプリの本番ビルドには Storybook のページや依存物を含めない。

## 掲載する状態

| 分類 | Story | 確認すること |
| --- | --- | --- |
| Foundation | Palette / Typography | 面・アクセント色、見出し・操作・データの書体 |
| Workspace | Recorded / No runs / Storage unavailable | 通常の履歴、空状態、取得失敗状態 |
| Values | Array cells / bars / text / changed element、Matrix、Set、Map、Boolean、Missing value | 表示形式と要素単位の差分、欠損値の表示 |
| Controls | Interactive format menu | 実際の列書式メニューを開き、形式切替を操作 |
| Algo Views | Binary search / Grid traversal | 記録済み frame と binding による表示 |

Story は `src/stories/` に置く。サンプル値と frame は `fixtures.ts` にまとめ、protocol の `example.ndjson` をデコード・materialize したものを Workspace と Algo View の story に渡す。Workspace の取得処理は `RunRepository` を注入でき、Recorded・No runs・Storage unavailable の各状態を通信なしで再現する。これにより story の表示はローカルの実行履歴に依存しない。

新しい Value Presentation を追加するときは、実装した表示形式と変更要素の story を追加する。Algo View を増やすときは、binding と対応する frame を用意して正常表示を確認する。操作を持つ部品は静止画だけで終わらせず、実コンポーネントを動かせる story にする。共通の色・書体は [DESIGN.md](../DESIGN.md) と `src/design/field-notes-tokens.css` に従う。
