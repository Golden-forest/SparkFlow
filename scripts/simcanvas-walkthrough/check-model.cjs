const assert=require('node:assert/strict'),model=require('./model.cjs');
const checks=model.checks(),failures=checks.filter(c=>!c.pass);assert.deepEqual(failures,[]);
for(const kind of ['robot','bead'])for(const part of [1,2,3]){const q=model.create(kind,part);assert(q.checkpoints.every(c=>c.t>=q.start&&c.t<=q.end));assert(q.sample(q.end).side===q.endSide);}
console.log('PASS',checks.length,'scientific and question-interval checks');
