# Value 表示形式の追加規則

Value の wire type と表示形式は別の軸。`array` を Matrix、Cells、Bars のいずれで表示するかは UI 設定で決め、trace には表示形式を記録しない。各セルはその時点の `Value` から描画する。

## 配置と責務

```text
src/presentations/values/
  contract.tsx            ValueFormat<T>・ValuePresentation<K>・型消去境界
  registry.tsx            Value.t によるディスパッチ、候補取得、fallback
  shared.tsx              全種別に共通する Text fallback
  kinds/
    array/
      index.ts            登録順と fallback のみ
      cells.tsx           Cells の適用条件・ラベル・アイコン・描画
      bars.tsx            Bars の適用条件・ラベル・アイコン・描画
      matrix.tsx          Matrix の適用条件・ラベル・アイコン・描画
    map/
      index.ts
      entries.tsx
      count.tsx
    ...
```

**一つの表示形式を一つのファイルに置く。** `kinds/<kind>/index.ts` は `formats` の順序と fallback を宣言し、JSX・値の形状判定・サイズ計算を置かない。表示形式のファイルは `ValueFormat<ValueOf<'kind'>>` を `satisfies` で満たす。これにより renderer の入力型はその種別に固定される。新しい形式を追加しても `registry.tsx` や `LiveWorkspace.tsx` に分岐を増やさない。

```tsx
// kinds/array/bars.tsx
export const arrayBarsFormat = {
  id: 'bars',
  label: 'Bars',
  icon: IconChartBar,
  isApplicable: isNumericArray,
  render: (value) => <Bars value={value} />,
} satisfies ValueFormat<ValueOf<'array'>>;
```

`isApplicable` は `Value.t` の照合後に評価される、同じ種別内での適用条件。数値配列限定の Bars には必要だが、すべての Set に適用できる Count では省略する。形式 ID は**同じ種別内で一意**にし、既存 ID の意味を変更しない。`cells` や `count` のように、異なる種別間で同じ ID を使うことはできる。登録時に重複 ID を検出する。

各 `index.ts` では通常形式を表示したい順に並べ、最後に必須の Text fallback を置く。fallback はその種別の全値を表示できるため、`isApplicable` を指定できない。選択中の形式が後の seq の値に合わない場合は、その seq だけ fallback を描画する。空配列のように形状を推定できない値の扱いも、各形式の適用条件として明示する。

## 追加手順

1. `kinds/<kind>/<format>.tsx` を作成し、安定した ID、ラベル、アイコン、必要なら `isApplicable`、描画を定義する。描画が複雑なら同じファイル内のコンポーネントに切り出す。スタイルを追加するときは同じディレクトリの CSS Module を使う。
2. 同じディレクトリの `index.ts` に import し、`formats` の適切な位置に加える。
3. 候補の出現条件、適用時の描画、非適用時の Text fallback を `tests/unit/value-formats.test.ts` で確認する。見た目や操作が複雑なら E2E でも確認する。

新しい **Value 種別**を protocol に追加するときは、`trace/types.ts` の判別可能 union と `kinds/<kind>/` を追加し、`registry.tsx` の網羅的な map に登録する。これは表示形式の追加とは別の変更である。`Value` の形だけからアルゴリズムの意味は推定しない。
