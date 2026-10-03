# フロントエンドのリファクタリング設計

本文はリファクタリング時点の設計記録。現在の遷移元ID参照 `fromId` とGraphの表示切替は [v2 Protocol](../protocol/v2/README.md) を参照。

状態: 段階的に実装中。現行の画面、`viz.trace/v2`、Rust SDK、受信サーバーの動作は維持する。旧操作モックと固定データのデザインモックは削除済み。

2026-10-02 の実装では、`trace/` の型・復元・span 階層・関係グラフ、schema に基づく decode、branded な `RunId` / `Seq`、`runs/` の取得ポートと直列ポーリング、実行別状態を持つ workspace controller、値形式と Algo View のレジストリを導入した。履歴行の階層展開には TanStack Table v9 の行モデルを使い、移行した Format Menu のスタイルは CSS Module に置いた。Vitest の単体・コンポーネントテスト、Playwright の操作・axe 検査、ESLint、Prettier、Husky、CI を品質ゲートとして実行する。現行画面の共有スタイルは `workspace.css` に統合した。残る性能計測と CSS Modules の展開は、機能単位で進める。

## 本質

**trace の事実、事実から導出した状態、表示の解釈を分離する。** `seq` は状態を確定する順序、`span` は履歴のグルーピング、`from` は記録間の関係であり、いずれも UI の表示形式を指定しない。二重配列が Matrix か隣接リストかも trace の形だけでは決められない。表示形式と Algo View は、同じ観測値に後から適用・変更できる設定とする。

移行前は `LiveWorkspace.tsx` に API ポーリング、実行選択、materialize、span 行、関係グラフ、列表示、表示形式の判定、Algo View の定義と binding、ダイアログ、描画が集中していた。`formatOptions()` の `switch` は、最初に観測した数値の二重配列に Matrix / Text だけを提示していた。旧 `trace-model.ts` も v1 変換、v2 materialize、span 階層、グラフ射影を併せ持っていた。本設計はこれらの結合を解き、拡張時に中央の分岐を増やさないことを目的とする。

## 依存方向と責務

```text
HTTP / 保存済み trace
  → v1・v2 の decode → 正規化した記録 → materializer → 実行単位の selector
  → workspace controller → 履歴・グラフ・再生・表示設定
  → 値の表示形式レジストリ / Algo View レジストリ → Solid コンポーネント
  → 履歴表に限って TanStack Table アダプター
```

想定するディレクトリ構成。ライブ画面のコードをこの構造へ移す。

```text
src/
  main.tsx
  trace/
    value.ts                v2 の Value 判別共用体・Field・SpanScalar
    ids.ts                  RunId・Seq 等のブランドと検証付き constructor
    decode.ts               unknown → v1/v2 の正規化済み Record
    materialize.ts          snapshot / patch → 時点別 Frame
    diff.ts                 型付きの観測差分
    span-tree.ts            span prefix → HistoryNode[]
    relation-graph.ts       from または span → 記録関係のグラフ
    selectors.ts            run 単位の読み取り専用 selector
  runs/
    RunRepository.ts        データ取得のポート
    HttpRunRepository.ts    /api/runs 用アダプター
    pollRuns.ts             ポーリングと停止処理
  presentations/
    values/
      contract.tsx          ValueFormat<T>・ValuePresentation<K>・型消去アダプター
      registry.tsx          種別ごとのディスパッチと fallback
      kinds/<kind>/         index.ts は登録、<format>.tsx は形式ごとの描画
      shared.tsx            共通の Text fallback
    algo/
      contract.ts           role・binding・解決結果
      registry.ts           定義の検索と binding 検証
      views/                binary-search・grid-traversal 等
  workspace/
    controller.ts           Solid の状態と selector の接続
    WorkspaceShell.tsx      pane・sidebar・dialog の組み立て
    history/
      rows.ts               HistoryNode → 表の行
      columns.ts            raw 値列と Algo View 列の定義
      table-adapter.ts      TanStack Table v9 の設定
      HistoryTable.tsx      表の DOM
    graph/                  記録関係グラフの描画
    playback/               seq の移動・最新追従
tests/
  unit/                    trace・registry・controller の契約
  e2e/                     既存 Playwright テストの移動先
  type/                    ブランドとジェネリック契約の否定例
```

