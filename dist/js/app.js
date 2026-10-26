import {Chess,evaluateMove} from './chess.js';
import {PUZZLES} from './puzzles.js';
import {createRound,submitMove,retryPuzzle,useHint,nextPuzzle,choosePuzzles,ActiveClock,createRoundId,canResumeClock} from './game.js';
import {loadProgress,saveProgress,recordResult} from './progress.js';
import {pieceSvg,pieceNames,icon} from './pieces.js';
import {wrongMoveCopy,finishedRoundView} from './messages.js';

import {kingGuide} from './king-guide.js';
import {createAnimations} from './animations.js';
import {RANKING_API} from './config.js';
import {createRankingClient,playerStorage,readSession,createRequestGate} from './ranking-client.js';
import {loadExperience,saveExperience,createSounds} from './experience.js';

const $=id=>document.getElementById(id);
let storage;try{storage=window.localStorage;}catch{storage=null;}
const experience=loadExperience(storage),sounds=createSounds();
let effectTimer,busy=false,actionEpoch=0,defenseTimer;
const animations=createAnimations({enabled:()=>experience.effects,reduced:()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches});
function cancelAction(){actionEpoch++;busy=false;clearTimeout(defenseTimer);animations.cancel();document.querySelector('.pocket-score')?.classList.remove('score-target');if(typeof state!=='undefined')$('round-score').textContent=String(state.score);if(typeof mode!=='undefined'&&canResumeClock({mode,phase:state.phase,paused,modalOpen:$('modal').open,hidden:document.hidden}))clock.start();}
const profileGate=createRequestGate();
let session=readSession(storage);
let scopedStorage=playerStorage(storage,session?.player.id);
const ranking=createRankingClient({base:RANKING_API,token:()=>session?.token||''});
function readPending(id){try{const a=JSON.parse(storage?.getItem('mate-pending:'+id)||'[]');return Array.isArray(a)?a.filter(x=>typeof x.roundId==='string'&&Number.isInteger(x.score)).slice(0,100):[];}catch{return [];}}
let sending=false;
async function flushScores(){
 if(sending||!session||!ranking.configured)return;
 sending=true;const id=session.player.id;
 try{for(const item of readPending(id)){if(session?.player.id!==id)break;const r=await ranking.request('/results',item);const rest=readPending(id).filter(x=>x.roundId!==item.roundId);storage.setItem('mate-pending:'+id,JSON.stringify(rest));if(session?.player.id===id){session.player=r.player;try{storage?.setItem('mate-player-session',JSON.stringify(session));}catch{}$('total-stars').textContent=String(session.player.stars);}}}catch{toast('Общий рейтинг обновится позже. Очки остаются на устройстве.');}finally{sending=false;}
}
function queueScore(){
 if(!session||state.training||!state.answers.length)return;
 try{const id=session.player.id,a=readPending(id),item={roundId,score:state.score},found=a.find(x=>x.roundId===roundId);if(found){found.score=item.score;}else{if(a.length>=100){toast('Очередь рейтинга заполнена. Подключись к серверу перед следующей игрой.');return;}a.push(item);}storage.setItem('mate-pending:'+id,JSON.stringify(a));}catch{toast('Не удалось сохранить отправку в рейтинг. Личные очки сохранены отдельно.');}
}

