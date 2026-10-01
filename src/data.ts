export type Atom = number | string | boolean | null;
export type Value =
  | { kind: 'integer'; value: number }
  | { kind: 'array'; items: Atom[] }
  | { kind: 'set'; items: Atom[] }
  | { kind: 'map'; entries: [Atom, Atom][] };
export type ObjectDef = { id: string; name: string; kind: Value['kind'] };
export type Frame = { seq: number; label: string; values: Record<string, Value> };
export type Trace = { name: string; objects: ObjectDef[]; frames: Frame[] };
export type Run = {
  id: string; number: string; source: string; input: string; startedAt: string;
  durationMs: number; status: 'completed' | 'interrupted'; trace: Trace;
};
export type Change = { kind: 'add' | 'remove' | 'update'; path: string; before?: Atom; after?: Atom };
export const typeNames: Record<Value['kind'],string> = {integer:'Integer',array:'Array',set:'Set',map:'Map'};
export const atomKey = (value:Atom) => `${typeof value}:${JSON.stringify(value)}`;
export const formatAtom = (value:Atom):string => typeof value==='string' ? JSON.stringify(value) : String(value);
export const sortAtoms = (values:Atom[]) => [...values].sort((a,b)=>typeof a==='number' && typeof b==='number' ? a-b : atomKey(a).localeCompare(atomKey(b)));
export const sizeOf = (value:Value) => value.kind==='integer' ? String(value.value) : String(value.kind==='map'?value.entries.length:value.items.length);

export function changes(before:Value|undefined,after:Value):Change[] {
  if(!before || before.kind!==after.kind)return [];
  const result:Change[]=[];
  if(after.kind==='integer' && before.kind==='integer') {
    if(before.value!==after.value)result.push({kind:'update',path:'',before:before.value,after:after.value});
  } else if(after.kind==='array' && before.kind==='array') {
    for(let i=0;i<Math.max(before.items.length,after.items.length);i++) {
      if(i>=before.items.length)result.push({kind:'add',path:`[${i}]`,after:after.items[i]});
      else if(i>=after.items.length)result.push({kind:'remove',path:`[${i}]`,before:before.items[i]});
      else if(atomKey(before.items[i])!==atomKey(after.items[i]))result.push({kind:'update',path:`[${i}]`,before:before.items[i],after:after.items[i]});
    }
  } else if(after.kind==='set' && before.kind==='set') {
    const old=new Set(before.items.map(atomKey)),next=new Set(after.items.map(atomKey));
    for(const value of sortAtoms(after.items))if(!old.has(atomKey(value)))result.push({kind:'add',path:'',after:value});
    for(const value of sortAtoms(before.items))if(!next.has(atomKey(value)))result.push({kind:'remove',path:'',before:value});
  } else if(after.kind==='map' && before.kind==='map') {
    const old=new Map(before.entries.map(([key,value])=>[atomKey(key),value]));
    const next=new Map(after.entries.map(([key,value])=>[atomKey(key),value]));
    for(const [key,value] of after.entries) {
      if(!old.has(atomKey(key)))result.push({kind:'add',path:formatAtom(key),after:value});
      else if(atomKey(old.get(atomKey(key))!)!==atomKey(value))result.push({kind:'update',path:formatAtom(key),before:old.get(atomKey(key)),after:value});
    }
    for(const [key,value] of before.entries)if(!next.has(atomKey(key)))result.push({kind:'remove',path:formatAtom(key),before:value});
  }
  return result;
}
export const objects:ObjectDef[]=[{id:'count',name:'count',kind:'integer'},{id:'values',name:'values',kind:'array'},{id:'active',name:'active',kind:'set'},{id:'scores',name:'scores',kind:'map'}];
// Mock observations; renderers depend only on value kinds, never on sample IDs.
const frames:Frame[]=[];
function record(label:string,update:Record<string,Value>) {
  frames.push({seq:frames.length,label,values:structuredClone({...frames.at(-1)?.values,...update})});
}
record('初期値',{count:{kind:'integer',value:0},values:{kind:'array',items:[3,1,4,1,5]},active:{kind:'set',items:[1,3]},scores:{kind:'map',entries:[['alpha',2],['beta',1]]}});
record('整数を更新',{count:{kind:'integer',value:1}});
record('要素を更新',{values:{kind:'array',items:[3,1,9,1,5]}});
record('Setに追加',{active:{kind:'set',items:[1,3,4]}});
record('まとめて記録',{count:{kind:'integer',value:2},scores:{kind:'map',entries:[['alpha',5],['beta',1]]}});
record('末尾に追加',{values:{kind:'array',items:[3,1,9,1,5,8]}});
record('Setから削除',{active:{kind:'set',items:[3,4]}});
record('キーを追加・削除',{scores:{kind:'map',entries:[['alpha',5],['gamma',3]]}});
record('整数を更新',{count:{kind:'integer',value:-3}});
record('末尾を削除',{values:{kind:'array',items:[3,1,9,1,5]}});
record('Setを空にする',{active:{kind:'set',items:[]}});
record('まとめてクリア',{count:{kind:'integer',value:0},values:{kind:'array',items:[]},scores:{kind:'map',entries:[]}});
function observations(initial:Record<string,Value>,updates:[string,Record<string,Value>][]):Frame[] {
  const result:Frame[]=[{seq:0,label:'初期値',values:structuredClone(initial)}];
  for(const [label,update] of updates)result.push({seq:result.length,label,values:structuredClone({...result.at(-1)!.values,...update})});
  return result;
}

