const KEY='mate-one-progress-v1';
const empty=()=>({version:1,stars:0,rounds:0,solved:[],recorded:[],badges:[],motifs:[]});
export function loadProgress(storage) {
  try{
    if(!storage)return empty();
    const p=JSON.parse(storage.getItem(KEY));
    if(!p||p.version!==1||!Number.isSafeInteger(p.stars)||p.stars<0||!Number.isSafeInteger(p.rounds)||p.rounds<0)return empty();
    for(const k of ['solved','recorded','badges','motifs'])if(!Array.isArray(p[k])||p[k].some(v=>typeof v!=='string')||p[k].length>10000)return empty();
    return p;
  }catch{return empty();}
}
export function saveProgress(storage,data){try{storage.setItem(KEY,JSON.stringify(data));return true;}catch{return false;}}
export function recordResult(progress,roundId,score,answers) {
  if(progress.recorded.includes(roundId))return progress;
  const mates=answers.filter(a=>a.kind==='mate');
  const solved=[...new Set([...progress.solved,...mates.map(a=>a.id)])];
  const motifs=[...new Set([...progress.motifs,...mates.map(a=>a.motif)])];
  const badges=[...progress.badges];
  if(solved.length&&!badges.includes('first-mate'))badges.push('first-mate');
  if(solved.length>=5&&!badges.includes('five-mates'))badges.push('five-mates');
  if(motifs.includes('rook')&&motifs.includes('queen')&&!badges.includes('two-friends'))badges.push('two-friends');
  return {...progress,stars:progress.stars+score,rounds:progress.rounds+1,solved,motifs,badges,recorded:[...progress.recorded,roundId].slice(-1000)};
}