`trace/` は Solid、TanStack、Kobalte、corvu、JSX を import しない。外部入力は `unknown` として受け、境界で検証して正規化する。新しい protocol version には decoder と明示的な型移行を追加し、renderer の追加では wire 型を変えない。レジストリは読み取り専用の materialize 済みの値を受け取り、trace を変更できない。表、グラフ、再生は同じ selector を参照するが、互いの描画オブジェクトには依存しない。

## ブランド型を使う識別子

JavaScript 上は同じ文字列でも混同すると壊れる ID に限って branded type を使う。対象は `RunId`、`Seq`、`ValueName`、`SpanKey`、`ColumnId`、`ViewInstanceId`。通常のラベルやセル値には適用しない。ブランドのシンボルを識別子モジュール内に隠し、constructor だけが検証後にブランドを付与する。

```ts
declare const identity: unique symbol;
type Brand<Name extends string> = string & { readonly [identity]: Name };

type RunId = Brand<'RunId'>;
type Seq = Brand<'Seq'>;                  // 正規形の十進 u64 文字列
type ValueName = Brand<'ValueName'>;
type SpanKey = Brand<'SpanKey'>;          // 型付き span path のエンコード結果
type ColumnId = Brand<'ColumnId'>;        // value:<name> | algo:<instance>
type ViewInstanceId = Brand<'ViewInstanceId'>;
type FrameKey = Readonly<{ runId: RunId; seq: Seq }>;
```

`parseSeq(unknown)` は十進表記の正規形と protocol 上の範囲を検証する。seq の比較・加算には `bigint` を使い、文字列の辞書順や `number` は使わない。wire 上の `from` は `Seq` のままだが、UI 内で frame を一意に指すときは `{ runId, seq }` を使う。`Seq` 型だけでは run の一致を証明できないため、`from` の所属と過去参照は decode 時にも検証する。JSON 化でブランドは消え、復元時に再検証する。レジストリの定義 ID は可能なら文字列リテラル型にし、すべての文字列をブランド化しない。

## 値の表示形式の拡張境界

観測値の `t` ごとに `ValuePresentation<K>` を定義する。種別ディレクトリ内の `index.ts` は形式の登録順と fallback、各 `<format>.tsx` は適用条件とセル描画を所有する。追加規則は [Value 表示形式の追加規則](value-presentations.md) に記す。`registry.tsx` は種別へのディスパッチ、形式候補の列挙、選択形式が適用できない時の fallback だけを扱う。`Value` は判別可能な union とし、各ファイルの renderer には対応する `ValueOf<K>` が渡る。

```ts
interface ValueFormat<T extends Value> {
  id: string;
  label: string | ((value: T) => string);
  icon: IconComponent;
  isApplicable?: (value: T) => boolean;
  render: (value: T) => JSX.Element;
}

interface ValuePresentation<K extends Value['t']> {
  kind: K;
  formats: readonly ValueFormat<Extract<Value, { t: K }>>[];
  fallback: FallbackFormat<Extract<Value, { t: K }>>;
}

declare function defineValuePresentation<K extends Value['t']>(
  definition: ValuePresentation<K>
): ErasedValuePresentation<K>;
```

`defineValuePresentation` が型消去の境界で種別と `isApplicable` を検証する。`registry.tsx` は全 protocol 種別の定義を `satisfies` で網羅し、形式 ID は UI 設定に保存して trace に入れない。ある seq の値が選択中の形式に合わなければ、その種別の Text fallback を使う。空配列や途中で型が変わる変数についても、候補の適用条件と fallback をテストする。将来 Adjacency list を追加する場合は Array のファイルに適用可能な形式を登録し、二重配列を一律にグラフとは見なさない。形式固有の設定は現行契約にまだ含めず、必要な形式を追加するときにシリアライズ形式と併せて設計する。

Number、Badge、Cells、Bars、Matrix、Set の Members/Count、Map の Entries/Count、Record の Fields、Text は種別ごとのファイルへ移した。型付き差分は別の関心事として扱い、見た目から記録されていない操作を事実として推定しない。

## Algo View の拡張境界

