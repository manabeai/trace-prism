---
name: viz Data history
description: 実行ごとに独立した汎用データを、共通の観測時点で記録順に読む
colors:
  bg: '#0b1220'
  surface: '#111a2a'
  surface-raised: '#18253a'
  surface-hover: '#22334c'
  line: '#2b3a50'
  text: '#d4deed'
  text-strong: '#f1f5fb'
  muted: '#9aaac1'
  blue: '#80b8ff'
  blue-surface: '#233e62'
  green: '#59d5b1'
  green-surface: '#163e3b'
  amber: '#f4bd67'
  amber-surface: '#352d23'
  removed: '#f1a0a8'
  removed-surface: '#3b252d'
  play: '#386bc0'
  play-hover: '#487bcd'
  current-row: '#17283f'
  table-header: '#142032'
  cell: '#1b293e'
  cell-border: '#384a63'
  line-soft: '#233145'
  unchanged: '#a0b0c7'
typography:
  title:
    fontFamily: '''Noto Sans CJK JP'',''Hiragino Sans'',''Yu Gothic UI'',sans-serif'
    fontSize: 21px
    fontWeight: 600
  body:
    fontFamily: '''Noto Sans CJK JP'',''Hiragino Sans'',''Yu Gothic UI'',sans-serif'
    fontSize: 14px
  data:
    fontFamily: '''Cascadia Code'',''DejaVu Sans Mono'',''Noto Sans CJK JP'',monospace'
    fontSize: 13px
  integer:
    fontFamily: '''Cascadia Code'',''DejaVu Sans Mono'',''Noto Sans CJK JP'',monospace'
    fontSize: 23px
  integer-detail:
    fontFamily: '''Cascadia Code'',''DejaVu Sans Mono'',''Noto Sans CJK JP'',monospace'
    fontSize: 35px
  control:
    fontFamily: '''Noto Sans CJK JP'',''Hiragino Sans'',''Yu Gothic UI'',sans-serif'
    fontSize: 12px
  label:
    fontFamily: '''Noto Sans CJK JP'',''Hiragino Sans'',''Yu Gothic UI'',sans-serif'
    fontSize: 11px
  metadata:
    fontFamily: '''Noto Sans CJK JP'',''Hiragino Sans'',''Yu Gothic UI'',sans-serif'
    fontSize: 10px
  index:
    fontFamily: '''Cascadia Code'',''DejaVu Sans Mono'',''Noto Sans CJK JP'',monospace'
    fontSize: 9px
  mobile-caption:
    fontFamily: '''Noto Sans CJK JP'',''Hiragino Sans'',''Yu Gothic UI'',sans-serif'
    fontSize: 8px
rounded:
  data: 3px
  control: 4px
  notice: 5px
  popover: 6px
spacing:
  tight: 5px
  small: 8px
  control: 12px
  cell: 18px
  section: 24px
components:
  play-button:
    backgroundColor: '{colors.play}'
    textColor: '#fff'
    rounded: '{rounded.control}'
    width: 37px
    height: 33px
  integer-value:
    textColor: '{colors.text}'
    typography: '{typography.integer}'
  array-cell:
    backgroundColor: '{colors.cell}'
    textColor: '{colors.text}'
    typography: '{typography.data}'
    rounded: '{rounded.data}'
    height: 29px
  set-member-added:
    backgroundColor: '{colors.green-surface}'
    textColor: '{colors.green}'
    rounded: '{rounded.data}'
  map-entry-updated:
    textColor: '{colors.amber}'
  history-row-selected:
    backgroundColor: '{colors.current-row}'
    textColor: '{colors.text}'
---

# Design System: viz Data history

## Overview

**Creative North Star: "名前を横に、観測時点を縦に"**

実行履歴から1件を選び、その実行の整数・配列・Set・Mapを、共通のseqで記録順に並べる。複数時点の値を同時に読む履歴表を中心に、選択時点の完全な値をSnapshotで確認する。アルゴリズム名や処理の意味を表示条件に使わない。

既存の濃紺、フラットなpane、細い境界、UIのsansと数値のmonoを継承する。2026-09-30のユーザー指示に基づき、アルゴリズム別の構成から汎用データの履歴へ変更した。

**Key Characteristics:**