// Each run owns its object definitions and observations, including its own seq 0.
export const runs:Run[]=[
  {
    id:'run-003',number:'003',source:'values.rs',input:'sample-3.in',startedAt:'2026-09-30T14:32:08+09:00',durationMs:18,status:'completed',
    trace:{name:'values.sample',objects:structuredClone(objects),frames},
  },
  {
    id:'run-002',number:'002',source:'values.rs',input:'sample-2.in',startedAt:'2026-09-30T14:28:41+09:00',durationMs:12,status:'completed',
    trace:{name:'values.sample',objects:structuredClone(objects.filter(o=>o.id!=='active')),frames:observations({
      count:{kind:'integer',value:100},values:{kind:'array',items:[8,6,7]},scores:{kind:'map',entries:[['total',0]]},
    },[
      ['整数を更新',{count:{kind:'integer',value:101}}],
      ['要素を更新',{values:{kind:'array',items:[8,2,7]}}],
      ['Mapを更新',{scores:{kind:'map',entries:[['total',17]]}}],
      ['整数を更新',{count:{kind:'integer',value:102}}],
      ['末尾に追加',{values:{kind:'array',items:[8,2,7,0]}}],
      ['キーを追加',{scores:{kind:'map',entries:[['total',17],['seen',3]]}}],
      ['整数を更新',{count:{kind:'integer',value:103}}],
    ])},
  },
  {
    id:'run-001',number:'001',source:'values.rs',input:'sample-1.in',startedAt:'2026-09-30T14:24:03+09:00',durationMs:9,status:'interrupted',
    trace:{name:'values.sample',objects:structuredClone(objects.filter(o=>o.id==='count'||o.id==='values')),frames:observations({
      count:{kind:'integer',value:10},values:{kind:'array',items:[2,4]},
    },[
      ['整数を更新',{count:{kind:'integer',value:11}}],
      ['末尾に追加',{values:{kind:'array',items:[2,4,6]}}],
      ['整数を更新',{count:{kind:'integer',value:12}}],
      ['要素を更新',{values:{kind:'array',items:[2,9,6]}}],
    ])},
  },
];
export function frameChanges(frame:Frame,previous?:Frame) {
  return Object.entries(frame.values).flatMap(([id,value])=>changes(previous?.values[id],value).map(change=>({...change,object:id})));
}
