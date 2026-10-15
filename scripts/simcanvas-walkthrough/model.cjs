/* Question intervals over the independently checked event trajectory kernel. */
const WalkthroughModel = (() => {
  const Source = typeof ExamModel === 'object' ? ExamModel : require('../simcanvas-exam/model.cjs');
  const H = Math.PI / 6, S3 = Math.sqrt(3), robot = Source.robot(), beadCache = new Map();
  function trajectory(kind, k) {
    if (kind === 'robot') return robot;
    if (!beadCache.has(k)) beadCache.set(k, Source.bead(k));
    if (beadCache.size > 24) beadCache.delete(beadCache.keys().next().value);
    return beadCache.get(k);
  }
  function create(kind, part = 1, k = 1) {
    if (!['robot', 'bead'].includes(kind) || ![1, 2, 3].includes(part)) throw Error('Invalid question');
    if (!Number.isFinite(k) || k < .05 || k > 3.2) throw Error('k outside demonstration range');
    const curve = trajectory(kind, k), e = curve.events, isRobot = kind === 'robot';
    const start = isRobot ? (part === 2 ? e[0].t : 0) : part === 1 ? 0 : e[part - 2].t;
    const end = isRobot ? (part === 1 ? e[0].t : part === 2 ? curve.nodes[2].t : e[1].t)
      : part === 1 ? e[0].t : part === 2 ? e[1].t : (e[2]?.t ?? start);
    const endSide = isRobot || end === start ? 'after' : 'before', startSide = 'after', duration = end - start;
    let peakTime = end;
    if (!isRobot && part === 3 && k <= 1) {
      const target = Math.atan(k / S3); let lo = start, hi = end;
      for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        if (curve.sample(mid).theta < target) lo = mid; else hi = mid;
      }
      peakTime = (lo + hi) / 2;
    }
    const checkpoints = isRobot
      ? part === 1 ? [{label:'Release', t:0}, {label:'Bumpers · before', t:end, side:'before'}, {label:'Launch · after', t:end}]
        : part === 2 ? [{label:'Launch', t:start}, {label:'Highest point', t:end}]
        : [{label:'Release',t:0},{label:'Bumpers · before',t:e[0].t,side:'before'},{label:'Launch · after',t:e[0].t},{label:'Highest point',t:curve.nodes[2].t},{label:'Ground · before',t:end,side:'before'},{label:'Ground · after',t:end}]
      : part === 1 ? [{label:'U = 0',t:0},{label:'N · before contact',t:end,side:'before'}]
        : part === 2 ? [{label:'N · release −q',t:start},{label:'Bottom',t:angleTime(curve,start,end,0)},{label:'M · before contact',t:end,side:'before'}]
        : [{label:'M · release +q',t:start},{label:k>3?'Constraint fails':'Maximum Eₖ',t:peakTime,side:k>3?'after':'before'},...(k<=3?[{label:'N · before contact',t:end,side:'before'}]:[])];
    const events = part === 2 && isRobot ? [] : e.filter(ev => ev.t >= start && ev.t <= end);
    function sample(t = start, side, timeline = false) {
      t = timeline ? Math.max(0,Math.min(curve.duration,t)) : Math.max(start, Math.min(end, t));
      side = side ?? (t === end ? endSide : startSide);
      const s = curve.sample(t, side), p = curve.p;
      const frame = {...s,kind,part,k,t,side,start,end,duration,elapsed:t-start,progress:duration?(t-start)/duration:0,checkpoints,events,questionStart:start,questionEnd:end,rampProgress:Math.min(1,t/e[0].t)};
      if (isRobot) {
        if(t===e[0].t)frame.phase=side==='before'?'Bumpers · before impact':'Launch · after impact';
        if(Math.abs(t-robot.nodes[2].t)<1e-9)frame.phase='Highest point';
        if(t===e[1].t)frame.phase=side==='before'?'Ground · before impact':'First landing · shell stopped';
        frame.bobVelocity = {x:s.bobV*Math.cos(s.theta),y:s.after&&!s.landed?s.bobV:s.bobV*Math.sin(s.theta)};
        frame.loss1 = Math.min(4,s.loss); frame.loss2 = Math.max(0,s.loss-4);
        frame.target = part===1?4:part===2?.1:6;
        frame.activeSteps = part===1 ? t===end ? side==='before'?[2]:[2,3] : [0,1]
          : part===2 ? t===end?[1,2]:[0] : s.landed?[1,2,3]:s.after?[0]:[3];
      } else {
        frame.voltage = s.U/curve.U0; frame.speed = s.v/Math.sqrt(p.g*p.d);
        frame.kinetic = s.K/(p.m*p.g*p.d); frame.tension = s.T/(p.m*p.g);
        frame.requiredTension = s.requiredT/(p.m*p.g);
        frame.electric = {x:s.charge*frame.voltage/S3,y:0};
        frame.gravity = {x:0,y:-1};
        frame.rope = {x:-Math.SQRT2*frame.tension*Math.sin(s.theta),y:Math.SQRT2*frame.tension*Math.cos(s.theta)};
        frame.velocity = {x:frame.speed*Math.cos(s.theta),y:frame.speed*Math.sin(s.theta)};
        frame.peakTheta = Math.min(Math.atan(k/S3),H); frame.peakTime=peakTime;
        frame.peakK = s.peak/(p.m*p.g*p.d); frame.critical = part===3&&k===3;
        frame.constraintInvalid=part===3&&k>3;
        frame.branch = k<=1?'interior':k<3?'endpoint':k===3?'critical':'invalid';
        frame.outsideAnswer = !s.invalid&&((t===end&&side==='after')||(t===start&&side==='before'));
        frame.boundaryContext=frame.outsideAnswer?(side==='before'?'before this question interval':'after answer instant'):'';
        if(part===1&&t===end)frame.phase=side==='before'?'N reached · equilibrium':'N contact · charge reverses';
        if(part===2&&t===start)frame.phase=side==='before'?'N · before charge reversal':'N release · charge −q';
        if(part===2&&t===end)frame.phase=side==='before'?'M · immediately before contact':'M contact · next part';
        if(part===3){
          if(t===start)frame.phase=side==='before'?'M · before contact, previous part':s.invalid?'Constraint fails · arc stopped':k===3?'Critical release · T = 0':'M release · changed voltage';
          else if(Math.abs(t-peakTime)<1e-7)frame.phase=k<1?'Interior maximum':'N maximum · before contact';
          if(t===end&&side==='after'&&!s.invalid)frame.phase='N contact · after maximum';
        }
        frame.activeSteps = part===1 ? t===end?[0,2]:[1]
          : part===2 ? t===end&&side==='before'?[1,2,3]:[0]
          : s.invalid?[0]:t===start?[0]:Math.abs(t-peakTime)<1e-7?(k<=1?[2,3]:k<3?[4]:[1]):[1];
        if(frame.outsideAnswer)frame.activeSteps=[];
      }
      return frame;
    }
    return {kind,part,k,start,end,duration,startSide,endSide,checkpoints,events,sample};
  }
  function full(kind,k=1){
    const parts=[1,2,3].map(p=>create(kind,p,k)),curve=trajectory(kind,k),events=curve.events,end=curve.duration,isRobot=kind==='robot';
    const checkpoints=isRobot?[{label:'Release',t:0},{label:'Bumpers',t:events[0].t},{label:'Apex',t:curve.nodes[2].t},{label:'First landing',t:events[1].t},{label:'Bob return · after Q3',t:end}]
      :[{label:'Ramp',t:0},{label:'First N · before',t:events[0].t,side:'before'},{label:'First M · kU₀',t:events[1].t},...(events[2]?[{label:'Next N · before',t:events[2].t,side:'before'},{label:'Later contacts · end',t:end}]:[])];
    const candidates=events.flatMap(e=>[{t:e.t,side:'before',label:e.label+' · before'},{t:e.t,side:'after',label:e.label+' · after'}]);
    if(isRobot)candidates.push({t:curve.nodes[2].t,side:'after',label:'Highest point'});
    else if(k<=3)candidates.push({t:parts[2].sample(parts[2].start).peakTime,side:'before',label:'Maximum Eₖ'});
    candidates.push({t:end,side:'after',label:'End of full process'});
    const stops=[];for(const candidate of candidates){const same=stops.find(p=>Math.abs(p.t-candidate.t)<1e-8&&p.side===candidate.side);if(same)same.label+=' · '+candidate.label;else stops.push(candidate);}
    stops.sort((a,b)=>a.t-b.t||(a.side==='before'?-1:1));
    function sample(time=0,side='after'){
      const t=Math.max(0,Math.min(end,time));
      const part=isRobot?(t<=events[0].t?1:t<=curve.nodes[2].t?2:3)
        :t<events[0].t||(t===events[0].t&&side==='before')?1:t<events[1].t||(t===events[1].t&&side==='before')?2:3;
      const s=parts[part-1].sample(t,side,true);
      const continuation=isRobot?t>events[1].t:k<=3&&(t>parts[2].end||(t===parts[2].end&&side==='after'));
      const coverage=isRobot?(t<=events[0].t?[1,3]:t<=curve.nodes[2].t?[2,3]:t<=events[1].t?[3]:[]):continuation?[]:[part];
      if(continuation){s.outsideAnswer=true;s.boundaryContext='after the requested interval';s.activeSteps=[];s.phase='Continuation · '+s.phase;}
      return {...s,start:0,end,duration:end,elapsed:t,progress:t/end,checkpoints,events,coverage,continuation};
    }
    return {kind,k,start:0,end,duration:end,startSide:'after',endSide:'after',checkpoints,events,stops,sample};
  }
  function angleTime(curve,start,end,angle) {
    const ascending=curve.sample(start).theta<curve.sample(end,'before').theta;
    for(let i=0;i<48;i++){const mid=(start+end)/2;if((curve.sample(mid).theta<angle)===ascending)start=mid;else end=mid;}
    return (start+end)/2;
  }
  function checks() {
    const out=Source.checks(), close=(name,a,b,tol=3e-6)=>out.push({name,actual:a,expected:b,tolerance:tol,pass:Math.abs(a-b)<=tol});
    for(const part of [1,2,3]){
      const q=create('robot',part),s=q.sample(q.start),f=q.sample(q.end);
      close(`Q14.${part} initial time`,s.t,q.start);close(`Q14.${part} terminal side`,f.side==='after'?1:0,1);
      close(`Q14.${part} answer`,part===1?f.body.system.K:part===2?f.y:f.loss,f.target);
    }
    const q1=create('bead',1),last=q1.sample(q1.end);close('Q15.1 angle',last.theta,H);close('Q15.1 voltage ratio',last.voltage,1);close('Q15.1 ends before reversal',last.charge,1);
    for(const ratio of [.1,.5,.9]){const s=q1.sample(q1.end*ratio);close('Q15.1 equilibrium horizontal '+ratio,s.electric.x+s.rope.x,0);close('Q15.1 equilibrium vertical '+ratio,s.gravity.y+s.rope.y,0);}
    const q2=create('bead',2),end=q2.sample(q2.end);close('Q15.2 starts at rest',q2.sample(q2.start).v,0);close('Q15.2 contact side retains speed',end.speed**2,2/S3);close('Q15.2 single-rope tension',end.tension,2*Math.sqrt(6)/3);close('Q15.2 charge',end.charge,-1);
    const beforeN=q2.sample(q2.start,'before');close('Q15.2 pre-start is previous interval',beforeN.outsideAnswer?1:0,1);close('Q15.2 pre-start charge',beforeN.charge,1);close('No active current-question equation before start',beforeN.activeSteps.length,0);
    for(const k of [.05,.5,1,2,2.99,3,3.2]){
      const q=create('bead',3,k),s=q.sample(q.start);close(`Q15.3 k=${k} starts at M`,s.theta,-H);close(`Q15.3 k=${k} starts with +q`,s.charge,1);close(`Q15.3 k=${k} starts at rest`,s.v,0);close(`Q15.3 k=${k} voltage`,s.voltage,k);
      close(`Q15.3 k=${k} initial required tension`,s.requiredTension,(3-k)/(2*Math.sqrt(6)));
      if(k>3){close('Invalid constraint has no arc duration',q.duration,0);close('Invalid rope actual tension',s.tension,0);continue;}
      const peak=q.sample(s.peakTime,'before'),expected=k<=1?Math.sqrt(1+k*k/3)-S3/2+k/(2*S3):k/S3;
      close(`Q15.3 k=${k} applicable peak equation`,peak.activeSteps.includes(k<=1?3:k<3?4:1)?1:0,1);
      close(`Q15.3 k=${k} sampled peak`,peak.kinetic,expected);close(`Q15.3 k=${k} sampled peak angle`,peak.theta,k<=1?Math.atan(k/S3):H);
      for(let i=0;i<=12;i++){
        const f=q.sample(q.start+q.duration*i/12),energy=Math.cos(f.theta)-S3/2+k/S3*(Math.sin(f.theta)+.5);
        close(`Q15.3 k=${k} work-energy ${i}`,f.kinetic,energy);
        const radial=Math.SQRT2*f.tension-Math.cos(f.theta)-f.electric.x*Math.sin(f.theta);
        close(`Q15.3 k=${k} force projection ${i}`,radial,f.speed*f.speed);
      }
    }
    const overview=full('robot'),launch=overview.events[0].t,landing=overview.events[1].t;
    close('Full robot bumper before matches Q1',overview.sample(launch,'before').body.system.K,8);
    close('Full robot launch matches Q1',overview.sample(launch).body.system.K,4);
    close('Full robot landing loss',overview.sample(landing).loss,6);
    close('Full robot continuation actually moves bobs',overview.sample(overview.end).theta,0);
    close('Full robot continuation is outside Q3',overview.sample(overview.end).continuation?1:0,1);
    close('Full robot continuation does not apply Q3 equations',overview.sample(overview.end).activeSteps.length,0);
    for(const k of [.5,1,2,3.2]){
      const f=full('bead',k),N=f.events[0].t,M=f.events[1].t;
      close('Full bead N before is Part1 '+k,f.sample(N,'before').part,1);
      close('Full bead N after is Part2 '+k,f.sample(N).part,2);
      close('Full bead M before is Part2 '+k,f.sample(M,'before').part,2);
      close('Full bead M after is Part3 '+k,f.sample(M).part,3);
      close('Full bead changed U after M '+k,f.sample(M).voltage,k);
      close('Full bead contact resets speed '+k,f.sample(M).v,0);
      if(k>3){close('Full invalid bead stops at M',f.end,M);close('Full invalid bead constraint',f.sample(f.end).constraintInvalid?1:0,1);}
      else{close('Full repeated contacts are outside Q3 '+k,f.sample(f.end).continuation?1:0,1);close('Full final contact reset '+k,f.sample(f.end).v,0);}
    }
    return out;
  }
  return {create,full,checks};
})();
if(typeof module!=='undefined')module.exports=WalkthroughModel;
