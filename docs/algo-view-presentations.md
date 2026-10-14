# Algo View の追加規則

Algo View は、複数の記録値を role に結び付けて描画する表示形式。trace 側には view の種類や binding を書き込まない。

## 定義の境界

`src/presentations/algo/views/<view>.tsx` に `AlgoViewDefinition` を一つ定義する。定義には安定した `id`、一覧用の名前と説明、`roles`、`preview`、アイコン、描画コンポーネントを含める。各 role は表示する形状名 `shape` と、候補判定用の `accepts(value)` を持つ。既存の判定は `roleAccepts` から再利用できる。新しい形状を使う場合はその view 内に判定を定義できるため、共通の判別分岐を編集する必要はない。

`preview` は role 名をキーとする値の集合。`previewFor()` がこれを `Frame` と binding に変換する。新規 view の例を共通プレビューに追記しない。role の値は `accepts` を満たすこと。

```tsx
export const example: AlgoViewDefinition = {
  id: 'example',
  name: 'Example',
  description: '...',
  summary: '...',
  roles: [{
    name: 'items',
    shape: 'int[]',
    accepts: (value) => value.t === 'array' && value.items.every(roleAccepts.int),
    previewHint: '...',
  }],
  preview: { items: { t: 'array', items: [{ t: 'int', v: '1' }] } },
  icon: IconList,
  component: ExampleComponent,
};
```

候補列挙、推奨名による初期 binding、binding の検証は `contract.ts` の純粋関数が担当する。`component` は現在の `Frame` と binding から値を読み、表示できない記録では空状態を描く。view ごとの値の解釈と描画は定義ファイル内に置く。

## 追加手順

1. `views/<view>.tsx` を作り、定義、role 判定、プレビュー、描画を実装する。
2. `registry.tsx` の `templates` に定義を一件登録する。初期選択は登録順の先頭から導出される。
3. `tests/unit/algo-view.test.tsx` に、その view の入力境界と主要な描画結果を追加する。全登録 view の preview と binding の整合性は共通テストで確認する。

`LiveWorkspace.tsx` と `workspace/controller.ts` には view 固有の分岐を追加しない。描画スタイルは view と同じディレクトリに CSS Module を置く。
