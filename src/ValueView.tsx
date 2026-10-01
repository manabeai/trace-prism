import { For, Match, Show, Switch, createMemo } from 'solid-js';
import { atomKey, changes, formatAtom, sortAtoms, type Change, type Value } from './data';

export function ChangeText(props:{change:Change}) {
  return <span class={`change-text change-${props.change.kind}`}>
    <Show when={props.change.path}><code>{props.change.path}</code><span class="change-colon">:</span></Show>
    <Switch>
      <Match when={props.change.kind==='add'}><span>+</span><code>{formatAtom(props.change.after!)}</code></Match>
      <Match when={props.change.kind==='remove'}><span>−</span><code>{formatAtom(props.change.before!)}</code></Match>
      <Match when={props.change.kind==='update'}><code class="before-value">{formatAtom(props.change.before!)}</code><span>→</span><code>{formatAtom(props.change.after!)}</code></Match>
    </Switch>
  </span>;
}
export function ValueView(props:{value:Value;previous?:Value;expanded?:boolean}) {
  const diff=createMemo(()=>changes(props.previous,props.value));
  return <div class="value-view" classList={{expanded:props.expanded}}><Switch>
    <Match when={props.value.kind==='integer' && props.value}>{value=>{
      const scalar=()=>value() as Extract<Value,{kind:'integer'}>;
      return <div class="integer-value" classList={{'value-updated':diff().length>0}}><span>{scalar().value}</span><Show when={diff().length>0}><span class="integer-delta">{scalar().value-(diff()[0].before as number)>0?'+':''}{scalar().value-(diff()[0].before as number)}</span></Show></div>;
    }}</Match>
    <Match when={props.value.kind==='array' && props.value}>{value=>{
      const array=()=>value() as Extract<Value,{kind:'array'}>;
      return <Show when={array().items.length>0} fallback={<span class="empty-value"><code>[]</code><span>空の配列</span></span>}><div class="array-values"><For each={array().items}>{(item,i)=>{
        const change=()=>diff().find(d=>d.path===`[${i()}]`);
        return <div class="array-item" title={`[${i()}] = ${formatAtom(item)}`}><span class="array-index">{i()}</span><span class="array-box" classList={{added:change()?.kind==='add',updated:change()?.kind==='update'}}>{formatAtom(item)}</span></div>;
      }}</For></div></Show>;
    }}</Match>
    <Match when={props.value.kind==='set' && props.value}>{value=>{
      const set=()=>value() as Extract<Value,{kind:'set'}>;
      return <Show when={set().items.length>0} fallback={<span class="empty-value"><code>∅</code><span>空のSet</span></span>}><div class="set-values"><span class="collection-brace">{'{'}</span><For each={sortAtoms(set().items)}>{item=><span class="set-item" classList={{added:diff().some(d=>d.kind==='add' && atomKey(d.after!)===atomKey(item))}}>{formatAtom(item)}</span>}</For><span class="collection-brace">{'}'}</span></div></Show>;
    }}</Match>
    <Match when={props.value.kind==='map' && props.value}>{value=>{
      const map=()=>value() as Extract<Value,{kind:'map'}>;
      const entries=()=>[...map().entries].sort(([a],[b])=>atomKey(a).localeCompare(atomKey(b)));
      return <Show when={entries().length>0} fallback={<span class="empty-value"><code>{'{}'}</code><span>空のMap</span></span>}><div class="map-values"><For each={entries()}>{([key,item])=>{
        const change=()=>diff().find(d=>d.path===formatAtom(key));
        return <span class="map-pair" classList={{added:change()?.kind==='add',updated:change()?.kind==='update'}}><span class="map-key">{formatAtom(key)}</span><span class="map-colon">:</span><span>{formatAtom(item)}</span></span>;
      }}</For></div></Show>;
    }}</Match>
  </Switch></div>;
}
