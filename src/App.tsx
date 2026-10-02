import { batch, createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from 'solid-js';
import { Icon, IconButton, type IconName } from './Icon';
import { ChangeText, ValueView } from './ValueView';
import { changes, frameChanges, runs, sizeOf, typeNames, type ObjectDef, type Run } from './data';

const typeIcons:Record<ObjectDef['kind'],IconName>={integer:'integer',array:'array',set:'set',map:'map'};
type Viewer={run:Accessor<Run>;cursor:Accessor<number>;visible:Accessor<string[]>;changesOnly:Accessor<boolean>;selected:Accessor<string|null>;seek:(seq:number)=>void;inspect:(seq:number,id:string)=>void;showAll:()=>void};

function History(props:{viewer:Viewer}) {
  const v=()=>props.viewer;
  const trace=()=>v().run().trace;
  let scroller!:HTMLDivElement;
  let observer:ResizeObserver|undefined;
  let pending=0;
  const columns=createMemo(()=>trace().objects.filter(object=>v().visible().includes(object.id)));
  const keepCurrentVisible=()=>{
    cancelAnimationFrame(pending);
    pending=requestAnimationFrame(()=>{
      const row=scroller?.querySelector<HTMLElement>(`[data-seq="${v().cursor()}"]`);
      if(!row)return;
      const rect=row.getBoundingClientRect(),area=scroller.getBoundingClientRect();
      const header=scroller.querySelector('thead')!.getBoundingClientRect().height;
      if(rect.top<area.top+header+8)scroller.scrollTop+=rect.top-area.top-header-8;
      else if(rect.bottom>area.bottom-8)scroller.scrollTop+=rect.bottom-area.bottom+8;
    });
  };
  const attachScroller=(element:HTMLDivElement)=>{scroller=element;observer?.disconnect();observer=new ResizeObserver(keepCurrentVisible);observer.observe(element);keepCurrentVisible();};
  createEffect(()=>{v().run();v().cursor();v().visible();v().changesOnly();keepCurrentVisible();});
  onCleanup(()=>{observer?.disconnect();cancelAnimationFrame(pending);});
  return <section class="history-panel" aria-label="値の履歴">
    <div class="history-intro"><span><Icon name="down" size={14}/>上から記録順</span><span class="wide-hint">セルを選ぶと、その時点の値を表示</span><span class="narrow-hint">横にスクロール / データで列を絞る</span></div>
    <Show when={columns().length>0} fallback={<div class="empty-history"><Icon name="grid" size={30}/><h2>表示するデータを選択</h2><p>一覧から、履歴を並べたいデータを選んでください。</p><button class="primary-button" onClick={v().showAll}>すべて表示する</button></div>}>
      <div class="history-scroll" ref={attachScroller} tabIndex={0} aria-label="データの履歴をスクロール"><table class="history-table"><colgroup><col class="sequence-column"/><For each={columns()}>{object=><col class={`column-${object.kind}`}/>}</For></colgroup>
        <thead><tr><th scope="col" class="sequence-heading">seq<small>観測時点</small></th><For each={columns()}>{object=><th scope="col"><div class="object-heading"><Icon name={typeIcons[object.kind]} size={17}/><code>{object.name}</code></div><span class="object-type">{typeNames[object.kind]}</span></th>}</For></tr></thead>
        <tbody><For each={trace().frames}>{(frame,index)=><tr data-seq={frame.seq} classList={{'current-row':v().cursor()===index()}} aria-current={v().cursor()===index()?'step':undefined}>
          <th scope="row" class="sequence-cell"><button class="sequence-button" onClick={()=>v().seek(index())} aria-label={`記録 ${frame.seq}: ${frame.label}`}><span class="sequence-number"><span class="sequence-dot"/>{String(frame.seq).padStart(2,'0')}</span><span class="sequence-label">{frame.label}</span></button></th>
          <For each={columns()}>{object=>{
            const previous=()=>trace().frames[index()-1]?.values[object.id];
            const value=()=>frame.values[object.id];
            const diff=createMemo(()=>changes(previous(),value()));
            return <td data-object={object.id} classList={{'cell-unchanged':index()>0 && diff().length===0,'cell-inspected':v().cursor()===index() && v().selected()===object.id}}><button class="history-value-button" onClick={()=>v().inspect(index(),object.id)} aria-label={`${object.name} の記録 ${frame.seq} を詳しく見る`}>
              <Show when={!v().changesOnly() || index()===0 || diff().length>0} fallback={<span class="same-value">—<span>変更なし</span></span>}>
                <ValueView value={value()} previous={previous()}/><div class="cell-diff"><Show when={diff().length>0} fallback={<span class="unchanged-label">{index()===0?'初期値':'変更なし'}</span>}><For each={diff().slice(0,2)}>{change=><ChangeText change={change}/>}</For><Show when={diff().length>2}><span class="more-changes">ほか{diff().length-2}件</span></Show></Show></div>
              </Show>
            </button></td>;
          }}</For>
        </tr>}</For></tbody>
      </table></div>
    </Show>
    <div class="history-legend"><span><i class="legend-added"/> + 追加</span><span><i class="legend-updated"/> → 更新</span><span><i class="legend-removed"/> − 削除</span><span class="legend-note">前の記録との差分</span></div>
  </section>;
}

function Inspector(props:{viewer:Viewer}) {
  const v=()=>props.viewer;
  const trace=()=>v().run().trace;
  const current=()=>trace().frames[v().cursor()];
  const selectedObjects=()=>v().selected()?trace().objects.filter(o=>o.id===v().selected()):trace().objects;
  return <section class="inspector" aria-label="選択時点の値"><div class="inspector-heading"><span>seq <strong>{String(current().seq).padStart(2,'0')}</strong></span><p>{current().label}</p></div><For each={selectedObjects()}>{object=>{
    const value=()=>current().values[object.id];
    const previous=()=>trace().frames[v().cursor()-1]?.values[object.id];
    const diff=()=>changes(previous(),value());
    return <article class="inspector-object"><h2><Icon name={typeIcons[object.kind]} size={17}/><code>{object.name}</code><span>{typeNames[object.kind]}</span></h2><ValueView value={value()} previous={previous()} expanded/><p class="inspector-size">{object.kind==='integer'?'単独の整数':`${sizeOf(value())} ${object.kind==='map'?'entries':'elements'}`}</p><div class="inspector-diff"><h3>前の記録から</h3><Show when={diff().length>0} fallback={<p class="inspector-muted">{v().cursor()===0?'初期値の記録です。':'値の変更はありません。'}</p>}><For each={diff()}>{change=><div><ChangeText change={change}/></div>}</For></Show></div><Show when={object.kind==='set'||object.kind==='map'}><p class="inspector-note">{object.kind==='set'?'集合の所属で比較します。表示順は値で整列しています。':'キーで対応付けて比較します。表示順はキーで整列しています。'}</p></Show></article>;
  }}</For></section>;
}

function RunList(props:{current:string;onSelect:(id:string)=>void}) {
  return <nav class="run-list" aria-label="実行履歴の一覧">
    <p class="run-date">2026/09/30 <span>JST</span></p>
    <For each={runs}>{run=><button class="run-item" classList={{'run-current':props.current===run.id}} aria-current={props.current===run.id?'true':undefined} aria-label={`run ${run.number} を開く`} onClick={()=>props.onSelect(run.id)}>
      <span class="run-item-heading"><code>run {run.number}</code><time datetime={run.startedAt}>{run.startedAt.slice(11,19)}</time></span>
      <code class="run-source">{run.source}</code>
      <span class="run-input">{run.input}</span>
      <span class="run-item-meta"><span class="run-status" classList={{interrupted:run.status==='interrupted'}}><Icon name={run.status==='completed'?'check':'pause'} size={12}/>{run.status==='completed'?'完了':'途中終了'}</span><span>{run.trace.frames.length} 記録 · {run.durationMs} ms</span></span>
    </button>}</For>
  </nav>;
}

type ViewState={cursor:number;visible:string[];changesOnly:boolean;selected:string|null;inspectorOpen:boolean};

export default function App() {
  const [runId,setRunId]=createSignal(runs[0].id);
  const currentRun=createMemo(()=>runs.find(run=>run.id===runId())!);
  const trace=()=>currentRun().trace;
  const [views,setViews]=createSignal<Record<string,ViewState>>(Object.fromEntries(runs.map((run,index)=>[run.id,{
    cursor:index===0?4:0,visible:run.trace.objects.map(o=>o.id),changesOnly:false,selected:null,inspectorOpen:false,
  }])));
  const view=()=>views()[runId()];
  const updateView=(update:Partial<ViewState>)=>setViews(all=>({...all,[runId()]:{...all[runId()],...update}}));
  const cursor=()=>view().cursor,visible=()=>view().visible,changesOnly=()=>view().changesOnly,selected=()=>view().selected;
  const [playing,setPlaying]=createSignal(false),[speed,setSpeed]=createSignal(1),[mobile,setMobile]=createSignal(false),[query,setQuery]=createSignal(''),[toast,setToast]=createSignal('');
  const frame=()=>trace().frames[cursor()];
  const filtered=()=>trace().objects.filter(object=>`${object.name} ${typeNames[object.kind]}`.toLowerCase().includes(query().toLowerCase()));
  let timer:ReturnType<typeof setTimeout>|undefined;
  let sdk!:HTMLDetailsElement,filters!:HTMLDetailsElement,runPicker:HTMLDetailsElement|undefined;

  const seek=(seq:number)=>batch(()=>{setPlaying(false);updateView({cursor:Math.max(0,Math.min(trace().frames.length-1,seq))});});
  const showAll=()=>{updateView({visible:trace().objects.map(o=>o.id)});setQuery('');};
  const toggleObject=(id:string)=>updateView({visible:visible().includes(id)?visible().filter(value=>value!==id):[...visible(),id]});
  const switchRun=(id:string)=>batch(()=>{
    setPlaying(false);setRunId(id);setQuery('');
    if(filters)filters.open=false;if(runPicker)runPicker.open=false;
  });
  const inspect=(seq:number,id:string)=>batch(()=>{seek(seq);updateView({selected:id,inspectorOpen:true});});
  const closeInspector=()=>updateView({inspectorOpen:false,selected:null});
  const viewer:Viewer={run:currentRun,cursor,visible,changesOnly,selected,seek,inspect,showAll};
  const play=()=>{
    if(playing()){setPlaying(false);return;}
    if(cursor()===trace().frames.length-1)updateView({cursor:0});
    setPlaying(true);
  };
  createEffect(()=>{
    if(!playing())return;
    const id=runId(),last=trace().frames.length-1;
    const interval=setInterval(()=>batch(()=>{
      if(runId()!==id)return;
      updateView({cursor:Math.min(cursor()+1,last)});
      if(cursor()===last)setPlaying(false);
    }),1000/speed());
    onCleanup(()=>clearInterval(interval));
  });
  onMount(()=>{
    const media=window.matchMedia('(max-width: 760px)');setMobile(media.matches);
    const resize=()=>setMobile(media.matches);media.addEventListener('change',resize);
    const keyboard=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){
        for(const menu of [sdk,filters,runPicker])if(menu?.open){menu.open=false;menu.querySelector('summary')?.focus();}
        return;
      }
      if(e.altKey||e.ctrlKey||e.metaKey)return;
      if((e.target as HTMLElement).closest('input,select,textarea,button,summary,a,[contenteditable="true"]'))return;
      if(e.key===' '){e.preventDefault();play();}
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();seek(cursor()+1);}
      if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();seek(cursor()-1);}
      if(e.key==='Home'){e.preventDefault();seek(0);}
      if(e.key==='End'){e.preventDefault();seek(trace().frames.length-1);}
    };
    const dismiss=(e:PointerEvent)=>{for(const menu of [sdk,filters,runPicker])if(menu?.open&&!menu.contains(e.target as Node))menu.open=false;};
    document.addEventListener('keydown',keyboard);document.addEventListener('pointerdown',dismiss);
    onCleanup(()=>{media.removeEventListener('change',resize);document.removeEventListener('keydown',keyboard);document.removeEventListener('pointerdown',dismiss);clearTimeout(timer);});
  });
  const exportTrace=()=>{
    const {trace:recorded,...metadata}=currentRun();
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'viz.data-mock/v1',sample:true,run:metadata,...recorded},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`${currentRun().id}.sample.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setToast(`run ${currentRun().number} を書き出しました。`);clearTimeout(timer);timer=setTimeout(()=>setToast(''),3000);
  };
  return <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="#" onClick={e=>{e.preventDefault();switchRun(runs[0].id);}} aria-label="viz 最新の実行を開く"><svg width="23" height="25" viewBox="0 0 27 25" aria-hidden="true"><path d="M1 8h5v16H1zm9 6h5v10h-5zm10-13h5v23h-5z" fill="currentColor"/></svg><span>viz</span></a>
      <span class="header-divider"/><span class="header-title">Data history</span><span class="sample-badge">操作モック</span>
      <div class="header-actions">
        <details class="sdk-help" ref={sdk}><summary><Icon name="code" size={16}/><span>記録の書き方</span></summary><div class="sdk-popover"><h2>値をまとめて記録する</h2><p>先頭にspanのID配列、必要なときだけ遷移元、その後に観測する変数を置きます。</p><pre><code>{`let origin = record!([i, j], count, values);\nrecord!([i, j], from: origin, active, scores);`}</code></pre><p class="sdk-footnote">Rust SDKの記法です。ローカルのCargo featureで記録し、単体ソースの提出では空展開します。詳しくはREADMEを参照してください。</p></div></details>
        <button class="text-button export-button" onClick={exportTrace}><Icon name="export" size={16}/><span>この実行を書き出す</span></button>
      </div>
    </header>
    <div class="app-body">
      <Show when={!mobile()}><aside class="run-sidebar" aria-label="実行履歴"><div class="sidebar-heading"><h2><Icon name="history" size={16}/>実行履歴</h2><span>{runs.length}</span></div><RunList current={runId()} onSelect={switchRun}/><p class="sidebar-bottom">サンプル実行 3 件<small>実行ごとに独立したデータとseq</small></p></aside></Show>
      <main class="main-content">
        <Show when={mobile()}><details class="mobile-run-picker" ref={runPicker}><summary><Icon name="history" size={16}/><span>実行履歴</span><code>run {currentRun().number}</code><Icon name="down" size={16}/></summary><div class="mobile-run-list"><RunList current={runId()} onSelect={switchRun}/></div></details></Show>
        <div class="view-heading"><div><h1>値の履歴 <code data-testid="run-number">run {currentRun().number}</code></h1><p><code>{currentRun().source}</code><span>·</span><code>{currentRun().input}</code></p></div><div class="run-summary"><span class="run-status" classList={{interrupted:currentRun().status==='interrupted'}}><Icon name={currentRun().status==='completed'?'check':'pause'} size={13}/>{currentRun().status==='completed'?'完了':'途中終了'}</span><span>{trace().frames.length} 記録 · {currentRun().durationMs} ms</span></div></div>
        <Show when={currentRun().status==='interrupted'}><p class="run-notice"><Icon name="pause" size={14}/>途中終了までに記録された {trace().frames.length} 件を表示しています。</p></Show>
        <div class="view-controls">
          <details class="data-filter" ref={filters}><summary><Icon name="filter" size={16}/><span>データ</span><span class="filter-count">{visible().length}/{trace().objects.length}</span><Icon name="down" size={13}/></summary><div class="filter-popover"><label class="object-search"><Icon name="search" size={15}/><input aria-label="データを検索" placeholder="名前・型で検索" value={query()} onInput={e=>setQuery(e.currentTarget.value)}/></label><div class="object-list"><For each={filtered()}>{object=><label class="object-toggle"><input type="checkbox" aria-label={`${object.name} を表示`} checked={visible().includes(object.id)} onChange={()=>toggleObject(object.id)}/><Icon name={typeIcons[object.kind]} size={18}/><span><code>{object.name}</code><small>{typeNames[object.kind]}</small></span><span class="object-size">{sizeOf(frame().values[object.id])}</span></label>}</For><Show when={filtered().length===0}><p class="search-empty">該当するデータがありません。</p></Show></div><button class="show-all" onClick={showAll}>すべて表示</button></div></details>
          <label class="changes-toggle"><input type="checkbox" checked={changesOnly()} onChange={e=>updateView({changesOnly:e.currentTarget.checked})}/>変更だけ表示</label>
          <button class="text-button snapshot-button" onClick={()=>updateView({selected:null,inspectorOpen:true})}><Icon name="layout" size={16}/>選択時点の値</button>
        </div>
        <div class="workspace" classList={{'with-inspector':view().inspectorOpen}} aria-label="データWorkspace">
          <Show when={!mobile()||!view().inspectorOpen}><div class="history-container"><History viewer={viewer}/></div></Show>
          <Show when={view().inspectorOpen}><aside class="snapshot-pane" aria-label="Snapshot"><div class="snapshot-heading"><h2>Snapshot</h2><IconButton name="close" label={mobile()?'履歴に戻る':'Snapshotを閉じる'} onClick={closeInspector}/></div><Inspector viewer={viewer}/></aside></Show>
        </div>
      </main>
    </div>
    <footer class="playback-bar" aria-label="履歴の再生">
      <div class="transport"><IconButton name="first" label="最初の記録" disabled={cursor()===0} onClick={()=>seek(0)}/><IconButton name="previous" label="前の記録" disabled={cursor()===0} onClick={()=>seek(cursor()-1)}/><IconButton name={playing()?'pause':'play'} label={playing()?'再生を停止':'再生する'} class="play-button" onClick={play}/><IconButton name="next" label="次の記録" disabled={cursor()===trace().frames.length-1} onClick={()=>seek(cursor()+1)}/><IconButton name="last" label="最後の記録" disabled={cursor()===trace().frames.length-1} onClick={()=>seek(trace().frames.length-1)}/><select aria-label="再生速度" value={speed()} onChange={e=>setSpeed(Number(e.currentTarget.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></div>
      <div class="playback-position" aria-live="polite" aria-atomic="true"><code data-testid="position">seq {String(frame().seq).padStart(2,'0')}</code><span>{frame().label}</span></div><div class="scrubber"><span>00</span><input aria-label="観測時点" type="range" min="0" max={trace().frames.length-1} value={cursor()} onInput={e=>seek(Number(e.currentTarget.value))}/><span>{String(trace().frames.length-1).padStart(2,'0')}</span></div>
      <div class="playback-meta"><span classList={{'is-playing':playing()}}><i/>{playing()?'再生中':'一時停止'}</span><span>{frameChanges(frame(),trace().frames[cursor()-1]).length} か所の変更</span></div>
    </footer>
    <Show when={toast()}><div class="toast" role="status">{toast()}</div></Show>
  </div>;
}
