const assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process'),model=require('./model.cjs');
const run=(bin,args,opts={})=>{const r=spawnSync(bin,args,{encoding:'utf8',...opts});assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout.trim();};
console.log(run('node',[path.join(__dirname,'check-model.cjs')]));
const rows=[];
const r=model.create('robot',1);for(const ratio of [.2,.5,.9,1]){const s=r.sample(r.end*ratio,'before');rows.push({kind:'robot',theta:s.theta,elapsed:s.t,v:s.bobV});}
for(const part of [2,3])for(const k of [.05,.5,1,2,2.99,3]){
  const q=model.create('bead',part,k),initial=q.sample(q.start);
  for(const ratio of [.3,.7,1]){const s=q.sample(q.start+q.duration*ratio,'before');rows.push({kind:'bead',mult:part===2?1:k,charge:initial.charge,startTheta:initial.theta,theta:s.theta,elapsed:s.elapsed,v:s.v});}
}
const fullRobot=model.full('robot'),land=fullRobot.events[1].t;for(const ratio of [.3,.7,1]){const s=fullRobot.sample(land+(fullRobot.end-land)*ratio);rows.push({kind:'return',theta:s.theta,elapsed:s.t-land,v:s.bobV});}
for(const k of [.5,2,3]){const q=model.full('bead',k);for(let i=2;i<q.events.length-1;i++){const start=q.events[i].t,end=q.events[i+1].t,initial=q.sample(start);for(const ratio of [.3,.7,1]){const s=q.sample(start+(end-start)*ratio,'before');rows.push({kind:'bead',mult:k,charge:initial.charge,startTheta:initial.theta,theta:s.theta,elapsed:s.t-start,v:s.v});}}}
console.log('PASS independent quadrature:',run('python3',[path.join(__dirname,'../simcanvas-exam/check-model.py')],{input:JSON.stringify(rows)}));
for(const slug of ['jumping-robot-exam-steps','charged-bead-exam-steps']){
  const out=run('python3',['/Users/hl/.agents/skills/simcanvas/scripts/validate_simulation.py',path.join(__dirname,'../../public/simcanvas',slug,'index.html')]);
  assert(!out.includes('FAIL '),out);console.log('PASS strict HTML/runtime validator:',slug);
}