Algo View の定義は安定 ID、メタデータ、名前付き role、各 role の型ガード、必須・任意の区別、binding の候補、validator、renderer を持つ。mapped type で role の型を renderer まで伝播させる。レジストリは frame ごとの binding を検証した後にだけ、型を消去する。値が不足するか型が違えば、無検査の参照ではなく型付きの「描画不可」結果を返す。

```ts
type Guarded<G> = G extends ValueGuard<infer T> ? T : never;
type Bound<R extends Record<string, ValueGuard<Value>>> = {
  [K in keyof R]: Guarded<R[K]>;
};

interface AlgoViewDefinition<R extends Record<string, ValueGuard<Value>>> {
  id: string;
  roles: R;
  resolve: (frame: Frame, bindings: Record<keyof R, string>) =>
    { ok: true; values: Bound<R> } | { ok: false; issues: BindingIssue[] };
  render: (values: Bound<R>, frame: Frame) => JSX.Element;
}
```

実装用の契約では任意 role も表現する。たとえば Binary search は predicate が未記録でも pending として描画できる。候補と初期提案は role の型ガードと観測済み field から作り、既存の binding ダイアログで確定する。設定には `viewInstanceId`、定義 ID、bindings、有効状態を分離して持たせ、`runId` ごとに管理する。Binary search と Grid traversal は振る舞いを変えずに移す。アルゴリズムが扱うグラフと、記録間の関係グラフは別の概念として扱う。

## リファクタリング後のコード例

以下は API 形状の例であり、現時点では未実装。Matrix と隣接リストの両方に適合する二重配列でも、表示の解釈をレジストリと UI 設定に任せる。

```tsx
// presentations/values/kinds/array/adjacency-list.tsx
type NumericArray = { t: 'array'; items: ({ t: 'int'; v: string })[] };
type NumericNestedArray = { t: 'array'; items: NumericArray[] };

const isNumericNestedArray = (value: Value): value is NumericNestedArray =>
  value.t === 'array' && value.items.every(
    row => row.t === 'array' && row.items.every(cell => cell.t === 'int')
  );

export const adjacencyListFormat: ValueFormat<ValueOf<'array'>> = {
  id: 'adjacency-list',
  label: 'Adjacency list',
  icon: IconGitBranch,
  isApplicable: isNumericNestedArray,
  render: value => <AdjacencyList rows={value.items} />,
};
```

```tsx
// presentations/algo/binary-search.tsx
export const binarySearchView = defineAlgoView({
  id: 'binary-search',
  roles: {
    left: required(isInteger),
    right: required(isInteger),
    mid: required(isInteger),
    predicate: optional(isBoolean),
  },
  render: ({ left, right, mid, predicate }) =>
    <BinarySearchTrack left={left} right={right} mid={mid} predicate={predicate} />,
});
```

```tsx
// workspace/LiveWorkspace.tsx
const formats = createValueFormatRegistry([
  numberFormat, cellsFormat, barsFormat, matrixFormat, textFormat,
  adjacencyListFormat,
]);
const algoViews = createAlgoViewRegistry([binarySearchView, gridTraversalView]);

export function LiveWorkspace() {
  const workspace = createWorkspaceController({
    runs: httpRunRepository,
    formats,
    algoViews,
  });
  return <WorkspaceShell model={workspace} />;
}
```

`LiveWorkspace` に表示形式やアルゴリズムごとの分岐を置かない。`adjacencyListFormat` を登録しても初期選択は従来の Matrix のままにでき、ユーザーが列見出しのメニューで切り替える。Algo View は複数値の binding を解決して seq ごとの列へ描画する。これらは wire や materializer を変更しない。

## 各レイヤのコード例

以下は入出力と依存関係を示す設計例。import、エラー型の全フィールド、DOM の細部は省略する。実装時には各ファイルを型検査し、現行の API とテストに合わせて確定する。

### 識別子・decode: 外部入力を検証して内部型へ変換

```ts
// trace/ids.ts
const MAX_U64 = (1n << 64n) - 1n;

export function parseSeq(input: unknown): Seq {
  if (typeof input !== 'string' || !/^(0|[1-9][0-9]*)$/.test(input)) {
    throw new DecodeError('seq must be a canonical decimal string');
  }
  if (BigInt(input) > MAX_U64) throw new DecodeError('seq exceeds u64');
  return input as Seq; // ブランドの assert は検証済み constructor 内だけ
}

// trace/decode.ts
export function decodeRecord(raw: unknown): TraceRecord {
  const wire = validateV1OrV2(raw);
  return {
    ...normalizeWireRecord(wire),
    runId: parseRunId(wire.runId),
    seq: parseSeq(wire.seq),
    from: wire.from == null ? undefined : parseSeq(wire.from),
  };
}
```

