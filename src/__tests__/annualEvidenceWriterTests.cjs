'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {writeJsonEvidence}=require('../../scripts/write-json-evidence.cjs');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lfa-json-writer-test-'));
const file=path.join(folder,'evidence.json');
const value={date:new Date('2026-09-08T00:00:00Z'),absent:undefined,values:[undefined,NaN,Infinity,null,true,12],
 batches:Array.from({length:1200},(_,i)=>({id:i,text:'Football ⚽ "reps"\n'.repeat(30),rows:[{count:i}]}))};
const expected=JSON.stringify(value);const original=JSON.stringify;
try {
 JSON.stringify=function(input,...args){assert.ok(input===null||typeof input!=='object','writer must never stringify an accumulated container');return original(input,...args);};
 writeJsonEvidence(file,value);
}finally{JSON.stringify=original;}
const assertComplete=target=>{
 assert.deepEqual(JSON.parse(fs.readFileSync(target,'utf8')),JSON.parse(expected));
 assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).batches.length,1200);
};
assertComplete(file);
const before=fs.readFileSync(file,'utf8');const cyclic={};cyclic.self=cyclic;
assert.throws(()=>writeJsonEvidence(file,cyclic),/circular/i);
assert.equal(fs.readFileSync(file,'utf8'),before,'a failed write preserves the previous complete evidence');
assert.throws(()=>writeJsonEvidence(file,{invalid:1n}),/BigInt/);
assert.deepEqual(fs.readdirSync(folder),['evidence.json'],'failed temporary writes are removed');
const source=fs.readFileSync(require.resolve('../../scripts/write-json-evidence.cjs'),'utf8');
const anchor='i < v.length;';assert.equal(source.split(anchor).length,2,'mutation reaches the array writer');
const context={require,Buffer,JSON,module:{exports:{}}};
require('node:vm').runInNewContext(source.replace(anchor,'i < v.length - 1;'),context);
const mutantFile=path.join(folder,'missing-tail.json');context.module.exports.writeJsonEvidence(mutantFile,value);
assert.throws(()=>assertComplete(mutantFile),assert.AssertionError,'the same checker rejects a writer dropping array tails');
console.log('PASS annual evidence writer: exact 1200-batch round-trip without container stringify; failed-write preservation and dropped-tail fault control');
fs.rmSync(folder,{recursive:true});
