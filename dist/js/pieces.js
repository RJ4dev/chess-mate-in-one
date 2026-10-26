// Original vector drawings. No fonts or external image requests.
const shapes={
 p:'<circle cx="32" cy="16" r="8"/><path d="M26 25h12l-2 8 8 13H20l8-13z"/><path d="M18 47h28v7H18z"/>',
 r:'<path d="M16 10h8v8h5v-8h6v8h5v-8h8v16l-7 5 2 15H21l2-15-7-5z"/><path d="M17 47h30v7H17z"/><path d="M23 29h18" fill="none"/>',
 b:'<path d="M32 8c-5 6-12 11-12 18 0 6 5 10 12 10s12-4 12-10c0-7-7-12-12-18z"/><path d="m33 16-6 11" fill="none"/><path d="m27 36-6 10h22l-6-10M18 47h28v7H18z"/>',
 n:'<path d="m21 45 2-10 9-8-10 3-6-6 8-14 7-2 4-4 3 8c10 4 12 14 10 24l-4 9z"/><path d="m24 19 5-1M35 28c5 0 7-5 7-9" fill="none"/><path d="M18 47h30v7H18z"/>',
 q:'<path d="m16 19 6 23h20l6-23-11 11-5-16-5 16z"/><circle cx="15" cy="15" r="4"/><circle cx="32" cy="10" r="4"/><circle cx="49" cy="15" r="4"/><path d="M21 43h22v4H21zM17 48h30v6H17z"/>',
 k:'<path d="M32 6v14M26 12h12" fill="none"/><path d="M32 24c-11-13-23-3-17 7l8 14h18l8-14c6-10-6-20-17-7z"/><path d="M22 39h20M19 47h26v7H19z"/>'
};
export const pieceNames={k:'король',q:'ферзь',r:'ладья',b:'слон',n:'конь',p:'пешка'};
export function pieceSvg(type,color='w',extra=''){
 const fill=color==='w'?'#fffdf0':'#263c39';const stroke=color==='w'?'#344e47':'#122b27';
 return `<svg class="piece ${extra}" viewBox="0 0 64 64" aria-hidden="true" fill="${fill}" stroke="${stroke}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${shapes[type]||shapes.p}</svg>`;
}
export const icons={
 star:'<path d="m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.1-6 3.1 1.1-6.7L2.3 9.1l6.7-1z"/>',
 heart:'<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6z"/>',
 bulb:'<path d="M9 19h6m-6 3h6M8 15c-5-4-3-12 4-12s9 8 4 12c-1 1-1 2-1 2H9s0-1-1-2z"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 book:'<path d="M12 5C9 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-7-2-10 1zm0 0v15"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',
 play:'<path d="m8 4 13 8-13 8z"/>',
 check:'<path d="m5 12 5 5L20 6"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
 sound:'<path d="m3 9 5 0 5-5v16l-5-5H3zM17 7c4 2 4 8 0 10"/>'
};
export function icon(name,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.star}</svg>`;}