decode は run 全体で seq が連続することと、`from` が同一 run の過去の記録を指すことも検証する。v1 と v2 の差はここで吸収し、下流は正規化済み `TraceRecord` だけを扱う。

### Materializer: `from` と独立した時系列状態

```ts
// trace/materialize.ts
export function applyRecord(previous: Frame | undefined, record: TraceRecord): Frame {
  const values = record.kind === 'snapshot'
    ? new Map<ValueName, Field>()
    : new Map(previous?.values);

  if (record.kind === 'snapshot') {
    for (const field of record.values) values.set(field.name, field);
  } else {
    for (const op of record.ops) {
      if (op.op === 'drop') values.delete(op.name);
      else values.set(op.name, { name: op.name, value: op.value, sourceType: op.sourceType });
    }
  }

  return { runId: record.runId, seq: record.seq, span: record.span,
    from: record.from, values };
}
```

patch の適用元は常に直前の seq の状態。`from` は Frame に保持するが、`values` の構築には使わない。span 木と関係グラフは、この Frame 列から別々に導出する。

### Repository: 取得手段と protocol を UI から隠す

```ts
// runs/RunRepository.ts
export interface RunRepository {
  list(signal?: AbortSignal): Promise<readonly Run[]>;
}

// runs/HttpRunRepository.ts
export class HttpRunRepository implements RunRepository {
  async list(signal?: AbortSignal): Promise<readonly Run[]> {
    const response = await fetch('/api/runs', { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload: unknown = await response.json();
    return decodeRunList(payload);
  }
}
```

将来ファイル再生や WebSocket を追加しても、workspace は `RunRepository` だけを参照する。ポーリングの間隔と停止は `pollRuns.ts` が担当する。

### 値の表示形式: 種別ごとの実装と型消去

```tsx
// presentations/values/kinds/array/index.ts
export const arrayPresentation = defineValuePresentation<'array'>({
  kind: 'array',
  formats: [arrayMatrixFormat, arrayCellsFormat, arrayBarsFormat],
  fallback: textFormat(),
});
```

各形式は `ValueFormat<ValueOf<K>>` の契約を満たす。`defineValuePresentation` は異種の定義を registry へ集約するためのアダプターであり、`kind` と `isApplicable` のガード、および `ValueOf<K>` から `Value` への型消去を一箇所に閉じ込める。戻り型の `ErasedValuePresentation` は registry 内部用で、各種別が直接実装するインターフェースではない。履歴表には `switch (value.t)` や `switch (formatId)` を置かない。

### Algo View: role の解決を描画から分離

```tsx
// presentations/algo/views/grid-traversal.tsx
export const gridTraversalView = defineAlgoView({
  id: 'grid-traversal',
  roles: { board: required(isNumericMatrix), position: required(isPosition) },
  render: ({ board, position }) =>
    <GridTraversal board={board} position={position} />,
});

// presentations/algo/registry.ts
const result = algoViews.resolve('grid-traversal', frame, {
  board: valueName('board'), position: valueName('pos'),
});
// result: { ok: true, values: { board, position } }
//      | { ok: false, issues: [...] }
```

UI は role ごとに `accepts` を満たす記録変数を候補として列挙する。binding は run ごとの設定であり、trace の値には書き戻さない。

### Workspace controller: Solid の状態と純粋なモデルの接続

```ts
// workspace/controller.ts（主要部分の抜粋）
export function createWorkspaceController(repository: RunRepository) {
  const [runs, setRuns] = createSignal<readonly Run[]>([]);
  const [runId, setRunId] = createSignal<RunId | null>(null);
  const [selectedSeq, setSelectedSeq] = createSignal<Seq | null>(null); // null は最新追従

  const run = createMemo(() => runs().find(item => item.id === runId()) ?? runs()[0]);
  const frames = createMemo(() => materialize(run()?.records ?? []));
  const currentSeq = createMemo(() => selectedSeq() ?? frames().at(-1)?.seq ?? null);

  onMount(() => {
    const stop = pollRuns(repository, setRuns);
    onCleanup(stop);
  });

  return { runs, run, frames, currentSeq,
    selectRun: (id: RunId) => { setRunId(id); setSelectedSeq(null); },
    selectSeq: setSelectedSeq };
}
```

