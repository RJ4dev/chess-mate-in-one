import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {chooseComputerMove} from '../dist/js/computer.js';import {satisfies} from '../qa/computer/master-criteria.mjs';
const raw=fs.readFileSync(new URL('../qa/computer/master-holdout.json',import.meta.url)),data=JSON.parse(raw),freeze=JSON.parse(fs.readFileSync(new URL('../qa/computer/master-freeze.json',import.meta.url)));
test('independent tactical holdout sealed before algorithm evaluation',()=>assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),freeze.holdout_sha256));
for(const row of data.cases)test('master independent '+row.id+': '+row.reason,async()=>{const stats={},m=await chooseComputerMove(row.fen,{level:'master',stats,yieldControl:async()=>{}});assert.equal(satisfies(row,m),true,m+' '+row.fen);assert.ok(stats.nodes<=1600);});