function tone(kind){if(experience.sound&&!document.hidden)sounds.play(kind);}
function applyExperience(){
 document.body.classList.toggle('simple-ui',!experience.detailed);document.body.classList.toggle('effects-off',!experience.effects);
 $('view-button').textContent=experience.detailed?'Проще':'Подробнее';$('view-button').setAttribute('aria-pressed',String(experience.detailed));
 for(const [id,key,label] of [['sound-button','sound','Звук'],['effects-button','effects','Эффекты']]){
  $(id).textContent=label+': '+(experience[key]?'вкл':'выкл');$(id).setAttribute('aria-pressed',String(experience[key]));
 }
}
function effect(kind){
 if(!experience.effects||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const frame=document.querySelector('.board-frame');frame.classList.remove('happy-board','try-board');
 requestAnimationFrame(()=>{if(experience.effects)frame.classList.add(kind==='mate'?'happy-board':'try-board');});
 if(kind==='mate'){
  clearTimeout(effectTimer);$('celebration').innerHTML=Array.from({length:18},(_,i)=>`<span style="--x:${(i*37)%100}vw;--drift:${(i%2?1:-1)*(20+i*4)}px;--delay:${i%5*.06}s;--spin:${i*39}deg">${i%3?'✦':'★'}</span>`).join('');
  effectTimer=setTimeout(()=>$('celebration').replaceChildren(),1700);
 }
}
let progress=loadProgress(scopedStorage),mode='ready',lessonIndex=-1,selected=null,focusSquare='a1',paused=false,defenseShown=false;
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
function active(){return !busy&&mode!=='ready'&&state.phase==='playing'&&!paused&&!$('modal').open;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
function settle(){if(mode!=='play'||state.training)return;progress=recordResult(progress,roundId,state.score,state.answers);lastSaveSucceeded=saveProgress(scopedStorage,progress);if(!lastSaveSucceeded)toast('Игра работает, но браузер не сохраняет награды.');queueScore();void flushScores();}
function newRound(training=false){
 cancelAction();
 if(mode==='play'&&state.answers.length)settle();
 void flushScores();
 lessonIndex=-1;mode='play';state=createRound(pick(),{training});roundId=createRoundId();selected=null;paused=false;defenseShown=false;solutionView=null;clock.reset();clock.start();render();scrollGame();
}
function startReady(){mode='play';clock.reset();clock.start();render();scrollGame();}
function startLesson(index=0){
 cancelAction();
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
 const f=state.feedback;const guide=f&&!defenseShown?kingGuide(boardFen()):null;const crosses=guide&&['mate','stalemate'].includes(guide.kind)?new Set(guide.blocked):new Set();
 const highlighted=solutionView?.move||(f?(defenseShown&&f.defense?f.defense:f.move):null);
 let html='';
 for(let rank=8;rank>=1;rank--)for(let file=0;file<8;file++){
  const square=String.fromCharCode(97+file)+rank,piece=chess.get(square);
  const dark=(file+rank)%2===1;
  const feminine=piece&&['r','p'].includes(piece.type);
  const name=piece?`${piece.color==='w'?(feminine?'белая':'белый'):(feminine?'чёрная':'чёрный')} ${pieceNames[piece.type]}`:'пустая клетка';
  const classes=['square',dark?'dark':'',piece?'has-piece':'',selected===square?'selected':'',legal.includes(square)?'target':'',highlighted&&(highlighted.from===square||highlighted.to===square)?'last-move':'',piece?.type==='k'&&piece.color===chess.turn()&&chess.isCheck()?'king-check':''].filter(Boolean).join(' ');
  html+=`<button class="${classes}" data-square="${square}" aria-label="${square}, ${name}" aria-pressed="${selected===square}" tabindex="${focusSquare===square?0:-1}">${piece?pieceSvg(piece.type,piece.color):''}${crosses.has(square)?'<span class="blocked-cross" aria-hidden="true">×</span>':''}${file===0?`<span class="coordinate rank-label">${rank}</span>`:''}${rank===1?`<span class="coordinate file-label">${String.fromCharCode(97+file)}</span>`:''}</button>`;
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
 document.body.dataset.phase=mode==='lesson'?'lesson':state.phase;
 renderBoard();renderBadges();
 const lesson=mode==='lesson',p=current(),feedback=state.feedback;
 $('player-button').textContent='Игрок: '+(session?.player.name||'Гость');
 $('total-stars').textContent=session?session.player.stars:progress.stars;
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
 if(state.phase==='finished'&&mode==='play'&&!state.training)$('player-button').textContent='Игрок: '+(session?.player.name||'Гость');
 $('total-stars').textContent=session?session.player.stars:progress.stars;
}
async function onSquare(square){
 if(mode==='ready')startReady();
 if(!active())return;
 const chess=new Chess(current().fen),piece=chess.get(square);focusSquare=square;
 if(piece?.color==='w'){selected=selected===square?null:square;if(selected)tone('select');renderBoard();$('board-caption').textContent=selected?'Теперь выбери клетку с точкой':'Нажми на фигуру, затем на клетку';return;}
 if(!selected){toast('Сначала выбери белую фигуру.');return;}
 const move=selected+square,from=selected;selected=null;
 const outcome=mode==='lesson'?{result:evaluateMove(current().fen,move)}:submitMove(state,move,clock.elapsed());
 if(mode==='lesson'&&move!==current().mateMovesUci[0]){render();toast('Попробуем ход из учебного примера.');return;}
 if(outcome.result.kind==='illegal'){render();toast('Эта фигура так не ходит. Сердечко на месте.');return;}
 clock.pause();busy=true;const epoch=++actionEpoch,before=state.score;
 await animations.move({from:$('board').querySelector(`[data-square="${from}"]`),to:$('board').querySelector(`[data-square="${square}"]`),duration:1100});
 if(epoch!==actionEpoch)return;
 if(mode!=='lesson'&&outcome.state.lives<state.lives){await animations.heart($('hearts').querySelectorAll('.icon')[state.lives-1]);if(epoch!==actionEpoch)return;}
 if(mode==='lesson'){state={...state,phase:'review',feedback:outcome.result};}else{state=outcome.state;}
 defenseShown=false;
 if(state.phase==='finished')settle();
 render();tone(outcome.result.kind==='mate'?'mate':'retry');
 if(outcome.result.kind==='mate'&&mode!=='lesson'){
  const counter=$('round-score'),origin=$('board').querySelector(`[data-square="${square}"]`),target=counter.getBoundingClientRect();
  const pocket=document.querySelector('.pocket-score');if(target.bottom>window.innerHeight)pocket.classList.add('score-target');
  counter.textContent=String(before);
  await animations.stars({from:origin,to:counter,amount:9,before,after:state.score,counter});pocket.classList.remove('score-target');
  if(epoch!==actionEpoch)return;counter.textContent=String(state.score);
 }
 busy=false;
 if(outcome.result.reason==='defense'&&outcome.result.defense){
  defenseTimer=setTimeout(async()=>{
   if(epoch!==actionEpoch||!state.feedback||$('modal').open||paused)return;
   busy=true;const d=outcome.result.defense;
   await animations.move({from:$('board').querySelector(`[data-square="${d.from}"]`),to:$('board').querySelector(`[data-square="${d.to}"]`),duration:1100});
   if(epoch!==actionEpoch)return;defenseShown=true;busy=false;render();
  },1000);
 }
}

function primary(){
 if(busy)return;cancelAction();
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
 if(busy)return;cancelAction();tone('hint');
 if(mode==='ready')startReady();
 if(!active())return;
 if(mode==='lesson'){selected=current().mateMovesUci[0].slice(0,2);render();return;}
 state=useHint(state);selected=state.hints===2?current().mateMovesUci[0].slice(0,2):null;
 if(state.phase==='review')clock.pause();render();
}
function modal(html,rankingWindow=false){profileGate.cancel();cancelAction();$('modal').classList.toggle('ranking-modal',rankingWindow);clock.pause();$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function closeModal(){profileGate.cancel();if($('player-pin'))$('player-pin').value='';$('modal').close();}
function showHow(){modal(`<div class="modal-eyebrow">ТРИ МАЛЕНЬКИХ ШАГА</div><h2 class="modal-title" id="modal-title">Давай найдём мат!</h2><div class="modal-copy"><p><strong>1. Найди шах.</strong> Какая фигура может напасть на короля?</p><p><strong>2. Проверь выходы.</strong> Может ли король убежать, взять фигуру или закрыться?</p><p><strong>3. Если спасения нет — это мат!</strong></p><p>Точки показывают, куда ходит выбранная фигура. Подсказки не отнимают сердечки.</p></div><button class="primary-button" id="start-lesson">Попробуем вместе ${icon('arrow')}</button><p class="keyboard-note">Клавиатура: стрелки — клетка; Enter — выбрать; Esc — отменить выбор.</p>`);$('start-lesson').onclick=()=>{closeModal();startLesson();};}
function showAlbum(){modal(`<div class="modal-eyebrow">ШАХМАТНЫЙ ИССЛЕДОВАТЕЛЬ</div><h2 class="modal-title" id="modal-title">Моя коллекция</h2><p class="modal-copy">У тебя <strong>${session?session.player.stars:progress.stars}</strong> звёзд и <strong>${progress.solved.length}</strong> разных решённых задач.</p><div class="modal-badges">${badges.map(b=>`<div class="badge-item ${progress.badges.includes(b.id)?'unlocked':''}"><span class="badge-medal">${icon(b.icon)}</span><span><strong>${b.name}</strong><br>${progress.badges.includes(b.id)?'Награда твоя!':b.description}</span></div>`).join('')}</div><p class="modal-copy">Награды остаются с тобой, даже если пропустить день. В общий рейтинг идут новые раунды после входа. Значки и список решённых задач хранятся на этом устройстве.</p>`);}
function showParents(){modal(`<div class="modal-eyebrow">СПОКОЙНОЕ ОБУЧЕНИЕ</div><h2 class="modal-title" id="modal-title">Взрослым об игре</h2><div class="modal-copy"><p>Для детей, которые уже знают ходы фигур. Сначала пройдите три примера в разделе «Как играть». При необходимости прочитайте короткие объяснения ребёнку.</p><p>Раунд: 5 задач и 3 общие попытки. Невозможный ход не штрафуется. Скорость даёт только небольшой бонус — ограничения времени нет. В тренировке сердечки и очки не расходуются.</p><p>200 проверенных позиций, преимущественно варианты простых матов ладьёй и ферзём. Проверка работает в браузере. Аккаунтов, рекламы и покупок нет.</p><p>Награды сохраняются после завершения раунда в этом браузере. Незавершённый раунд после закрытия страницы начнётся заново. Очистка браузера удалит награды. Синхронизации между устройствами пока нет.</p><p>Следите за тем, понимает ли ребёнок, почему король не может спастись. Один спокойный раунд лучше гонки за звёздами.</p></div>`);}

function showPlayer(){
 modal(`<h2 id="modal-title" class="modal-title">Кто играет?</h2><p class="modal-copy">Гость играет без регистрации. Для общего рейтинга создай имя и PIN из 6 цифр. Имя будет видно другим игрокам.</p><p id="current-player" class="modal-copy"></p><form id="player-form"><label class="profile-label">Имя или никнейм<input id="player-name" name="name" minlength="2" maxlength="24" autocomplete="username" required></label><label class="profile-label">PIN — 6 цифр<input id="player-pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><div class="profile-actions"><button class="primary-button" type="submit" name="action" value="login">Войти</button><button class="secondary-button" type="submit" name="action" value="create">Создать игрока</button></div><p id="profile-status" class="modal-copy" role="status"></p></form><button id="guest-player" class="secondary-button">Играть гостем</button><p class="keyboard-note">Старые гостевые награды остаются на этом устройстве. PIN нигде не показывается в рейтинге.</p>`);
 $('current-player').textContent=session?'Сейчас: '+session.player.name:'Сейчас: Гость';
 if(!ranking.configured)$('profile-status').textContent='Сервис общего рейтинга готовится к подключению. Пока можно играть гостем.';
 $('guest-player').onclick=()=>switchPlayer(null);
 $('player-form').onsubmit=async event=>{
  event.preventDefault();if(!ranking.configured)return;
  const form=event.currentTarget,buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  const isCurrent=profileGate.begin();
  const endpoint=event.submitter?.value==='create'?'/players':'/sessions';
  try{const result=await ranking.request(endpoint,{name:$('player-name').value,pin:$('player-pin').value});if(!isCurrent()||!$('modal').open||$('player-form')!==form)return;$('player-pin').value='';switchPlayer(result);}catch(error){if(isCurrent()&&$('profile-status')&&$('player-form')===form)$('profile-status').textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}
 };
}
function switchPlayer(value){
 profileGate.cancel();
 if(mode==='play'&&state.answers.length)settle();
 cancelAction();clock.pause();session=value;
 try{if(value)storage?.setItem('mate-player-session',JSON.stringify(value));else storage?.removeItem('mate-player-session');}catch{toast('Вход сохранится только до закрытия страницы.');}
 scopedStorage=playerStorage(storage,session?.player.id);progress=loadProgress(scopedStorage);mode='ready';state=createRound(pick());roundId=createRoundId();selected=null;defenseShown=false;solutionView=null;paused=false;
 closeModal();render();void flushScores();
}
async function showRanking(){
 modal('<h2 id="modal-title" class="modal-title">Рейтинг игроков</h2><p id="ranking-status" class="modal-copy" role="status">Загружаем звёзды…</p><ol id="ranking-list" class="ranking-list"></ol>',true);
 try{await flushScores();const result=await ranking.request('/leaderboard');if(!$('ranking-list'))return;const list=$('ranking-list');list.replaceChildren();
  for(const p of result.players){const row=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=p.name;score.textContent='★ '+p.stars;row.append(name,score);if(p.id===session?.player.id)row.className='ranking-self';list.append(row);}
  $('ranking-status').textContent=result.players.length?'Накопленные звёзды игроков':'Здесь появится первый игрок!';
 }catch(error){if($('ranking-status'))$('ranking-status').textContent=error.message;}
}
$('player-button').onclick=showPlayer;$('ranking-button').onclick=showRanking;
$('view-button').onclick=()=>{cancelAction();experience.detailed=!experience.detailed;applyExperience();if(!saveExperience(storage,experience))toast('Вид экрана изменён только на этот сеанс.');};
$('sound-button').onclick=()=>{experience.sound=!experience.sound;if(experience.sound)tone('select');else sounds.mute();applyExperience();if(!saveExperience(storage,experience))toast('Настройка звука изменена только на этот сеанс.');};
$('effects-button').onclick=()=>{cancelAction();experience.effects=!experience.effects;if(!experience.effects){clearTimeout(effectTimer);$('celebration').replaceChildren();document.querySelector('.board-frame').classList.remove('happy-board','try-board');}applyExperience();if(!saveExperience(storage,experience))toast('Настройка эффектов изменена только на этот сеанс.');};
applyExperience();
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
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
$('modal').addEventListener('close',()=>{profileGate.cancel();if($('player-pin'))$('player-pin').value='';if(active()&&mode==='play'&&!document.hidden)clock.start();});
$('pause-button').onclick=()=>{cancelAction();paused=!paused;if(paused)clock.pause();else if(state.phase==='playing'&&mode==='play')clock.start();render();};
$('training-button').onclick=()=>newRound(true);
$('defense-button').onclick=()=>{
 cancelAction();
 solutionView=null;defenseShown=!defenseShown;render();
};
$('solution-button').onclick=()=>{const p=current(),r=evaluateMove(p.fen,p.mateMovesUci[0]);solutionView=r;defenseShown=false;renderBoard();modal(`<div class="modal-eyebrow">РАЗБИРАЕМСЯ ВМЕСТЕ</div><h2 class="modal-title" id="modal-title">Посмотри на решение</h2><p class="modal-copy">${p.explanation}</p><p class="modal-copy">Ход: <strong>${r.move.from} → ${r.move.to}</strong>. После закрытия окна на доске останется матовая позиция.</p>`);};
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAction();clock.pause();sounds.mute();}else if(active()&&mode==='play')clock.start();});
render();