controller は選択状態を持ち、`trace/` の materialize と selector を呼ぶ。値の解釈や `<table>` の DOM は持たない。列表示、形式選択、Algo View インスタンスなどは run ID をキーにした別の UI state として加える。

### 履歴表アダプター: 表の操作だけを TanStack に委譲

```tsx
// workspace/history/table-adapter.ts
const features = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  columnVisibilityFeature,
});

export function createHistoryTable(props: {
  runId: RunId;
  rows: Accessor<HistoryNode[]>;
  columns: Accessor<ColumnDef<HistoryNode>[]>;
}) {
  return createTable({
    features,
    get data() { return props.rows(); },
    get columns() { return props.columns(); },
    getSubRows: row => row.kind === 'span' ? row.children : undefined,
    getRowId: row => row.kind === 'span'
      ? `${props.runId}/span:${row.key}`
      : `${props.runId}/seq:${row.frame.seq}`,
    autoResetExpanded: false,
  });
}
```

`HistoryTable.tsx` は span 行を `colSpan` 付きのグループ行、frame 行を列セルとして描画する。行 ID に run ID を含めて実行切替時の衝突を防ぐ。表の row model に `seq` の順序や `span` の意味を推論させず、選択中の seq と graph 表示は controller 側に残す。

### 画面の組み立て: アルゴリズム別の分岐を持たない

```tsx
// workspace/WorkspaceShell.tsx
export function WorkspaceShell(props: { model: WorkspaceController }) {
  return <WorkspaceLayout
    sidebar={<RunList runs={props.model.runs} onSelect={props.model.selectRun} />}
    main={<HistoryTable model={props.model.history} />}
    footer={<Playback model={props.model.playback} />}
  />;
}
```

`LiveWorkspace` は repository と二種類の registry を注入する入口、`WorkspaceShell` は UI の配置、個別 renderer は観測値の表示を担当する。新しい表示形式や Algo View によって controller や Shell が分岐を増やさないことを、拡張契約のテストでも確認する。

## 履歴表と TanStack Table

履歴表の操作には `@tanstack/solid-table` v9 を採用する。Solid アダプターの `createTable` に必要な feature を明示登録する。すでに導出した span 木の行展開、値と Algo View の列表示、必要になったときの列幅管理を担当させる。`getSubRows` を使い、行 ID は run ID を含む `run/span:<encoded path>` または `run/seq:<decimal seq>`、列 ID は `value:<field name>` または `algo:<view instance ID>` とする。span 行は全列幅のグループ行、記録行は型付きセルを描画する。記録順と span の意味は trace model が持つため、表側のソート、グルーピング、ページネーション、フィルタリングは有効にしない。「Changes only」は変化のないセルの内容を省略し、観測記録そのものは削除しない。

Table アダプターは `HistoryNode[]`、`ColumnDescriptor[]`、制御された UI 状態を入力とし、選択・展開・列表示の操作を出力する。グラフと再生 UI は TanStack の行オブジェクトを参照しない。移行時には DOM の意味と CSS class を維持し、既存の操作テストと画面比較を利用する。

TanStack Table 自体には行の仮想化がない。大きな trace で DOM のコストが問題になれば、行数と高さが変わる Matrix セルを実測してから `@tanstack/solid-virtual` を追加する。現在は全実行を毎秒取得するたびに履歴全体を materialize し直すため、ポーリングを `RunRepository` の背後に隔離する。増分 append と構造共有の導入に備えるが、最適化前に純粋な reducer と結果が一致することを検証する。

## Workspace の状態と操作

