import {Chess,evaluateMove} from './chess.js';
import {PUZZLES} from './puzzles.js';
import {createRound,submitMove,retryPuzzle,useHint,nextPuzzle,choosePuzzles,ActiveClock,createRoundId} from './game.js';
import {loadProgress,saveProgress,recordResult} from './progress.js';
import {pieceSvg,pieceNames,icon} from './pieces.js';
import {wrongMoveCopy,finishedRoundView} from './messages.js';

const $=id=>document.getElementById(id);
let storage;try{storage=window.localStorage;}catch{storage=null;}
let progress=loadProgress(storage),mode='ready',lessonIndex=-1,selected=null,focusSquare='a1',paused=false,defenseShown=false;
let roundId=createRoundId(),state=createRound(pick()),toastTimer,lastSaveSucceeded=true,solutionView=null;
const clock=new ActiveClock();
const lessons=[
 {id:'lesson-check',fen:'k7/8/2K5/8/8/8/8/1R6 w - - 0 1',mateMovesUci:['b1a1'],motif:'rook',title:'Сначала — шах',text:'Нажми на ладью b1, затем на клетку a1.',after:'Шах! Но ещё не мат.',why:'Король может уйти на b8. Посмотри на его защиту.'},
 {id:'lesson-mate',fen:'k7/2K5/8/8/8/8/8/1R6 w - - 0 1',mateMovesUci:['b1a1'],motif:'rook',title:'Теперь — мат!',text:'Наш король стал ближе. Снова передвинь ладью с b1 на a1.',after:'Получилось! Это мат.',why:'Ладья дала шах. Наш король закрыл выходы. Чёрному королю не спастись!'},
 {id:'lesson-stalemate',fen:'7k/5K2/8/6Q1/8/8/8/8 w - - 0 1',mateMovesUci:['g5g6'],motif:'queen',title:'А это будет пат',text:'Подними ферзя с g5 на g6. Посмотрим, что случится.',after:'Это пат. Мата нет.',why:'Ходов нет, но и шаха нет. Для победы нам нужен именно шах и ни одного спасения.'}
];
const badges=[
 {id:'first-mate',name:'Первый мат',description:'Найди свой первый мат',icon:'star'},
 {id:'five-mates',name:'Пять открытий',description:'Реши 5 разных задач',icon:'check'},
 {id:'two-friends',name:'Дружба фигур',description:'Поставь мат ладьёй и ферзём',icon:'heart'}
];
const motifNames={rook:'Ладья и король',queen:'Ферзь и король',bishop:'Помощь слона',knight:'Помощь коня','queen-pawn':'Ферзь и пешка'};
function pick(){const pool=progress?.solved.length>=10?PUZZLES:PUZZLES.filter(p=>['rook','queen'].includes(p.motif));return choosePuzzles(pool,progress?.solved||[]);}
function current(){return state.puzzles[state.index];}
function scrollGame(){if(window.matchMedia('(max-width:680px)').matches)document.querySelector('.game-layout').scrollIntoView({block:'start',behavior:'instant'});}
function active(){return mode!=='ready'&&state.phase==='playing'&&!paused&&!$('modal').open;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function settle(){if(mode!=='play'||state.training)return;progress=recordResult(progress,roundId,state.score,state.answers);lastSaveSucceeded=saveProgress(storage,progress);if(!lastSaveSucceeded)toast('Игра работает, но браузер не сохраняет награды.');}
function newRound(training=false){
 if(mode==='play'&&state.answers.length)settle();
 lessonIndex=-1;mode='play';state=createRound(pick(),{training});roundId=createRoundId();selected=null;paused=false;defenseShown=false;solutionView=null;clock.reset();clock.start();render();scrollGame();
}
function startReady(){mode='play';clock.reset();clock.start();render();scrollGame();}
function startLesson(index=0){
 if(mode==='play'&&state.answers.length)settle();
 lessonIndex=index;mode='lesson';state=createRound([lessons[index]],{training:true});selected=null;paused=false;defenseShown=false;solutionView=null;clock.reset();render();scrollGame();
}
function boardFen(){
 if(solutionView)return solutionView.fenAfter;
 const f=state.feedback;
 if(f&&(state.phase==='review'||state.phase==='feedback'||state.phase==='finished'))return defenseShown&&f.fenDefense?f.fenDefense:f.fenAfter||current().fen;
 return current().fen;
}
function renderBoard(){
 const restore=document.activeElement?.dataset.square;
 const chess=new Chess(boardFen());
 const legal=selected&&active()?new Chess(current().fen).moves({square:selected,verbose:true}).map(m=>m.to):[];
 const f=state.feedback;const highlighted=solutionView?.move||(f?(defenseShown&&f.defense?f.defense:f.move):null);
 let html='';
 for(let rank=8;rank>=1;rank--)for(let file=0;file<8;file++){
  const square=String.fromCharCode(97+file)+rank,piece=chess.get(square);
  const dark=(file+rank)%2===1;
  const feminine=piece&&['r','p'].includes(piece.type);
  const name=piece?`${piece.color==='w'?(feminine?'белая':'белый'):(feminine?'чёрная':'чёрный')} ${pieceNames[piece.type]}`:'пустая клетка';
  const classes=['square',dark?'dark':'',piece?'has-piece':'',selected===square?'selected':'',legal.includes(square)?'target':'',highlighted&&(highlighted.from===square||highlighted.to===square)?'last-move':'',piece?.type==='k'&&piece.color===chess.turn()&&chess.isCheck()?'king-check':''].filter(Boolean).join(' ');
  html+=`<button class="${classes}" data-square="${square}" aria-label="${square}, ${name}" aria-pressed="${selected===square}" tabindex="${focusSquare===square?0:-1}">${piece?pieceSvg(piece.type,piece.color):''}${file===0?`<span class="coordinate rank-label">${rank}</span>`:''}${rank===1?`<span class="coordinate file-label">${String.fromCharCode(97+file)}</span>`:''}</button>`;
 }
 $('board').innerHTML=html;$('board').classList.toggle('paused-board',paused);
 if(restore)$('board').querySelector(`[data-square="${restore}"]`)?.focus({preventScroll:true});
}
function renderBadges(){
 const list=badges.map(b=>`<div class="badge-item ${progress.badges.includes(b.id)?'unlocked':''}"><span class="badge-medal">${icon(b.icon)}</span><span>${b.name}<br><small>${progress.badges.includes(b.id)?'Уже в коллекции':'Ещё впереди'}</small></span></div>`).join('');
 $('badge-row').innerHTML=list;
}
function render(){
 document.body.classList.toggle('is-ready',mode==='ready');
 renderBoard();renderBadges();
 const lesson=mode==='lesson',p=current(),feedback=state.feedback;
 $('total-stars').textContent=progress.stars;
 $('round-score').textContent=state.score;
 $('board-label').textContent=paused?'Пауза':state.phase==='review'&&feedback?.kind==='mate'?'Мат!':defenseShown?'Защита короля':'Ход белых';
 $('motif').textContent=motifNames[p.motif]||'Мат в один';
 $('round-label').textContent=lesson?`УЧИМСЯ ВМЕСТЕ · ${lessonIndex+1} ИЗ 3`:state.training?'СВОБОДНАЯ ТРЕНИРОВКА':mode==='ready'?'ТВОЁ ПРИКЛЮЧЕНИЕ':`ЗАДАЧА ${state.index+1} ИЗ ${state.puzzles.length}`;
 $('steps').innerHTML=Array.from({length:lesson?3:state.puzzles.length},(_,i)=>`<span class="step ${i<(lesson?lessonIndex:state.index)?'done':i===(lesson?lessonIndex:state.index)?'current':''}" aria-hidden="true"></span>`).join('');
 $('steps').setAttribute('aria-label',lesson?`Учебный пример ${lessonIndex+1} из 3`:`Задача ${state.index+1} из ${state.puzzles.length}`);
 $('hearts').innerHTML=lesson||state.training?'<span class="training-symbol" aria-hidden="true">∞</span>':Array.from({length:3},(_,i)=>icon('heart',i>=state.lives?'lost':'')).join('');
 $('hearts').setAttribute('aria-label',lesson||state.training?'Без ограничения попыток':`Попыток осталось: ${state.lives}`);
 $('mission-tag').textContent=lesson?'ЗНАКОМИМСЯ С МАТОМ':state.training?'БЕЗ СПЕШКИ И СЕРДЕЧЕК':'МАТ В 1 ХОД';
 $('hint-button').disabled=paused||(mode!=='ready'&&state.phase!=='playing');
 $('hint-dots').textContent=Array.from({length:3},(_,i)=>i<state.hints?'●':'○').join(' ');
 $('pause-button').disabled=mode==='ready'||state.phase==='finished';
 $('training-button').hidden=lesson;
 $('earned').hidden=true;$('hint-text').hidden=true;$('defense-button').hidden=true;$('solution-button').hidden=true;
 $('primary-button').hidden=false;
 let title,text,button,note;
 if(paused){title='Немного отдохнём';text='Фигуры подождут. Время на паузе.';button='Продолжить';note='Можно думать столько, сколько хочется.';}
 else if(mode==='ready'){title='Найдём первый мат?';text='Один точный ход — и королю некуда бежать.';button='Играть';note='5 задач · 3 попытки · сколько угодно времени';}
 else if(lesson){
  const l=lessons[lessonIndex];
  title=state.phase==='review'?l.after:l.title;text=state.phase==='review'?l.why:l.text;
  button=state.phase==='review'?(lessonIndex===2?'Играть самому':'Следующий пример'):'Покажи нужную фигуру';
  note='В учебных примерах можно пробовать без ошибок.';
  if(state.phase==='review'&&feedback?.fenDefense)$('defense-button').hidden=false;
 }
 else if(state.phase==='review'){
  const a=state.answers.at(-1);const shown=a.kind==='shown';
  title=shown?'Разобрались вместе!':'Ура, это мат!';text=p.explanation;
  button=state.index===state.puzzles.length-1?'Мои результаты':'Следующая задача';
  note=shown?'Эту задачу ещё можно решить самостоятельно.':'Королю некуда уйти. Ты нашёл решение!';
  if(a.score){$('earned').hidden=false;$('earned').innerHTML=icon('star')+`<strong>+${a.score}</strong> звёзд за решение`;}
 }
 else if(state.phase==='feedback'){
  const copy=wrongMoveCopy(feedback);title=copy.title;text=copy.text;
  button='Попробовать ещё';note=state.training?'Тренируемся без потери сердечек.':`Осталось попыток: ${state.lives}. Мы учимся — всё в порядке.`;
  $('defense-button').hidden=!feedback.fenDefense;
 }
 else if(state.phase==='finished'){
  const view=finishedRoundView(state,lastSaveSucceeded);title=view.title;text=(view.explanation?view.explanation.text+' ':'')+view.summary;
  button='Новая игра';note=state.training?'Тренировка закончена. Можно отдохнуть.':view.storageScope==='durable'?'Все звёзды за раунд сохранены. Можно отдохнуть.':'Награды останутся до закрытия страницы. Браузер не разрешает сохранить их надолго.';
  if(state.lives===0){$('defense-button').hidden=!feedback.fenDefense;$('solution-button').hidden=false;}
 }
 else {
  title='Поставь мат за один ход';text='Найди шах, от которого чёрному королю не спастись.';button='';note='Нажми на белую фигуру, затем на клетку.';$('primary-button').hidden=true;
  if(state.hints){$('hint-text').hidden=false;$('hint-text').textContent=state.hints===1?p.hintSteps[0]:'Попробуй эту фигуру. Клетки с точками — её законные ходы.';}
 }
 $('message').innerHTML=`<h2>${title}</h2><p>${text}</p>`;
 $('primary-button').innerHTML=button+' '+icon('arrow');$('mission-note').textContent=note;
 $('defense-button').textContent=defenseShown?'Снова показать шах':'Показать защиту короля';
 $('board-caption').textContent=paused?'Отдыхаем. Время остановлено.':selected?'Теперь выбери клетку с точкой':state.phase==='review'?'Посмотри, как фигуры помогли друг другу':state.phase==='feedback'?'Нажми «Попробовать ещё», чтобы вернуть позицию':'Нажми на фигуру, затем на клетку';
 if(state.phase==='finished'&&mode==='play'&&!state.training)$('total-stars').textContent=progress.stars;
}
function onSquare(square){
 if(mode==='ready')startReady();
 if(!active())return;
 const chess=new Chess(current().fen),piece=chess.get(square);focusSquare=square;
 if(piece?.color==='w'){selected=selected===square?null:square;renderBoard();$('board-caption').textContent=selected?'Теперь выбери клетку с точкой':'Нажми на фигуру, затем на клетку';return;}
 if(!selected){toast('Сначала выбери белую фигуру.');return;}
 const move=selected+square;selected=null;
 if(mode==='lesson'){
  if(move!==current().mateMovesUci[0]){render();toast('Попробуем ход из учебного примера.');return;}
  state={...state,phase:'review',feedback:evaluateMove(current().fen,move)};render();return;
 }
 const outcome=submitMove(state,move,clock.elapsed());
 if(outcome.result.kind==='illegal'){render();toast('Эта фигура так не ходит. Сердечко на месте.');return;}
 state=outcome.state;clock.pause();defenseShown=false;
 if(state.phase==='finished')settle();
 render();
 if(outcome.result.kind==='mate'){$('guide-avatar').classList.remove('celebrate');requestAnimationFrame(()=>$('guide-avatar').classList.add('celebrate'));}
}
function primary(){
 if(paused){paused=false;if(state.phase==='playing'&&mode==='play')clock.start();render();return;}
 if(mode==='ready'){startReady();return;}
 if(mode==='lesson'){
  if(state.phase==='review'){if(lessonIndex<2)startLesson(lessonIndex+1);else newRound();}
  else{selected=current().mateMovesUci[0].slice(0,2);render();}
  return;
 }
 if(state.phase==='feedback'){state=retryPuzzle(state);defenseShown=false;clock.start();render();return;}
 if(state.phase==='review'){
  state=nextPuzzle(state);selected=null;defenseShown=false;
  if(state.phase==='finished')settle();else{clock.reset();clock.start();}
  render();scrollGame();return;
 }
 if(state.phase==='finished')newRound();
}
function hint(){
 if(mode==='ready')startReady();
 if(!active())return;
 if(mode==='lesson'){selected=current().mateMovesUci[0].slice(0,2);render();return;}
 state=useHint(state);selected=state.hints===2?current().mateMovesUci[0].slice(0,2):null;
 if(state.phase==='review')clock.pause();render();
}
function modal(html){clock.pause();$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function closeModal(){$('modal').close();}
function showHow(){modal(`<div class="modal-eyebrow">ТРИ МАЛЕНЬКИХ ШАГА</div><h2 class="modal-title" id="modal-title">Давай найдём мат!</h2><div class="modal-copy"><p><strong>1. Найди шах.</strong> Какая фигура может напасть на короля?</p><p><strong>2. Проверь выходы.</strong> Может ли король убежать, взять фигуру или закрыться?</p><p><strong>3. Если спасения нет — это мат!</strong></p><p>Точки показывают, куда ходит выбранная фигура. Подсказки не отнимают сердечки.</p></div><button class="primary-button" id="start-lesson">Попробуем вместе ${icon('arrow')}</button><p class="keyboard-note">Клавиатура: стрелки — клетка; Enter — выбрать; Esc — отменить выбор.</p>`);$('start-lesson').onclick=()=>{closeModal();startLesson();};}
function showAlbum(){modal(`<div class="modal-eyebrow">ШАХМАТНЫЙ ИССЛЕДОВАТЕЛЬ</div><h2 class="modal-title" id="modal-title">Моя коллекция</h2><p class="modal-copy">У тебя <strong>${progress.stars}</strong> звёзд и <strong>${progress.solved.length}</strong> разных решённых задач.</p><div class="modal-badges">${badges.map(b=>`<div class="badge-item ${progress.badges.includes(b.id)?'unlocked':''}"><span class="badge-medal">${icon(b.icon)}</span><span><strong>${b.name}</strong><br>${progress.badges.includes(b.id)?'Награда твоя!':b.description}</span></div>`).join('')}</div><p class="modal-copy">Награды остаются с тобой, даже если пропустить день.</p>`);}
function showParents(){modal(`<div class="modal-eyebrow">СПОКОЙНОЕ ОБУЧЕНИЕ</div><h2 class="modal-title" id="modal-title">Взрослым об игре</h2><div class="modal-copy"><p>Для детей, которые уже знают ходы фигур. Сначала пройдите три примера в разделе «Как играть». При необходимости прочитайте короткие объяснения ребёнку.</p><p>Раунд: 5 задач и 3 общие попытки. Невозможный ход не штрафуется. Скорость даёт только небольшой бонус — ограничения времени нет. В тренировке сердечки и очки не расходуются.</p><p>200 проверенных позиций, преимущественно варианты простых матов ладьёй и ферзём. Проверка работает в браузере. Аккаунтов, рекламы и покупок нет.</p><p>Награды сохраняются после завершения раунда в этом браузере. Незавершённый раунд после закрытия страницы начнётся заново. Очистка браузера удалит награды. Синхронизации между устройствами пока нет.</p><p>Следите за тем, понимает ли ребёнок, почему король не может спастись. Один спокойный раунд лучше гонки за звёздами.</p></div>`);}

document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('brand-mark').innerHTML=pieceSvg('n','w');$('stamp-piece').innerHTML=pieceSvg('n','w');$('guide-avatar').innerHTML=pieceSvg('p','w');
$('board').addEventListener('click',event=>{const square=event.target.closest('[data-square]')?.dataset.square;if(square)onSquare(square);});
$('board').addEventListener('keydown',event=>{
 const sq=event.target.closest('[data-square]')?.dataset.square;if(!sq)return;
 if(event.key==='Escape'){selected=null;render();return;}
 const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[event.key];
 if(delta){event.preventDefault();const file=Math.max(0,Math.min(7,sq.charCodeAt(0)-97+delta[0])),rank=Math.max(1,Math.min(8,+sq[1]+delta[1]));focusSquare=String.fromCharCode(97+file)+rank;const target=$('board').querySelector(`[data-square="${focusSquare}"]`);$('board').querySelectorAll('button').forEach(b=>b.tabIndex=-1);target.tabIndex=0;target.focus();}
});
$('primary-button').onclick=primary;$('hint-button').onclick=hint;$('how-button').onclick=showHow;$('album-button').onclick=showAlbum;$('parent-button').onclick=showParents;$('close-modal').onclick=closeModal;
$('mobile-start').onclick=startReady;
$('modal').addEventListener('close',()=>{if(active()&&mode==='play'&&!document.hidden)clock.start();});
$('pause-button').onclick=()=>{paused=!paused;if(paused)clock.pause();else if(state.phase==='playing'&&mode==='play')clock.start();render();};
$('training-button').onclick=()=>newRound(true);
$('defense-button').onclick=()=>{
 solutionView=null;defenseShown=!defenseShown;render();
};
$('solution-button').onclick=()=>{const p=current(),r=evaluateMove(p.fen,p.mateMovesUci[0]);solutionView=r;defenseShown=false;renderBoard();modal(`<div class="modal-eyebrow">РАЗБИРАЕМСЯ ВМЕСТЕ</div><h2 class="modal-title" id="modal-title">Посмотри на решение</h2><p class="modal-copy">${p.explanation}</p><p class="modal-copy">Ход: <strong>${r.move.from} → ${r.move.to}</strong>. После закрытия окна на доске останется матовая позиция.</p>`);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)clock.pause();else if(active()&&mode==='play')clock.start();});
render();
