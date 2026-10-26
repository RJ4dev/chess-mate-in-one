import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {startBackend} from '../backend/server.mjs';import {createRankingClient} from '../dist/js/ranking-client.js';
test('browser client and backend agree on creation, PIN login, duplicate names, scores and private fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-api-'));const server=await startBackend({dataFile:join(dir,'players.json'),allowedOrigin:'https://rj4dev.github.io',port:0});let token='';
 try{const client=createRankingClient({base:'https://api.example.test',token:()=>token,fetcher:(url,opts)=>fetch('http://127.0.0.1:'+server.port+new URL(url).pathname,{...opts,headers:{...opts.headers,Origin:'https://rj4dev.github.io'}})});
 const created=await client.request('/players',{name:'Тест игрок',pin:'854291'});token=created.token;assert.equal(created.player.stars,0);
 await assert.rejects(client.request('/players',{name:'тест  игрок ',pin:'854291'}),/занято/);await assert.rejects(client.request('/sessions',{name:'Тест игрок',pin:'111111'}),/PIN/);
 const login=await client.request('/sessions',{name:'Тест игрок',pin:'854291'});token=login.token;
 for(let i=0;i<2;i++)await client.request('/results',{roundId:'round-integration-01',score:130});
 assert.equal((await client.request('/me')).player.stars,130);const board=await client.request('/leaderboard');assert.deepEqual(Object.keys(board.players[0]).sort(),['id','name','stars']);assert.equal(board.players[0].stars,130);
 }finally{await server.close();await rm(dir,{recursive:true,force:true});}
});
