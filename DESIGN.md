---
name: algo-vis Field Notes
description: 実行記録を読むための静かな紙面
colors:
  canvas: '#f1f2ec'
  sheet: '#fafbf7'
  sidebar: '#e9ede6'
  ink: '#263e39'
  muted: '#52675c'
  rule: '#cbd6cc'
  action: '#3f7065'
  action-hover: '#315e53'
  soft: '#e2eee6'
  copper: '#ae724e'
  copper-ink: '#875737'
  copper-soft: '#f5ebe1'
  error: '#954f4e'
typography:
  display:
    fontFamily: 'Newsreader Variable, Georgia, serif'
    fontWeight: 500
    lineHeight: 1
  body:
    fontFamily: 'IBM Plex Sans Variable, sans-serif'
  data:
    fontFamily: 'IBM Plex Mono, monospace'
rounded:
  flat: '2px'
  small: '3px'
  medium: '4px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
components:
  button-primary:
    backgroundColor: '{colors.action}'
    textColor: '#fff'
    rounded: '{rounded.small}'
    padding: '8px 12px'
  button-primary-hover:
    backgroundColor: '{colors.action-hover}'
  button-secondary:
    backgroundColor: '{colors.sheet}'
    textColor: '{colors.ink}'
    rounded: '{rounded.small}'
    padding: '8px 12px'
---

# algo-vis のデザインシステム

## Overview

**Creative North Star: "Field Notes"**

競技プログラミングの実行を「読み返せる観察記録」として扱う。紙に近い面、細い罫線、控えめな緑を基調にし、seq と値の変化を読むことに視線を集中させる。装飾的なカードの積み重ねではなく、実行単位・span・値列という情報構造そのものを画面の階層にする。

アプリと `/catalog` と Storybook は Field Notes の色・書体トークンを共有する。角丸や余白はコンポーネントと文脈に応じて調整する。比較用の `/flavors` は独立した検討資料であり、現行画面の規範ではない。

**Key Characteristics:**

- 紙面とサイドバーの穏やかな面差、細い罫線。
- 見出しは Newsreader、操作文は IBM Plex Sans、seq と値は IBM Plex Mono。
- 緑は操作と選択、銅色は値の変化と一部の型マーカーに割り当てる。

## Colors

原始トークンの正本はこの frontmatter と [実装トークン](src/design/field-notes-tokens.css)に対応する。実装側では `--fn-*` を使い、機能別 CSS はそれを参照する。

### Primary

- **Action green:** 実行位置、選択状態、主要操作、フォーカスを示す。hover は専用の深い緑を使う。

### Secondary

- **Copper:** 値の差分と変更された要素を強調する。Set・真偽値の型マーカーにも使うが、通常の数値や汎用操作には使わない。

### Neutral

- **Canvas:** 作業領域の下地。
- **Sheet:** 履歴表・ツールバー・オーバーレイの面。
- **Sidebar:** 値選択と実行履歴の領域。
- **Ink / Muted:** 本文と補助情報。
- **Rule / Soft:** 境界と hover・展開状態。

**The Change Color Rule.** 値セル内の銅色は「この観測点で変化した」という意味を保つ。色だけに依存せず、セルの形・境界・値も残す。

## Typography

**Display Font:** Newsreader Variable（Georgia fallback）。
**Body Font:** IBM Plex Sans Variable。
**Data Font:** IBM Plex Mono。

Newsreader は画面名、節名、ダイアログ見出し、カタログの導入見出しに使う。長い説明や操作ラベルは Sans、時系列の番号・span・ソース位置・値は Mono とする。値を比較する箇所では等幅数字を使い、列が揺れないようにする。

**The Three Voice Rule.** 見出し・操作・データの三つの声を混ぜない。同一セル内で複数書体が必要なら、役割の違いが読解に必要な場合に限る。

## Layout

実行履歴と表示列の選択を左に置き、右側を履歴表とグラフの主作業領域とする。デスクトップでは左パネルを狭く保ち、記録列の横幅を優先する。アプリは 950px 以下で左右を縦に積み、620px 以下でサイドバー内も縦に積む。履歴表は横スクロールで列幅を保つ。カタログは 900px 以下で書体見本を一列にし、650px 以下でナビゲーションを横並びにする。表は密度を保ち、見出しと操作の周囲は余白を広めに取る。

## Elevation & Depth

常設面は罫線と面色の差で分ける。影はポップオーバー、ツールチップ、ダイアログの前後関係と、選択中の表示切り替えボタンに使う。通常の値セルや行は浮かせない。選択行は緑の細い端線、変更セルは銅色の面と境界で見分ける。

## Shapes

基本の角は小さく、表・メニュー・ボタンは直線的に扱う。丸形はステータス点とグラフノードに、カプセル形は Set の要素に使う。細い境界線は表の比較軸を示すものであり、装飾的な枠を重ねない。

## Components

### Buttons

主要操作は Action green の面と白文字。補助操作は Sheet の面と細い境界を使い、hover は Soft に変える。キーボードフォーカスは緑の 2px アウトラインを表示する。

### Navigation and run history

左パネルは Sidebar、選択中の実行は Soft の面に緑の端線を加える。実行名、時刻、レコード数は書体と濃度で優先順位を付ける。操作部のアイコンは Tabler を使う。

### Value cells and format menu

値の型は表示レジストリに従う。配列の cells / bars / text、行列、Set、Map などの選択肢は列見出しのアイコンから開く。ポップオーバーには表示形式のアイコンと名前を並べ、選択中を Soft と緑で示す。変更された要素は銅色で示す。

### Dialogs and Algo Views

ダイアログは Sheet の面と細い Rule、十分な余白を使う。Algo View の選択肢はアイコン・名前・短い説明を持ち、選択後に必要な値を割り当てる。記録に含まれる変数名を割り当て欄の近くに表示する。

## Do's and Don'ts

### Do

- **Do** seq、span、値の階層を余白・罫線・書体で読ませる。
- **Do** 差分を要素単位で示し、時系列を遡っても同じ意味を保つ。
- **Do** 新しいコンポーネントを Storybook に実状態の story として追加する。

### Don't

- **Don't** アルゴリズムの意味を一般的な値セルに埋め込む。Algo View の責務として扱う。
- **Don't** 銅色を通常のアクション色として使う。
- **Don't** 比較資料の色・書体を現行画面へ混ぜる。
