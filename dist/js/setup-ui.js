import {pieceSvg,pieceNames,icon} from './pieces.js';
import {SETUP_LESSON,SETUP_EXERCISE,createSetup,restoreSetup,setupOrder,setupPieces,setupOptions,placeSetup,helpSetup} from './setup-challenge.js';
import {recordLearning,rememberHelp,mergeLearning} from './learning-progress.js';

export function createSetupUI({doc,store,blocked,paused,toast,tone,home,onProgress=()=>{},collaborative=()=>false,isCurrent=()=>true,confirmSetupRestart=restart=>restart()}){
 const $=id=>doc.getElementById(id);
 let state=null,progress=null,hinted=false,focus='a1',knownAssisted=false,storageWarned=false;
 const active=()=>state&&state.squares.length<32&&!blocked()&&!paused();
 function refresh(){
  const latest=store().get();
  const helped=!knownAssisted&&latest.achievements[SETUP_EXERCISE.id]?.assisted&&state?.squares.length<32;
  if(helped)state=helpSetup(state);
  knownAssisted=!!latest.achievements[SETUP_EXERCISE.id]?.assisted;
  progress=mergeLearning(progress,latest);return helped;
 }
 function save(notify=true){
  progress.resume=state.squares.length===32?null:{lessonId:SETUP_LESSON,index:0,seed:state.seed,setup:restoreSetup(state)};
  const saved=store().save(progress);if(!saved&&!storageWarned)toast('Сборка сохранится только до закрытия страницы.');storageWarned=!saved;if(notify)onProgress(progress);
 }
 function fresh(){state=createSetup(Math.floor(Math.random()*4294967296));hinted=false;focus='a1';}
 function render(){
  if(!state)return;
  const count=state.squares.length,done=count===32,piece=setupOrder(state.seed)[Math.min(count,31)],pieces=setupPieces(state),female=['r','p'].includes(piece.toLowerCase()),white=piece===piece.toUpperCase(),name=(white?(female?'белая':'белый'):(female?'чёрная':'чёрный'))+' '+pieceNames[piece.toLowerCase()];
  const hintSquare=hinted&&!done?setupOptions(state)[0]:null;
  doc.body.dataset.phase=done?'finished':'playing';doc.body.classList.toggle('is-board-study',true);doc.body.classList.toggle('is-piece-safety',false);
  const restore=doc.activeElement?.dataset.square;let html='';
  for(let rank=8;rank>=1;rank--)for(let file=0;file<8;file++){
   const sq=String.fromCharCode(97+file)+rank,raw=pieces[sq],f=raw&&['r','p'].includes(raw.toLowerCase()),w=raw===raw?.toUpperCase(),label=raw?(w?(f?'белая':'белый'):(f?'чёрная':'чёрный'))+' '+pieceNames[raw.toLowerCase()]:'пустая клетка';
   html+=`<button class="square ${(file+rank)%2?'dark':''} ${raw?'has-piece':''} ${sq===hintSquare?'selected':''}" data-square="${sq}" aria-label="${sq}, ${label}" tabindex="${sq===focus?0:-1}">${raw?pieceSvg(raw.toLowerCase(),w?'w':'b'):''}${file===0?`<span class="coordinate rank-label">${rank}</span>`:''}${rank===1?`<span class="coordinate file-label">${String.fromCharCode(97+file)}</span>`:''}</button>`;
  }
  $('board').innerHTML=html;$('board').classList.toggle('paused-board',paused());if(restore)$('board').querySelector(`[data-square="${restore}"]`)?.focus({preventScroll:true});
  $('board-label').textContent=paused()?'Пауза':'Белые снизу · чёрные сверху';$('motif').textContent='Собери всю доску';
  $('round-label').textContent=`ПОСТАВЛЕНО ${count} ИЗ 32`;$('steps').innerHTML=Array.from({length:8},(_,i)=>`<span class="step ${count>=(i+1)*4?'done':''}"></span>`).join('');$('steps').setAttribute('aria-label',`Поставлено ${count} из 32`);
  $('hearts').innerHTML='<span class="training-symbol" aria-hidden="true">∞</span>';$('hearts').setAttribute('aria-label','Без потери сердечек');
  $('mission-tag').textContent=state.assisted?'С ПОМОЩЬЮ':'САМОСТОЯТЕЛЬНАЯ СБОРКА';$('repeat-voice').hidden=true;$('earned').hidden=true;$('defense-button').hidden=true;$('training-button').hidden=true;
  $('solution-button').hidden=!(hinted&&active());$('solution-button').textContent='Поставить эту фигуру';$('hint-button').hidden=false;$('hint-button').disabled=!active();$('hint-dots').textContent=state.assisted?'●':'○';
  $('hint-text').hidden=!(hinted&&active());$('hint-text').textContent=hintSquare?'Подходит клетка '+hintSquare+'. Подсказка учтена для всей сборки.':'';$('pause-button').disabled=done;
  $('message').replaceChildren();const h=doc.createElement('h2'),p=doc.createElement('p');
  h.textContent=paused()?'Немного отдохнём':done?(state.assisted?'Собрали с помощью!':'Ты собрал всю доску сам!'):name[0].toUpperCase()+name.slice(1);
  p.textContent=paused()?'Фигуры подождут.':done?(state.assisted?'Все 32 фигуры на месте. В этой сборке были ошибки или помощь. Можно попробовать заново без подсказок.':'Все 32 фигуры поставлены с пустой доски без ошибок и подсказок.'):(state.feedback||(count===0?'Начни с пустой доски. Вспомни место этой фигуры.':'Выбери любое её начальное место.'));
  $('message').append(h);
  if(!paused()&&!done){const sample=doc.createElement('span');sample.className='placement-sample';sample.setAttribute('role','img');sample.setAttribute('aria-label',name);sample.dataset.setupPiece=piece;sample.innerHTML=pieceSvg(piece.toLowerCase(),white?'w':'b');$('message').append(sample);}
  $('message').append(p);
  if(!paused()){
   const restart=doc.createElement('button');restart.className='secondary-button';restart.textContent='Начать заново с пустой доски';restart.dataset.setupRestart='true';restart.onclick=()=>{if(blocked()||paused())return;const attempt=state,owner=store();confirmSetupRestart(()=>{if(store()!==owner||state!==attempt||!isCurrent()||blocked()||paused())return;refresh();fresh();save();render();});};$('message').append(restart);
  }
  $('primary-button').hidden=false;$('primary-button').disabled=false;$('primary-button').innerHTML=(paused()?'Продолжить':done?'К выбору режима':'Продолжить позже')+' '+icon('arrow');
  $('mission-note').textContent=done?'Результат относится только к этой сборке. Другие занятия не засчитываются.':(count>0&&count%4===0?'Ещё четыре фигуры на месте. Можно отдохнуть и продолжить позже.':'Можно остановиться в любой момент. Каждая фигура сохраняется.')+(state.assisted?' Эта попытка — с помощью.':'');
  $('board-caption').textContent=paused()?'Пауза':done?'Все начальные места заняты.':'Выбери свободное начальное место показанной фигуры.';
 }
 function square(sq){
  if(!active())return;refresh();focus=sq;const before=state.squares.length;state=placeSetup(state,sq);hinted=false;
  if(collaborative())state=helpSetup(state);
  if(state.squares.length===before)progress=rememberHelp(progress,SETUP_EXERCISE.id);
  if(state.squares.length===32){
   const assistance=state.assisted?'assisted':'independent';progress=recordLearning(progress,{eventId:globalThis.crypto?.randomUUID?.()||'setup-'+Date.now(),contentVersion:1,lessonId:SETUP_LESSON,exerciseId:SETUP_EXERCISE.id,skillId:SETUP_EXERCISE.skillId,assistance});
   if(!progress.completed.includes(SETUP_LESSON))progress.completed.push(SETUP_LESSON);
  }
  save();render();tone(state.squares.length===before?'retry':state.squares.length===32?'mate':'select');
 }
 return {
  start(resume){progress=store().get();knownAssisted=!!progress.achievements[SETUP_EXERCISE.id]?.assisted;const r=progress.resume;
   // Only the validated, current store may supply a continuation.
   // Missing routing metadata must never destroy an existing validated draft.
   // false is the host's explicit, confirmed request for a fresh attempt.
   state=resume!==false&&r?.lessonId===SETUP_LESSON&&(resume===undefined||resume?.seed===r.seed)?restoreSetup(r.setup):null;
   if(!state)fresh();hinted=false;save();render();},render,square,
  hint(){if(!active())return;refresh();state=helpSetup(state);progress=rememberHelp(progress,SETUP_EXERCISE.id);hinted=true;save();render();tone('hint');},
  showSolution(){if(!active())return;this.hint();square(setupOptions(state)[0]);},
  primary(){if(!blocked()&&!paused())home();},
  clearSelection(){hinted=false;render();},refreshProgress(){if(!state)return;if(refresh())save(false);if(isCurrent())render();},
  cancel(){},reset(){state=null;progress=null;hinted=false;}
 };
}