controller は選択中の run、選択中の seq（明示的な「最新を追う」状態を含む）、実行ごとの列表示、形式、Algo View のインスタンス、span の展開、表・グラフの切り替え、差分のみ表示を管理する。selector は読み取り専用で memoize された frame と列を返す。Solid の reactivity を保つため、UI にはコピーした snapshot ではなく accessor または導出値を渡す。Dialog と Popover は引き続き Kobalte、pane のリサイズは corvu に任せる。設定の保存境界は trace とコンポーネントの双方から分離するが、初回実装は現状を保つためメモリ内でもよい。

## 検証と静的解析

純粋な処理と限定した Solid コンポーネントの契約には Vitest、一連の操作には Playwright を使う。単体テストの対象は v1/v2 decode、snapshot/patch の materialize、ブランド ID の不正値拒否と名前空間分離、大きな seq、`from` と時系列の独立、span の prefix と ID の再出現、行・列 ID の安定性、表示形式の適用判定とフォールバック、role の候補、binding の検証、実行ごとの状態分離。`RunId`、`Seq`、`ValueName`、`ColumnId` の混同には `@ts-expect-error` によるコンパイル時の否定例も置く。Format Menu と binding ダイアログの操作・アクセシビリティはコンポーネントテストで確認する。既存の Playwright テストは実行選択、表・グラフの切り替え、再生、形式変更、Algo View 追加の受け入れ基準として残す。表の renderer を置き換える前に desktop と compact layout の画面比較用画像を採取する。

ESLint の flat config に `eslint-plugin-solid` の TypeScript 向けルール、特に `solid/reactivity`、`solid/no-destructure`、`solid/prefer-for` を入れる。TypeScript には `typescript-eslint`、型検査には `tsc --noEmit` を使う。`strict` を維持し、危険な添字アクセスを直してから `noUncheckedIndexedAccess` を追加する。1.0 未満の Solid plugin は minor version を固定する。Node 22.12.0 では `@typescript-eslint` 8.71.0 の間接依存が Node 22.13.0 を要求するため、TypeScript 5.9.3 と `typescript-eslint` 8.55.0 に固定し、Solid plugin の `@typescript-eslint/utils` も同版へ override する。

Husky の `pre-commit` では lint-staged による staged file の ESLint/Prettier、プロジェクト全体の型検査、単体テストを実行する。CI の `npm run check` は全対象の lint・format check・型検査・単体テストを行い、さらに build、protocol テスト、Playwright、Rust の検査を実行する。Husky はチェックの起動役であり、CI の代わりではない。Git repository は今回作成したので、実装時には hook の動作をこの repository で確認できる。

## 追加しておくべき作業と依存

### 作業

1. **基準点を固定する。** リファクタ前のコード、例題、protocol、デザイン資料は `8c4f294` に保存済み。既存 UI の主要状態を Playwright のスクリーンショット比較で固定する。描画差の検査は同じブラウザ・フォント・OS 環境で行う。
2. **依存方向を機械的に検査する。** `trace/` から `workspace/`、`presentations/`、Solid、TanStack への import を ESLint の `no-restricted-imports` で禁止する。`runs/` も UI を import しない。設計書だけに書いた境界を CI で破れないようにする。
3. **protocol schema を単一の真実源にする。** 既存の `protocol/v2/trace.schema.json` と Ajv を再利用し、browser 側の validator が必要なら Ajv の standalone code を build 時に生成する。別の Zod/Valibot schema を手書きで並行管理しない。v1 の互換入力は専用 decoder に閉じ込める。
4. **取得の競合と失敗を設計する。** `RunRepository.list(signal?: AbortSignal)` にして不要な要求を中止可能にし、前のポーリングが終わる前に次の要求を重ねない。通信失敗、壊れた run、実行中の末尾更新を別の状態として扱い、選択中の run と seq を不用意に戻さない。
5. **性能の基準を測る。** 41 record の例だけでなく、1,000・10,000 record と大きい Matrix の fixture で materialize 時間、再描画、DOM 数、メモリを測る。増分 materialize、Web Worker、行の仮想化は実測のボトルネックに応じて導入する。
6. **CSS の移行単位を決める。** 現行のグローバル CSS とスクリーンショットを基準に、移したコンポーネントから feature 単位の CSS Modules へ寄せる。色・書体・間隔は共通 token に置き、既存画面を一括で再デザインしない。Vite の標準機能で足りるため CSS-in-JS は追加しない。

### 追加するパッケージ

