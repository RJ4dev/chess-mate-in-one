import {createLocalParty} from './local-party.js';
import {pieceSvg,pieceNames} from './pieces.js';
const KEY='mate-local-party-v1';
export function createLocalPartyUI({doc,getStorage,blocked,paused,toast,isCurrent=()=>true,opponent=null,storageKey=KEY}){
 const $=id=>doc.getElementById(id);let game=createLocalParty(),selected=null,promotion=null,focus='a1',epoch=0,thinking=false,failed=false;
 const active=()=>!thinking&&!blocked()&&!paused()&&game.status().kind==='playing'&&(!opponent||game.turn()==='w');
 function save(){try{getStorage().setItem(storageKey,JSON.stringify(game.snapshot()));}catch{toast('Партия сохранится только до выхода из режима.');}}
 function commit(value){if(!active())return;if(!game.move(value)){toast('Этот ход сейчас невозможен.');return;}selected=null;promotion=null;save();render();}
 function think(){
  if(!opponent||thinking||failed||!isCurrent()||blocked()||paused()||game.turn()!=='b'||game.status().kind!=='playing')return;
  const id=++epoch;thinking=true;render();
  Promise.resolve().then(()=>opponent(game.fen(),{isCancelled:()=>id!==epoch||!isCurrent()})).then(value=>{
   if(id!==epoch||!isCurrent())return;thinking=false;
   if(blocked()||paused())return;
   if(!value||!game.move(value))throw Error('Computer returned no legal move');
   selected=null;save();render();
  }).catch(()=>{if(id!==epoch||!isCurrent())return;thinking=false;failed=true;toast('Не удалось рассчитать ход. Можно повторить.');render();});
 }
 function render(){
  const status=game.status(),legal=selected&&!promotion&&active()?game.legal(selected):[],restore=doc.activeElement?.dataset.square;
  doc.body.dataset.phase=status.kind==='playing'?'playing':'finished';
  let html='';
  for(let rank=8;rank>=1;rank--)for(let file=0;file<8;file++){
   const square=String.fromCharCode(97+file)+rank,p=game.piece(square),color=p?.color==='w'?(['p','r'].includes(p?.type)?'белая':'белый'):(['p','r'].includes(p?.type)?'чёрная':'чёрный');
   html+=`<button class="square ${(file+rank)%2?'dark':''} ${p?'has-piece':''} ${square===selected?'selected':''} ${legal.some(m=>m.to===square)?'target':''}" data-square="${square}" aria-label="${square}, ${p?color+' '+pieceNames[p.type]:'пустая клетка'}" aria-pressed="${square===selected}" tabindex="${square===focus?0:-1}">${p?pieceSvg(p.type,p.color):''}${file===0?`<span class="coordinate rank-label">${rank}</span>`:''}${rank===1?`<span class="coordinate file-label">${String.fromCharCode(97+file)}</span>`:''}</button>`;
  }
  $('board').innerHTML=html;$('board').classList.toggle('paused-board',paused());if(restore)$('board').querySelector(`[data-square="${restore}"]`)?.focus({preventScroll:true});
  $('board-label').textContent=game.turn()==='w'?'Ход белых':'Ход чёрных';$('motif').textContent=opponent?'Простой компьютер':'Партия вдвоём';$('round-label').textContent=(opponent?'КОМПЬЮТЕР · ':'ДВА ИГРОКА · ')+game.snapshot().moves.length+' ПОЛУХОДОВ';
  $('steps').innerHTML='';$('steps').setAttribute('aria-label','Свободная партия');$('hearts').textContent='♔';$('hearts').setAttribute('aria-label','Без сердечек и рейтинга');
  for(const id of ['earned','defense-button','training-button','solution-button','hint-button','hint-text','repeat-voice'])$(id).hidden=true;
  $('pause-button').disabled=status.kind!=='playing';$('mission-tag').textContent='ИГРАЕМ ПО ОЧЕРЕДИ';
  let title=status.check?'Шах! Защити короля':game.turn()==='w'?'Ход белых':'Ход чёрных',text='Выбери свою фигуру, затем клетку с точкой.';
  if(status.kind==='mate'){title='Мат!';text=(status.winner==='w'?'Белые':'Чёрные')+' выиграли. Можно начать новую партию.';}
  else if(status.kind!=='playing'){title='Ничья';text=({stalemate:'Пат: ходов нет, но король не под шахом.',repetition:'Позиция повторилась три раза.',material:'Недостаточно фигур для мата.',draw:'Пятьдесят ходов без взятий и ходов пешек.'})[status.kind];}
  if(opponent&&game.turn()==='b'&&status.kind==='playing'){title=failed?'Повторим расчёт?':'Компьютер думает…';text='Ты играешь белыми. Дождись хода чёрных.';}
  if(promotion){title='Кем станет пешка?';text='Выбери новую фигуру, чтобы завершить ход.';}
  if(paused()){title='Пауза';text='Фигуры подождут.';}
  $('message').replaceChildren();const h=doc.createElement('h2'),p=doc.createElement('p');h.textContent=title;p.textContent=text;$('message').append(h,p);
  if(promotion&&!paused()){
   const request=promotion;
   for(const [type,name] of [['q','Ферзь'],['r','Ладья'],['b','Слон'],['n','Конь']]){const b=doc.createElement('button');b.textContent=name;b.className='secondary-button';b.dataset.promotion=type;b.onclick=()=>{if(promotion===request&&active())commit(request.value+type);};$('message').append(b);}
  }
  $('primary-button').hidden=status.kind==='playing'&&!failed;$('primary-button').disabled=false;$('primary-button').textContent=failed?'Повторить ход':'Новая партия';
  $('mission-note').textContent=(opponent?'Ты играешь белыми против простого компьютера. ':'')+'Партия сохраняется на этом устройстве для текущего профиля. Звёзды и рейтинг не меняются.';
  $('board-caption').textContent=promotion?'Выбери фигуру в панели':status.kind==='playing'?'Белые и чёрные играют по очереди':'Партия завершена';
  think();
 }
 return {render,start(){epoch++;thinking=false;failed=false;let saved;try{const raw=getStorage()?.getItem(storageKey);if(raw)saved=JSON.parse(raw);}catch{toast('Не удалось прочитать сохранённую партию.');}game=createLocalParty(saved);if(!game.restored)toast('Сохранение партии повреждено. Открыта новая доска.');selected=null;promotion=null;render();},
  cancel(){if(!isCurrent())return;epoch++;thinking=false;if(promotion){promotion={...promotion};render();}},clearSelection(){selected=null;promotion=null;render();},
  square(square){if(!active()||promotion)return;focus=square;const p=game.piece(square);if(p?.color===game.turn()){selected=selected===square?null:square;render();return;}if(!selected)return;const moves=game.legal(selected).filter(m=>m.to===square);if(moves.some(m=>m.promotion)){promotion={value:selected+square};render();return;}commit(selected+square);},
  primary(){if(failed&&!blocked()&&!paused()){failed=false;render();return;}if(!blocked()&&!paused()&&game.status().kind!=='playing'){epoch++;thinking=false;failed=false;game=createLocalParty();selected=null;promotion=null;save();render();}}
 };
}
