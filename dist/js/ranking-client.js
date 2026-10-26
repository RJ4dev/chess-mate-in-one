export function playerStorage(storage,id){return {getItem:k=>storage?.getItem(id?`player:${id}:${k}`:k),setItem:(k,v)=>{if(!storage)throw Error('storage');storage.setItem(id?`player:${id}:${k}`:k,v);}};}
export function createRankingClient({base='',fetcher=globalThis.fetch,token=()=>''}={}){
 let origin='';try{const u=new URL(base);if(u.protocol==='https:'&&!u.username&&!u.password)origin=u.origin;}catch{}
 return {configured:!!origin,async request(path,data){
  if(!origin)throw Error('Сервис рейтинга пока не подключён по HTTPS. Можно играть гостем.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{const t=token(),r=await fetcher(origin+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(t?{Authorization:'Bearer '+t}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:controller.signal,credentials:'omit',cache:'no-store'});let o;try{o=await r.json();}catch{throw Error('Сервис вернул непонятный ответ.');}
   if(!r.ok){const text={name_taken:'Это имя уже занято. Выбери другое или войди с PIN.',unauthorized:'Проверь имя и PIN. Возможно, нужно войти заново.',rate_limited:'Слишком много попыток. Немного подожди.',invalid_input:'Имя: 2–24 символа. PIN: ровно 6 цифр.',result_limit:'Достигнут лимит результатов профиля. Обратитесь к взрослому.'}[o.error?.code]||'Сервис временно недоступен. Результат сохранён на устройстве.';throw Error(text);}return o;
  }catch(e){if(e.name==='AbortError')throw Error('Сервис не ответил. Можно продолжать играть.');throw e;}finally{clearTimeout(timer);}
 }};
}
export function readSession(storage){try{const s=JSON.parse(storage?.getItem('mate-player-session')||'null');return s&&typeof s.token==='string'&&typeof s.player?.id==='string'&&typeof s.player?.name==='string'?s:null;}catch{return null;}}
export function createRequestGate(){let epoch=0;return {begin(){const id=++epoch;return ()=>id===epoch;},cancel(){epoch++;}};}
