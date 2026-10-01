import { test,expect,type Page } from '@playwright/test';
import { mkdir,readFile } from 'node:fs/promises';
import { changes,runs,type Value } from '../src/data';

test('Setは所属・Mapは型を区別したキーで比較し、列挙順の変更を差分にしない',()=>{
  expect(changes({kind:'set',items:[1,'1',null]},{kind:'set',items:[null,'1',1]})).toEqual([]);
  expect(changes({kind:'set',items:[1,'1']},{kind:'set',items:['1']})).toEqual([{kind:'remove',path:'',before:1}]);
  expect(changes({kind:'map',entries:[[1,'a'],['1','b']]},{kind:'map',entries:[['1','b'],[1,'a']]})).toEqual([]);
  expect(changes({kind:'map',entries:[['key',null]]},{kind:'map',entries:[['key',0]]})).toEqual([{kind:'update',path:'"key"',before:null,after:0}]);
});

test.describe('Data history',()=>{
  test.beforeEach(async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    (page as Page & {runtimeErrors:string[]}).runtimeErrors=errors;
    await page.goto('/?legacy');await expect(page.getByRole('heading',{name:/値の履歴/})).toBeVisible();
    await expect(page.locator('.history-table tbody tr')).toHaveCount(12);
  });
  test.afterEach(async({page})=>expect((page as Page & {runtimeErrors:string[]}).runtimeErrors).toEqual([]));

  test('4種類の値を共通のseq順に並べ、更新・追加・削除を表示する',async({page})=>{
    await expect(page.locator('.object-heading code')).toHaveText(['count','values','active','scores']);
    expect(await page.locator('tbody tr').evaluateAll(rows=>rows.map(r=>Number((r as HTMLElement).dataset.seq)))).toEqual(Array.from({length:12},(_,i)=>i));
    await expect(page.locator('[data-seq="1"] [data-object="count"] .integer-value>span').first()).toHaveText('1');
    await expect(page.locator('[data-seq="2"] .array-box.updated')).toHaveText('9');
    await expect(page.locator('[data-seq="3"] .set-item.added')).toHaveText('4');
    await expect(page.locator('[data-seq="6"] .change-remove')).toHaveText('−1');
    await expect(page.locator('[data-seq="7"] .change-add')).toHaveText('"gamma":+3');
    await expect(page.locator('[data-seq="7"] .change-remove')).toHaveText('"beta":−1');
    await expect(page.locator('[data-seq="4"] [data-object="scores"] .map-pair.updated')).toHaveText('"alpha":5');
  });

  test('セル選択で正しい過去の値を開き、seekでSnapshotも同期する',async({page})=>{
    await page.getByRole('button',{name:'active の記録 6 を詳しく見る',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText('seq 06');
    await expect(page.locator('.inspector .set-item')).toHaveText(['3','4']);
    await expect(page.locator('.inspector .change-remove')).toHaveText('−1');
    await page.getByRole('slider',{name:'観測時点'}).fill('3');
    await expect(page.locator('.inspector .set-item')).toHaveText(['1','3','4']);
    await page.getByRole('button',{name:'最後の記録',exact:true}).click();
    await expect(page.locator('.inspector .empty-value')).toContainText('空のSet');
    await page.getByRole('button',{name:'選択時点の値',exact:true}).click();
    await expect(page.locator('.inspector .empty-value')).toHaveCount(3);
    await page.getByRole('button',{name:'最初の記録',exact:true}).click();
    await expect(page.locator('.inspector .array-box')).toHaveText(['3','1','4','1','5']);
    await expect(page.locator('.inspector .map-pair')).toHaveText(['"alpha":2','"beta":1']);
  });

  test('列の表示と変更だけ表示を切り替えても時系列を保持し、空表示から復帰する',async({page})=>{
    await page.getByRole('checkbox',{name:'変更だけ表示',exact:true}).check();
    await expect(page.locator('[data-seq="1"] [data-object="values"]')).toContainText('変更なし');
    await expect(page.locator('[data-seq="1"] [data-object="values"] .array-box')).toHaveCount(0);
    await expect(page.locator('[data-seq="0"] .array-box')).toHaveCount(5);
    await page.locator('.data-filter>summary').click();
    for(const id of ['count','values','active','scores'])await page.getByRole('checkbox',{name:`${id} を表示`,exact:true}).uncheck();
    await expect(page.getByRole('heading',{name:'表示するデータを選択',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'すべて表示する',exact:true}).click();
    await expect(page.locator('tbody tr')).toHaveCount(12);
    await expect(page.getByTestId('position')).toHaveText('seq 04');
    await page.locator('.data-filter>summary').click();
    await page.getByRole('textbox',{name:'データを検索'}).fill('Map');
    await expect(page.locator('.object-toggle')).toHaveCount(1);
    await expect(page.locator('.object-toggle')).toContainText('scores');
  });

  test('再生・末尾停止・末尾からの再開とキーボード移動が動く',async({page})=>{
    await page.getByRole('slider',{name:'観測時点'}).fill('10');
    await page.getByRole('combobox',{name:'再生速度'}).selectOption('4');
    await page.getByRole('button',{name:'再生する',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText('seq 11');
    await expect(page.getByRole('button',{name:'再生する',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'再生する',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText('seq 00');
    await page.getByRole('button',{name:'再生を停止',exact:true}).click();
    await page.locator('body').click({position:{x:2,y:2}});
    await page.keyboard.press('ArrowRight');await expect(page.getByTestId('position')).toHaveText('seq 01');
    await page.keyboard.press('End');await expect(page.getByTestId('position')).toHaveText('seq 11');
  });

  test('タブを使わずSnapshotを開閉し、履歴表を表示し続ける',async({page})=>{
    await expect(page.locator('[role="tab"],[role="tablist"],.dv-tab')).toHaveCount(0);
    await page.getByRole('button',{name:'選択時点の値',exact:true}).click();
    await expect(page.getByRole('complementary',{name:'Snapshot',exact:true})).toBeVisible();
    await expect(page.locator('.history-table')).toBeVisible();
    await page.getByRole('button',{name:'Snapshotを閉じる',exact:true}).click();
    await expect(page.locator('.inspector')).toHaveCount(0);
    await expect(page.getByTestId('position')).toHaveText('seq 04');
  });

  test('実行ごとにseq・同名の値・表示対象・詳細の選択を独立して保持する',async({page})=>{
    await page.getByRole('button',{name:'active の記録 6 を詳しく見る',exact:true}).click();
    await page.locator('.data-filter>summary').click();
    await page.getByRole('checkbox',{name:'values を表示',exact:true}).uncheck();
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox',{name:'変更だけ表示',exact:true}).check();
    await page.getByRole('button',{name:'最後の記録',exact:true}).click();
    await page.getByRole('button',{name:'run 002 を開く',exact:true}).click();
    await expect(page.getByTestId('run-number')).toHaveText('run 002');
    await expect(page.getByTestId('position')).toHaveText('seq 00');
    await expect(page.locator('tbody tr')).toHaveCount(8);
    await expect(page.locator('.object-heading code')).toHaveText(['count','values','scores']);
    await expect(page.locator('[data-seq="0"] .integer-value')).toHaveText('100');
    await expect(page.locator('[data-seq="0"] .array-box')).toHaveText(['8','6','7']);
    await expect(page.locator('.inspector')).toHaveCount(0);
    await expect(page.getByRole('checkbox',{name:'変更だけ表示',exact:true})).not.toBeChecked();
    await page.getByRole('button',{name:'count の記録 3 を詳しく見る',exact:true}).click();
    await expect(page.locator('.inspector .integer-value')).toHaveText('101');
    await page.getByRole('button',{name:'run 001 を開く',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText('seq 00');
    await expect(page.locator('tbody tr')).toHaveCount(5);
    await expect(page.locator('.object-heading code')).toHaveText(['count','values']);
    await expect(page.locator('.run-notice')).toContainText('5 件');
    await expect(page.locator('[data-seq="0"] .integer-value')).toHaveText('10');
    await page.getByRole('button',{name:'run 003 を開く',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText('seq 11');
    await expect(page.locator('.object-heading code')).toHaveText(['count','active','scores']);
    await expect(page.getByRole('checkbox',{name:'変更だけ表示',exact:true})).toBeChecked();
    await expect(page.locator('.inspector .empty-value')).toContainText('空のSet');
    await page.getByRole('button',{name:'run 002 を開く',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText('seq 03');
    await expect(page.locator('.inspector .integer-value')).toHaveText('101');
  });

  test('実行の切り替えで再生を停止し、新しい実行へタイマーを持ち越さない',async({page})=>{
    await page.clock.install();
    await page.getByRole('button',{name:'再生する',exact:true}).click();
    await page.clock.runFor(1000);
    await expect(page.getByTestId('position')).toHaveText('seq 05');
    await page.getByRole('button',{name:'run 002 を開く',exact:true}).click();
    await page.clock.runFor(3000);
    await expect(page.getByTestId('position')).toHaveText('seq 00');
    await expect(page.getByRole('button',{name:'再生する',exact:true})).toBeVisible();
    await expect(page.getByRole('slider',{name:'観測時点'})).toHaveAttribute('max','7');
    await page.getByRole('button',{name:'run 003 を開く',exact:true}).click();
    await expect(page.getByTestId('position')).toHaveText('seq 05');
  });

  test('mobileではデータを絞って履歴とSnapshotを往復できる',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.locator('.data-filter>summary').click();
    for(const id of ['count','active','scores'])await page.getByRole('checkbox',{name:`${id} を表示`,exact:true}).uncheck();
    await page.keyboard.press('Escape');
    await expect(page.locator('.object-heading code')).toHaveText(['values']);
    await page.getByRole('button',{name:'values の記録 5 を詳しく見る',exact:true}).click();
    await expect(page.locator('.inspector .array-box')).toHaveText(['3','1','9','1','5','8']);
    await page.getByRole('button',{name:'前の記録',exact:true}).click();
    await expect(page.locator('.inspector .array-box')).toHaveCount(5);
    await page.getByRole('button',{name:'履歴に戻る',exact:true}).click();
    await expect(page.locator('tr.current-row')).toHaveAttribute('data-seq','4');
    await page.locator('.mobile-run-picker>summary').click();
    await page.getByRole('button',{name:'run 002 を開く',exact:true}).click();
    await expect(page.getByTestId('run-number')).toHaveText('run 002');
    await expect(page.locator('.mobile-run-picker')).not.toHaveAttribute('open');
    await expect(page.getByTestId('position')).toHaveText('seq 00');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  });

  test('選択した実行のメタデータと値だけをJSONに書き出す',async({page})=>{
    await page.getByRole('button',{name:'run 002 を開く',exact:true}).click();
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'この実行を書き出す',exact:true}).click();
    const download=await pending;const data=JSON.parse(await readFile((await download.path())!,'utf8'));
    expect(data.format).toBe('viz.data-mock/v1');expect(data.sample).toBe(true);expect(data.frames).toEqual(runs[1].trace.frames);
    expect(data.run.id).toBe('run-002');expect(data.run.input).toBe('sample-2.in');expect(download.suggestedFilename()).toBe('run-002.sample.json');
    expect(data.objects.map((o:{kind:Value['kind']})=>o.kind)).toEqual(['integer','array','map']);
  });

  test('確認用に各viewportと実行・詳細・フィルタ表示をまとめて撮影する',async({page})=>{
    const dir='.impeccable/review/run-history';await mkdir(dir,{recursive:true});
    const capture=async(name:string)=>{
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.screenshot({path:`${dir}/${name}.png`,fullPage:true,animations:'disabled'});
    };
    await capture('desktop');
    await page.setViewportSize({width:1100,height:900});await capture('narrow');
    await page.setViewportSize({width:390,height:844});await expect(page.locator('.mobile-run-picker')).toBeVisible();await capture('mobile');
    await page.locator('.mobile-run-picker>summary').click();await capture('mobile-list');
    await page.getByRole('button',{name:'run 002 を開く',exact:true}).click();
    await page.setViewportSize({width:1440,height:1000});await capture('run-002');
    await page.getByRole('button',{name:'run 001 を開く',exact:true}).click();await capture('interrupted');
    await page.getByRole('button',{name:'run 003 を開く',exact:true}).click();
    await page.getByRole('button',{name:'scores の記録 7 を詳しく見る',exact:true}).click();await page.locator('h1').click();await capture('snapshot');
    await page.getByRole('button',{name:'Snapshotを閉じる',exact:true}).click();
    await page.getByRole('slider',{name:'観測時点'}).fill('4');await page.locator('.data-filter>summary').click();await capture('filters');
  });
});
