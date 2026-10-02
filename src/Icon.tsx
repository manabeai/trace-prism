import type { JSX } from 'solid-js';

const paths = {
  play: 'm8 5 11 7-11 7V5Z',
  pause: 'M8 5v14M16 5v14',
  previous: 'm14 6-6 6 6 6',
  next: 'm10 6 6 6-6 6',
  first: 'M5 5v14m12-13-6 6 6 6',
  last: 'M19 5v14M7 6l6 6-6 6',
  down: 'm7 10 5 5 5-5',
  layout: 'M4 4h16v16H4V4Zm5 0v16M9 15h11',
  export: 'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',
  reset: 'M4 5v6h6M5 10a7 7 0 1 1 1 8',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16',
  graph: 'M12 5 5 18m7-13 7 13M5 18h14',
  grid: 'M3 3h18v18H3V3Zm6 0v18m6-18v18M3 9h18M3 15h18',
  array: 'M2 5h20v14H2V5Zm7 0v14m7-14v14',
  variables: 'M8 5H5v14h3m8-14h3v14h-3M10 9l4 6m0-6-4 6',
  timeline: 'M4 5h16M4 12h16M4 19h16M9 2v6m7 1v6m-9 1v6',
  logs: 'M4 5h16v14H4V5Zm4 4 3 3-3 3m6 0h3',
  help: 'M9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  close: 'm6 6 12 12M6 18 18 6',
  over: 'M5 10a7 7 0 0 1 14 0m-4-3 4 3 3-4M5 18h14',
  out: 'M12 20V4m-5 5 5-5 5 5',
  check: 'm5 12 4 4L19 6',
  integer: 'M10 3 8 21M16 3l-2 18M4 9h17M3 15h17',
  set: 'M8 3H6v18h2m8-18h2v18h-2M10 8h4m-4 4h4m-4 4h4',
  map: 'M3 5h18v14H3V5Zm7 0v14M3 12h18M5 8h2m6 0h5m-13 7h2m6 0h5',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  history: 'M3 11a9 9 0 1 1 3 8M3 4v7h7m2-5v6l4 2',
  filter: 'M4 7h16M7 12h10m-7 5h4',
};
export type IconName = keyof typeof paths;
export function Icon(props: {name: IconName; size?: number; class?: string}) {
  return <svg class={props.class} width={props.size ?? 18} height={props.size ?? 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[props.name]} /></svg>;
}
export function IconButton(props: {name: IconName; label: string; onClick: () => void; disabled?: boolean; class?: string; children?: JSX.Element}) {
  return <button type="button" class={`icon-button ${props.class ?? ''}`} aria-label={props.label} title={props.label} disabled={props.disabled} onClick={() => props.onClick()}><Icon name={props.name} />{props.children}</button>;
}
