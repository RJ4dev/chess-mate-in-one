import {Chess} from './chess.js';
import {pieceSvg,pieceNames,icon} from './pieces.js';
import {kingGuide} from './king-guide.js';
import {exerciseById,solutions} from './exercises.js';
import {LESSONS,lessonById,CONTENT_VERSION} from './curriculum.js';
import {beginLesson,nextStep,retryStep,markHelp,animateAnswer} from './lesson-engine.js';
import {recordLearning,rememberHelp,mergeLearning} from './learning-progress.js';
import {createRequestGate} from './ranking-client.js';

// The controller owns no authentication or ranking scores. Every async answer
// belongs to one lesson epoch, cancelled by the host before navigation/profile changes.
export function createLearningUI({doc,store,animations,blocked,paused,toast,tone,home,onProgress=()=>{},narrate=()=>{},voiceEnabled=()=>false}){
 const $=id=>doc.getElementById(id),gate=createRequestGate();
 let lessonState,progress=store().get(),selected=null,focus='a1',busy=false,seed=0,hintShown=false,storageWarned=false;
 const exercise=()=>exerciseById(lessonState.steps[Math.min(lessonState.index,lessonState.steps.length-1)].exerciseId);
 const active=()=>!busy&&!blocked()&&!paused()&&lessonState?.phase==='playing';
 const persist=()=>{progress=mergeLearning(progress,store().get());const saved=store().save(progress);if(!saved&&!storageWarned)toast('Учебный прогресс сохранится только до закрытия страницы.');storageWarned=!saved;onProgress(progress);};
 function protectSeen(){if(progress.seen.includes(exercise().id)||progress.achievements[exercise().id]?.assisted)lessonState=markHelp(lessonState);}
 function saveCursor(){
  const next=lessonState.phase==='review'?nextStep(lessonState):lessonState;
  progress.resume=next.phase==='finished'?null:{lessonId:lessonState.lessonId,index:next.index,seed};
  persist();
 }
 function board(){
  const s=lessonState,e=exercise(),fen=['review','feedback','finished'].includes(s.phase)&&s.result?.fenAfter?s.result.fenAfter:e.fen;
  const chess=new Chess(fen),legal=selected&&active()?new Chess(e.fen).moves({square:selected,verbose:true}).map(m=>m.to):[];
  const guide=kingGuide(fen),crosses=new Set(guide.kind==='mate'||guide.kind==='stalemate'?guide.blocked:[]),move=s.result?.move;
  const restore=doc.activeElement?.dataset.square;
  let html='';
  for(let rank=8;rank>=1;rank--)for(let file=0;file<8;file++){
   const sq=String.fromCharCode(97+file)+rank,p=chess.get(sq),feminine=p&&['r','p'].includes(p.type),color=p?.color==='w'?(feminine?'белая':'белый'):(feminine?'чёрная':'чёрный');
   const classes=['square',(file+rank)%2?'dark':'',p?'has-piece':'',sq===selected?'selected':'',legal.includes(sq)?'target':'',move&&(move.from===sq||move.to===sq)?'last-move':'',p?.type==='k'&&p.color===chess.turn()&&chess.isCheck()?'king-check':''].filter(Boolean).join(' ');
   html+=`<button class="${classes}" data-square="${sq}" aria-label="${sq}, ${p?color+' '+pieceNames[p.type]:'пустая клетка'}${e.targetSquare===sq?', цель задания':''}" aria-pressed="${sq===selected}" tabindex="${sq===focus?0:-1}">${p?pieceSvg(p.type,p.color):''}${e.targetSquare===sq&&['demo','playing','feedback'].includes(s.phase)?'<span class="lesson-goal" aria-hidden="true">★</span>':''}${crosses.has(sq)?'<span class="blocked-cross" aria-hidden="true">×</span>':''}${file===0?`<span class="coordinate rank-label">${rank}</span>`:''}${rank===1?`<span class="coordinate file-label">${String.fromCharCode(97+file)}</span>`:''}</button>`;
  }
  $('board').innerHTML=html;$('board').classList.toggle('paused-board',paused());
  if(restore)$('board').querySelector(`[data-square="${restore}"]`)?.focus({preventScroll:true});
 }
 function render(){
  if(!lessonState)return;
  const s=lessonState,e=exercise(),lesson=lessonById(s.lessonId,seed),stage=s.steps[Math.min(s.index,s.steps.length-1)].stage;
  doc.body.dataset.phase=s.phase;
  $('repeat-voice').hidden=!voiceEnabled()||!!lessonById(s.lessonId,seed).textOnly;
  board();
  $('board-label').textContent=paused()?'Пауза':new Chess(e.fen).turn()==='w'?'Ход белых':'Ход чёрных';
  $('motif').textContent=lesson.title;
  $('round-label').textContent=`${s.lessonId.startsWith('mini-')?'ПРАКТИКА':'УРОК'} · ${Math.min(s.index+1,s.steps.length)} ИЗ ${s.steps.length}`;
  $('steps').innerHTML=s.steps.map((_,i)=>`<span class="step ${i<s.index?'done':i===s.index?'current':''}"></span>`).join('');
  $('steps').setAttribute('aria-label',`Шаг ${Math.min(s.index+1,s.steps.length)} из ${s.steps.length}`);
  $('hearts').innerHTML='<span class="training-symbol" aria-hidden="true">∞</span>';$('hearts').setAttribute('aria-label','Учимся без потери сердечек');
  $('mission-tag').textContent=stage==='show'?'СМОТРИМ ВМЕСТЕ':stage==='guided'?'ПРОБУЕМ ВМЕСТЕ':stage==='independent'?'ПОПРОБУЙ САМ':'ПРАКТИКУЕМСЯ';
  $('earned').hidden=true;$('defense-button').hidden=true;
  $('solution-button').hidden=!(hintShown&&s.phase==='playing');$('solution-button').textContent='Показать ход';
  $('hint-button').disabled=!active();$('hint-dots').textContent=hintShown?'●':'○';
  $('hint-text').hidden=!(hintShown&&s.phase==='playing');$('hint-text').textContent=e.hint||lesson.hint||(e.goal==='save'?'Можно уйти, взять нападающую фигуру или закрыть линию. Точки — законные ходы.':'Выбрана одна подходящая фигура. Найди клетку, откуда она нападёт на короля.');
  $('pause-button').disabled=s.phase==='finished';$('training-button').hidden=true;
  let title=e.taskTitle||lesson.taskTitle||(e.goal==='check'?'Найди шах':e.goal==='save'?'Спаси короля':'Поставь мат'),text=s.result?.kind==='illegal'?s.result.text:e.prompt,button='';
  if(paused()){title='Немного отдохнём';text='Фигуры подождут.';button='Продолжить';}
  else if(s.phase==='demo'){title=lesson.title;text=e.introduction||lesson.introduction||(e.goal==='check'?'Шах — это нападение на короля. Посмотрим на пример.':e.goal==='save'?'От шаха нужно защититься. Посмотрим на один способ.':'Мат — это шах, от которого нет законной защиты.');button='Покажи пример';}
  else if(s.phase==='review'){title=s.result.assistance==='independent'?'Ты справился сам!':'Разобрались вместе!';text=s.result.text;button=s.index===s.steps.length-1?'Итог урока':'Следующее задание';}
  else if(s.phase==='feedback'){title='Попробуем ещё';text=s.result.text;button='Вернуть позицию';}
  else if(s.phase==='finished'){title='Занятие пройдено!';text=lesson.summary;button='К выбору режима';}
  $('message').replaceChildren();const h=doc.createElement('h2'),p=doc.createElement('p');h.textContent=title;p.textContent=text;$('message').append(h,p);
  if(!lesson.textOnly&&!paused()&&!busy&&!blocked())narrate(title+'. '+text);
  $('primary-button').hidden=!button;$('primary-button').innerHTML=button+' '+icon('arrow');$('primary-button').disabled=busy;
  $('mission-note').textContent=lesson.textOnly?'Здесь учимся с текстовыми подсказками. Можно ошибаться и пробовать снова.':'Можно ошибаться и пробовать снова. Учебные задания не меняют рейтинг.';
  $('board-caption').textContent=busy?'Фигура делает ход…':selected?'Выбери клетку с точкой':s.phase==='demo'?'Сначала посмотрим, затем попробуешь ты':s.phase==='review'?'Посмотри, что изменилось на доске':'Нажми на свою фигуру, затем на клетку';
 }
 async function answer(value){
  if(busy||blocked()||paused())return;
  const before=lessonState,isCurrent=gate.begin();busy=true;
  await animateAnswer(before,value?{kind:'move',value}:null,{
   animate:move=>animations.move({from:$('board').querySelector(`[data-square="${move.from}"]`),to:$('board').querySelector(`[data-square="${move.to}"]`),duration:1100}),isCurrent,
   onCommit:next=>{
    // Sync may finish while a piece is in flight. Judge assistance against the
    // latest facts before giving praise or recording a completed answer.
    const latest=store().get(),id=next.steps[next.index].exerciseId;
    if(next.phase==='review'&&(latest.seen.includes(id)||latest.achievements[id]?.assisted))next={...next,result:{...next.result,assistance:'assisted'}};
    lessonState=next;selected=null;busy=false;
    if(next.phase==='review'){
     const e=exercise(),event={eventId:globalThis.crypto?.randomUUID?.()||'lesson-'+Date.now()+'-'+Math.random().toString(36).slice(2),contentVersion:CONTENT_VERSION,lessonId:next.lessonId,exerciseId:e.id,skillId:e.skillId,assistance:next.result.assistance};
     progress=recordLearning(progress,event);
     if(next.index===next.steps.length-1&&LESSONS.some(l=>l.id===next.lessonId)&&!progress.completed.includes(next.lessonId))progress.completed.push(next.lessonId);
     saveCursor();tone('mate');
    }else{progress=rememberHelp(progress,exercise().id);saveCursor();tone('retry');}
    render();
   }
  });
  if(isCurrent())busy=false;
 }
 return {
  get textOnly(){return !!lessonById(lessonState?.lessonId,seed)?.textOnly;},
  render,cancel(){gate.cancel();busy=false;},
  reset(){gate.cancel();busy=false;lessonState=null;progress=store().get();selected=null;},
  refreshProgress(){progress=store().get();if(lessonState&&lessonState.phase!=='finished')protectSeen();},
  start(id,resume){
   gate.cancel();busy=false;progress=store().get();seed=resume?.seed??(id.startsWith('mini-')?Math.floor(Math.random()*12):0);
   lessonState=beginLesson(id,seed);if(resume&&resume.lessonId===id&&Number.isInteger(resume.index)&&resume.index>=0&&resume.index<lessonState.steps.length){lessonState.index=resume.index;lessonState.phase=lessonState.steps[resume.index].stage==='show'?'demo':'playing';}
   selected=null;hintShown=false;protectSeen();saveCursor();render();
  },
  async square(sq){
   if(!active())return;focus=sq;
   const c=new Chess(exercise().fen),p=c.get(sq);
   if(p?.color===c.turn()){selected=selected===sq?null:sq;tone('select');render();return;}
   if(!selected){toast(c.turn()==='w'?'Выбери белую фигуру.':'Выбери чёрную фигуру.');return;}
   const value=selected+sq;await answer(value);
  },
  primary(){
   if(busy||blocked())return;
   if(lessonState.phase==='demo'){void answer(null);return;}
   if(lessonState.phase==='feedback'){lessonState=retryStep(lessonState);render();return;}
   if(lessonState.phase==='finished'){home();return;}
   if(lessonState.phase==='review'){lessonState=nextStep(lessonState);hintShown=false;selected=null;if(lessonState.phase!=='finished')protectSeen();saveCursor();render();}
  },
  hint(){if(!active())return;lessonState=markHelp(lessonState);progress=rememberHelp(progress,exercise().id);saveCursor();hintShown=true;selected=solutions(exercise())[0]?.slice(0,2)||null;render();tone('hint');},
  showSolution(){if(active()){lessonState=markHelp(lessonState);void answer(null);}},
  clearSelection(){selected=null;render();}
 };
}