- 実行ごとに独立したデータとseq。
- 縦は実行内の共通seq、横は名前付きデータ。
- データ型に応じた比較と描画。
- 追加・更新・削除を値と記号で併記。
- 履歴を保ったままSnapshotと共通の再生位置を同期。

## Colors

正規値はfrontmatter。現在のCSSから抽出した値を使用する。

- Primary: 青は選択時点、focus、再生位置。選択行には控えめな青い面を使う。
- Secondary: 緑は追加、琥珀色は更新。Setの所属追加、配列の新しいindex、Mapのキー追加にも同じ規則を使う。
- Tertiary: 淡い赤は削除。削除された値は差分欄に残す。
- Neutral: 濃紺の背景とpaneを細い線で区切る。変更なしの値も読める明度を保つ。

**The Typed Difference Rule.** 配列はindex、Setは所属、Mapは型付きキーで比較する。SetとMapの列挙順だけの変更を差分にしない。

## Typography

UIは日本語sans、数値・データ名・indexはmono。書体はローカルのfallback stackを使用する。見出しは21px、通常の値は13px前後、単独整数は23px、詳細の整数は35px。補足は10–11px、indexは9px、mobileの短いseq説明は8px。記録内容の主値は補足文字より大きくする。

## Layout

headerは56px、左236pxに実行履歴を置く。中央は選択実行のID・ソース・入力・終了状態と履歴表。タブは使用しない。データの列選択・検索は「データ」メニュー、Snapshotは明示操作で右300pxに開き、閉じるボタンで戻す。再生操作は下部78pxに常設する。列見出しとseq列は表の内部でsticky。内容はpane内でスクロールする。

通常の履歴セルは最小98px高。幅1200px以下ではsidebarを218pxとし、cellの左右余白を縮める。760px以下ではsidebarを上部の「実行履歴」メニューに置換する。データの絞り込みは同じメニューを用い、表は内部横スクロール、Snapshotは履歴と切替表示。再生barは2行、110px高。現在行が見切れたときは、表示に必要な分だけ表を内部スクロールする。

**The Observation Rule.** 選択時点を変更したら、Snapshotと表示中のseqを同時に更新する。履歴行は記録順を保つ。実行切替時は再生を停止し、再生位置・表示列・差分フィルタ・詳細選択は実行別に保持する。

## Elevation & Depth

フラットな面と1pxの境界で領域を分ける。選択した実行は控えめな面と青い実行IDで示す。メニューと通知は境界・背景・重なり順で区別する。

## Shapes

データcellとpaneは3px、buttonは4pxの角丸。現在のseqは小さい円、差分の凡例は小さい矩形。通常focusは青の2px outline、3px offset。履歴cellのfocusは内側に置く。

## Components

- **Run list:** 実行ID、開始時刻、ソース、入力、完了/途中終了、記録件数を表示。サンプル実行を新しい順に並べ、1件を選択する。
- **Playback:** 再生・停止、前後、先頭/末尾、速度、seqとslider。詳細を閉じても常設する。
- **Integer:** 現在値と増減量、前値からの更新を示す。0と負数を通常の値として表示する。
- **Array:** 各値の上にindex。追加と更新をcellで示し、削除は差分欄で示す。空は`[]`と説明を表示する。
- **Set:** 要素をbrace内に表示。所属の追加を緑、削除を差分欄に示す。表示用に値を整列する。空は`∅`と説明。
- **Map:** キーと値を組で表示。キーの追加、削除、既存キーの値更新を分ける。表示用にキーを整列する。空は`{}`と説明。
- **History:** 各行が共通のseq。セルを選ぶとその時点の完全な値を開く。「変更だけ表示」は変更なしのcellを省略し、行の時系列を保つ。

観測値は即時に更新し、記録されていない操作過程を補間しない。reduced-motionではtransitionとanimationを無効化する。描画は型のみに依存する。

## Do's and Don'ts

- Do データ名と型を列見出しに明示する。
- Do 差分の色に追加・削除・更新の記号と値を添える。
- Do 空のコンテナを明示し、過去の観測へ戻れるようにする。
- Don't アルゴリズム名やサンプルIDで描画を分岐させる。
- Don't データの列挙順をSetの意味として扱う。
- Don't サンプル再生を実プロセスの実行として表示する。

根拠: src/styles.css、src/App.tsx、src/ValueView.tsx、src/data.ts。Rasterを配信UIに使用しない。