| 目的 | パッケージ | 判断 |
| --- | --- | --- |
| 履歴表の列・展開 | `@tanstack/solid-table` v9 | このリファクタで採用。表の操作にだけ使用する。 |
| 単体・コンポーネントテスト | `vitest`, `@solidjs/testing-library`, `jsdom` v28 | このリファクタで採用。純粋なロジックは DOM なしでテストする。 |
| 静的解析 | `eslint` v9, `@eslint/js`, `typescript-eslint`, `eslint-plugin-solid` | このリファクタで採用。Solid の reactivity と依存方向を検査する。 |
| hook・整形 | `husky`, `prettier`, `lint-staged` v16 | このリファクタで採用。staged file の整形と高速な品質ゲートを組む。 |
| アクセシビリティ検査 | `@axe-core/playwright` | 主要画面・Dialog・Popover の E2E に追加する。手動のキーボード操作確認も残す。 |

2026-10-02 時点の Node は `22.12.0`。ESLint 10 は `22.13.0` 以上、lint-staged 17 は `22.22.1` 以上、jsdom 30 は `22.22.2` 以上を要求するため、互換のある ESLint 9、lint-staged 16、jsdom 28.1.0 を選んだ。TypeScript は前述のとおり 5.9.3 に固定した。lockfile にもバージョンを記録する。

`ajv` は既存の依存を再利用する。`@tanstack/solid-virtual`、TanStack Query、MSW、別の schema ライブラリ、追加のグラフ描画ライブラリは初期移行には入れない。前者は計測後に判断し、他は現行の repository 境界、Playwright の route mock、既存 schema、SVG 描画で要求を満たせる。現行の TypeScript と CSS はすべて Prettier のチェック対象にした。

Tailwind は現時点では導入しない。既存画面の見た目はグローバル CSS と固有 class によって定まっており、今回の移行単位は feature 別 CSS Modules と共通 token にする。Tailwind を重ねると style の所有境界が二つになるため、移行後に utility class が必要な箇所を実測して再判断する。

## 移行順序と完了条件

1. モデルの単体テストと選んだ画面比較画像で既存動作を固定し、lint と型検査の基準を作る。
2. decode、materialize、span 階層、関係グラフを、出力を変えずに純粋なモジュールへ分離する。
3. 値の表示形式と Algo View のレジストリを導入し、メニューと初期表示を維持しながら既存実装を一つずつ移す。
4. workspace controller と RunRepository 境界を導入し、ポーリングと実行ごとの UI 状態の挙動を保つ。
5. アダプターの背後にある履歴表を TanStack Table v9 に置き換え、選択、入れ子の展開、列メニュー、表とグラフの整合を検証する。
6. Husky と CI の品質ゲートを有効にする。その後、実測した trace に基づいて仮想化や増分 materialize を検討する。

完了条件は動作と構造の両方に置く。同じ v2 trace と現行サンプルが同じように表示されること。ドメインモジュールが UI framework を import しないこと。値の renderer または Algo View の追加が、materializer・表・workspace shell の編集ではなく、個別実装とレジストリへの登録で完結すること。単体テスト、型検査、lint、build、ブラウザテストが通ること。

## 参照資料

- [TanStack Table v9: Solid のクイックスタート](https://tanstack.com/table/latest/docs/framework/solid/quick-start)
- [TanStack Table v9: Solid の行展開](https://tanstack.com/table/latest/docs/framework/solid/guide/expanding)
- [TanStack Table v9: Solid の列表示](https://tanstack.com/table/latest/docs/framework/solid/guide/column-visibility)
- [TanStack Table: 仮想化ガイド](https://tanstack.com/table/v8/docs/guide/virtualization)
- [Solid 向け ESLint plugin](https://github.com/solidjs-community/eslint-plugin-solid)
- [Husky の導入手順](https://typicode.github.io/husky/get-started.html)
- [Solid Testing Library](https://testing-library.com/docs/solid-testing-library/intro/)
- [ESLint `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports)
- [Prettier の導入](https://prettier.io/docs/install.html)
- [lint-staged](https://github.com/lint-staged/lint-staged)
- [Playwright のスクリーンショット比較](https://playwright.dev/docs/test-snapshots)
- [Ajv の standalone validator](https://ajv.js.org/standalone.html)
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md)
