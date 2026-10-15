(() => {
  const $=id=>document.getElementById(id),kind=WALKTHROUGH_KIND,isRobot=kind==='robot',content=WalkthroughContent[kind];
  let part=1,k=1,mode='full',question=WalkthroughModel.full(kind,k),time=0,side='after',running=false,last=null,cycle=1,stopIndex=0,hold=null;
  const loopOptions={question:false,full:true};
  const C={green:'#22765c',blue:'#277eac',orange:'#b77b20',gray:'#69766e',ink:'#203c32',muted:'#60756b',red:'#b14734'};
  const f=(n,d=2)=>Math.abs(n)<.5*10**(-d)?(0).toFixed(d):n.toFixed(d);
  const text=(x,y,value,color=C.ink,size=22,extra='')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${value}</text>`;
  const line=(x1,y1,x2,y2,color=C.muted,width=3,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
  const circle=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  function arrow(id,x,y,dx,dy,color,marker,label=''){
    if(Math.hypot(dx,dy)<.01)return '';
    return line(x,y,x+dx,y+dy,color,3.5,`id="${id}" marker-end="url(#${marker})"`)+(label?text(x+dx+(dx<0?-8:9),y+dy-8,label,color,19,`text-anchor="${dx<0?'end':'start'}" class="fine"`):'');
  }
  function robotScene(s){
    const cx=430,base=365,scale=425,cy=base-scale*s.y,R=.4*scale,r=185,x=R*Math.sin(s.theta),by=cy+R*Math.cos(s.theta);
    $('apparatus').innerHTML=line(170,550,720,550,'#889b8e',3)+Array.from({length:20},(_,i)=>line(185+i*26,550,174+i*26,563,'#b4c4b6',2)).join('')
      +(part===2||s.y>0?circle(cx,base,r,'none','stroke="#bccdc0" stroke-width="2" stroke-dasharray="7 7"'):'');
    const bobA=circle(cx-x,by,15,C.orange,'id="bobA" stroke="#fffefa" stroke-width="2"');
    const clip=x<12?`<clipPath id="bobHalf"><rect x="${cx}" y="${by-16}" width="32" height="32"/></clipPath>`:'';
    const bobB=circle(cx+x,by,15,C.blue,`id="bobB" stroke="#fffefa" stroke-width="2" ${x<12?'clip-path="url(#bobHalf)"':''}`);
    $('objects').innerHTML=circle(cx,cy,r,'url(#shellFill)','id="shell" fill-opacity=".62" stroke="#6f8a77" stroke-width="3.5"')
      +`<rect x="${cx-57}" y="${cy-r-44}" width="114" height="42" rx="11" fill="#d3dfd5" stroke="#6f8a77" stroke-width="3"/>`
      +`<rect x="${cx-36}" y="${cy-r-33}" width="72" height="19" rx="7" fill="#849a8e"/>`
      +circle(cx-17,cy-r-23,4,'#fffefa')+circle(cx+17,cy-r-23,4,'#fffefa')
      +line(cx-r,cy,cx-R+14,cy,'#546f5c',8)+line(cx+R-14,cy,cx+r,cy,'#546f5c',8)
      +line(cx,cy,cx-x,by,C.orange,3)+line(cx,cy,cx+x,by,C.blue,3)+circle(cx,cy,6,'#546f5c')+clip+bobA+bobB
      +text(cx-x-26,by+37,'A',C.orange,22,'text-anchor="end"')+text(cx+x+24,by+37,'B',C.blue)
      +text(cx+12,cy-15,'O',C.muted,20);
    $('traces').innerHTML=`<path d="M${cx-R} ${cy} A${R} ${R} 0 0 0 ${cx} ${cy+R} A${R} ${R} 0 0 0 ${cx+R} ${cy}" fill="none" stroke="#b9cbbe" stroke-width="2" stroke-dasharray="5 7"/>`;
    let vectors='';
    if(!s.after||s.landed){
      for(const sign of [-1,1])vectors+=arrow(sign<0?'bobVelocityA':'bobVelocityB',cx+sign*x,by,sign*s.bobVelocity.x*22,-s.bobVelocity.y*22,sign<0?C.orange:C.blue,sign<0?'orangeArrow':'blueArrow','v_b');
    }else{
      for(const sign of [-1,1])vectors+=arrow(sign<0?'bobVelocityA':'bobVelocityB',cx+sign*x,by,0,-s.bobV*32,sign<0?C.orange:C.blue,sign<0?'orangeArrow':'blueArrow');
    }
    if(s.after) vectors+=arrow('shellVelocity',cx,cy-r-50,0,-s.vy*32,C.green,'greenArrow','V');
    $('vectors').innerHTML=vectors;
    let labels=part===2?text(50,105,'V_launch = √2 m/s',C.muted,23)+text(50,138,'g = 10 m/s²',C.muted,23):text(50,105,'v₀ = 4 m/s',C.muted,23)+text(50,138,'R = 0.4 m',C.muted,23);
    if(part===1){
      labels+=text(65,215,'Bob speed',C.muted,20)+text(65,248,f(Math.abs(s.bobV))+' m/s',C.orange,29,'id="bobSpeedLabel"');
      if(s.after)labels+=text(640,235,'V = √2 m/s',C.green,25)+text(640,273,'Eₖ = 4 J',C.green,30,'id="impactResultLabel"');
      else if(time===s.questionEnd)labels+=text(640,235,'v_b = 2√2 m/s',C.orange,25);
    }else if(part===2){
      labels+=line(682,base,682,cy,C.green,3)+line(670,base,694,base,C.green,2)+line(670,cy,694,cy,C.green,2)
        +text(706,cy-14,'h = '+f(s.y,3)+' m',C.green,25,'id="heightLabel"')
        +text(55,233,'V(t) = '+f(s.vy)+' m/s',C.green,25,'id="shellSpeedLabel"')
        +(time===s.questionEnd?text(55,273,'v = 0 · apex',C.green,25):'');
    }else{
      labels+=text(50,218,'Bumper loss',C.muted,20)+text(50,252,f(s.loss1)+' J',C.orange,29,'id="loss1Label"')
        +text(665,218,'Ground loss',C.muted,20)+text(665,252,f(s.loss2)+' J',C.red,29,'id="loss2Label"')
        +text(665,310,'V_shell = '+f(s.vy),C.green,22,'id="shellSpeedLabel"')
        +text(665,344,(s.continuation?'|v_b| = ':'v_b = ')+f(s.continuation?Math.abs(s.bobV):s.bobV),C.blue,22,'id="bobSpeedLabel"')+text(665,372,s.continuation?'m/s · bob tangent speed':'m/s · upward +',C.muted,17,'class="fine"')
        +(s.landed?text(235,603,s.continuation?'After Q3 · bobs return, shell fixed':'Shell stops · bobs keep downward speed',C.red,20):'');
    }
    $('annotations').innerHTML=labels;
  }
  function beadScene(s){
    const project=(x,y,z=0)=>({x:445+245*x+75*z,y:175-245*y-25*z});
    const pos=project(Math.sin(s.theta),-Math.cos(s.theta)),a=project(0,0,-1),b=project(0,0,1),o=project(0,0);
    let apparatus='';
    for(const sign of [-1,1]){
      const points=[project(sign*.5,.25,-1),project(sign*.5,.25,1),project(sign*.5,-1.35,1),project(sign*.5,-1.35,-1)];
      apparatus+=`<polygon points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="${sign<0?'#efd7ad':'#c6dfe6'}" fill-opacity=".40" stroke="${sign<0?C.orange:C.blue}" stroke-width="2.5"/>`;
      apparatus+=text(sign<0?285:610,559,sign<0?'M  +':'N  −',sign<0?C.orange:C.blue,27);
    }
    if(s.voltage>0)apparatus+=Array.from({length:3},(_,i)=>arrow('field'+i,350,267+i*42,178,0,'#87aa92','greenArrow')).join('');
    apparatus+=line(a.x,a.y,b.x,b.y,'#6f8977',8)+text(423,103,'Insulating rod',C.muted,20,'class="fine"');
    $('apparatus').innerHTML=apparatus;
    const ropeStyle=s.invalid?'stroke-dasharray="7 7"':'';
    $('objects').innerHTML=line(a.x,a.y,pos.x,pos.y,'#799280',3,ropeStyle)+line(b.x,b.y,pos.x,pos.y,'#799280',3,ropeStyle)
      +circle(a.x,a.y,5,'#5e7967')+circle(b.x,b.y,5,'#5e7967')
      +circle(pos.x,pos.y,19,s.charge>0?C.orange:C.blue,`id="bead" stroke="#fffefa" stroke-width="3"`)
      +text(pos.x,pos.y+8,s.charge>0?'+':'−','#fffefa',27,'text-anchor="middle"');
    const arc=Array.from({length:61},(_,i)=>{const t=-Math.PI/6+i*Math.PI/180;const p=project(Math.sin(t),-Math.cos(t));return p.x+','+p.y;});
    let traces=`<polyline points="${arc.join(' ')}" fill="none" stroke="#8fac99" stroke-width="2" stroke-dasharray="6 6"/>`;
    if(part===3&&!s.constraintInvalid&&!s.outsideAnswer){
      const peak=project(Math.sin(s.peakTheta),-Math.cos(s.peakTheta));
      traces+=circle(peak.x,peak.y,27,'none','id="maximumMarker" stroke="#22765c" stroke-width="2" stroke-dasharray="4 4"')
        +text(peak.x+35,peak.y+35,s.k<=1?'θ* = '+f(s.peakTheta*180/Math.PI,1)+'°':'Maximum at N',C.green,20,'class="fine"');
    }
    $('traces').innerHTML=traces;
    let vectors='';
    if(part!==1&&!s.invalid)vectors+=arrow('velocityArrow',pos.x,pos.y,s.velocity.x*74,-s.velocity.y*74,C.blue,'blueArrow','v');
    if(part!==3||time===s.questionStart||s.invalid){
      vectors+=arrow('electricArrow',pos.x,pos.y,s.electric.x*65,-s.electric.y*65,C.orange,'orangeArrow','qE')
        +arrow('gravityArrow',pos.x,pos.y,0,65,C.gray,'grayArrow','mg');
      if(!s.invalid)vectors+=arrow('ropeArrow',pos.x,pos.y,s.rope.x*65,-s.rope.y*65,C.green,'greenArrow','√2T');
    }
    $('vectors').innerHTML=vectors;
    const thetaLine=line(o.x,o.y,pos.x,pos.y,'#a4b9aa',1.5,'stroke-dasharray="3 5"');
    let annotations=thetaLine+text(450,166,'O',C.muted,18,'class="fine"')+text((o.x+pos.x)/2+10,(o.y+pos.y)/2,'d',C.muted,22)
      +text(45,103,'θ = '+f(s.theta*180/Math.PI,1)+'°',C.ink,25,'id="angleLabel"')
      +text(45,140,'U/U₀ = '+f(s.voltage),C.green,24,'id="voltageLabel"')
      +text(45,180,'q_b = '+(s.charge>0?'+q':'−q'),s.charge>0?C.orange:C.blue,23,'id="chargeLabel"');
    if(part===1)annotations+=s.outsideAnswer?text(45,249,'Contact · charge reverses',C.muted,21):text(45,249,'qE = mg tanθ',C.green,23)+text(45,281,'Equilibrium sequence',C.muted,19,'class="fine"');
    if(part===2)annotations+=text(45,500,'v/√(gd) = '+f(Math.abs(s.speed),3),C.blue,25,'id="speedLabel"')+text(45,540,'T/(mg) = '+f(s.tension,3),C.green,25,'id="tensionLabel"');
    if(part===3)annotations+=text(45,490,'Eₖ/(mgd) = '+f(s.kinetic,3),C.blue,25,'id="kineticLabel"')
      +text(45,530,s.continuation?'After Q3 · repeated contacts':s.outsideAnswer?'Previous interval · contact comparison':time===s.questionStart?'T_start/(mg) = '+f(s.tension,3):'Peak/(mgd) = '+f(s.peakK,3),C.green,23,'id="peakLabel"');
    const ix=761,iy=282;
    annotations+=`<g id="ropeInset"><rect x="675" y="220" width="172" height="185" rx="10" fill="#fffefa" stroke="#d5dfd6"/>`
      +text(ix,246,'Rope-plane view',C.muted,15,'text-anchor="middle" class="fine"')
      +line(ix-65,iy,ix+65,iy,'#6f8977',5)+line(ix-65,iy,ix,iy+65,'#799280',2)+line(ix+65,iy,ix,iy+65,'#799280',2)
      +line(ix,iy,ix,iy+65,'#a4b9aa',1.5,'stroke-dasharray="4 4"')
      +`<path d="M${ix-10} ${iy+55} L${ix} ${iy+45} L${ix+10} ${iy+55}" fill="none" stroke="#799280"/>`
      +circle(ix,iy+65,5,C.blue)+text(ix-44,iy+30,'T',C.green,17,'class="fine"')+text(ix+34,iy+30,'T',C.green,17,'class="fine"')
      +text(ix+10,iy+20,'d',C.muted,16,'class="fine"')+text(ix,iy+94,'90° · ℓ = √2d',C.muted,16,'text-anchor="middle" class="fine"')+'</g>';
    if(s.invalid)annotations+=text(270,604,'T_required &lt; 0 · circular motion stopped',C.red,24);
    $('annotations').innerHTML=annotations;
  }
  function showPart(next){
    part=next;
    const selected=content.parts[part-1];
    $('equations').innerHTML=selected.rows.map(([law,formula],i)=>`<li class="equation" data-step="${i}"><div class="law">${i+1} · ${law.replaceAll('<','&lt;')}</div><div class="formula">${formula}</div></li>`).join('');
  }
  function bindTimeline(){
    $('checkpoints').innerHTML=question.checkpoints.map((c,i)=>`<button data-checkpoint="${i}">${c.label}</button>`).join('');
    $('checkpoints').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{const c=question.checkpoints[+btn.dataset.checkpoint];seek(c.t,c.side??(c.t===question.end?question.endSide:'after'));});
    $('eventControls').hidden=question.events.length===0;
    $('eventSelect').innerHTML=question.events.map((e,i)=>`<option value="${i}">${e.label}</option>`).join('');
    $('kControl').hidden=isRobot||(mode==='question'&&part!==3);
    $('kLabel').textContent=mode==='full'?'After first M: U = kU₀':'U = kU₀';
  }
  function restart(){time=question.start;side=question.startSide;last=null;hold=null;stopIndex=0;}
  function setQuestion(next){
    if(![1,2,3].includes(next))throw Error('Invalid subquestion');
    mode='question';running=false;cycle=1;question=WalkthroughModel.create(kind,next,k);restart();showPart(next);
    $('rate').value=isRobot?(part===2?'0.025':'0.05'):(part===1?'0.25':'0.1');bindTimeline();render();
  }
  function fullProcess(autoplay=false){
    mode='full';running=false;cycle=1;question=WalkthroughModel.full(kind,k);restart();showPart(1);
    $('rate').value=isRobot?'0.05':'0.1';bindTimeline();render();if(autoplay)start();
  }
  function syncStops(){
    if(mode!=='full')return;
    const index=question.stops.findIndex(p=>p.t>time+1e-9||(Math.abs(p.t-time)<1e-9&&side==='before'&&p.side==='after'));
    stopIndex=index<0?question.stops.length:index;
  }
  function setLoop(enabled){
    loopOptions[mode]=enabled;
    if(!enabled&&hold?.type==='end'){hold=null;running=false;}
    render();
  }
  function seek(t,newSide){
    if(!Number.isFinite(t))throw Error('Invalid time');
    running=false;last=null;hold=null;time=Math.max(question.start,Math.min(question.end,t));side=newSide??(time===question.end?question.endSide:'after');syncStops();render();
  }
  function getState(){return {...question.sample(time,side),mode,loop:loopOptions[mode],cycle,holding:!!hold,holdRemaining:hold?.remaining??0,running,rate:Number($('rate').value)};}
  function getReadouts(){const s=getState();return isRobot?{part:s.part,bobSpeed:Math.abs(s.bobV),shellVelocity:s.vy,height:s.y,loss1:s.loss1,loss2:s.loss2,loss:s.loss}:{part:s.part,angle:s.theta*180/Math.PI,voltage:s.voltage,charge:s.charge,speed:s.speed,tension:s.tension,kinetic:s.kinetic,peak:s.peakK};}
  function render(){
    const s=getState();if(part!==s.part)showPart(s.part);const selected=content.parts[part-1];
    isRobot?robotScene(s):beadScene(s);
    $('questionLabel').textContent=mode==='full'?'Full process · Q'+(isRobot?'14':'15')+' · '+(s.continuation?'Continuation':'Part'+(s.coverage.length>1?'s ':' ')+s.coverage.join(' & ')):'Q'+(isRobot?'14':'15')+' · Part '+part+' · '+selected.en;
    $('phase').textContent=s.phase;
    $('clock').textContent=!isRobot&&part===1?'Ramp '+Math.round(s.rampProgress*100)+'%':mode==='full'&&!isRobot?'Dynamic t = '+f(Math.max(0,time-question.events[0].t),3)+' s':'t = '+f(s.elapsed,3)+' s';
    const atEvent=question.events.findIndex(e=>Math.abs(e.t-time)<1e-10);
    $('eventSide').textContent=atEvent>=0?(side.toUpperCase()+(s.boundaryContext?' · '+s.boundaryContext:'')):'';
    if(atEvent>=0)$('eventSelect').value=String(atEvent);
    $('status').textContent=s.constraintInvalid?(s.outsideAnswer?'Comparison':'Arc stopped'):running?(hold?'Checkpoint':'Playing')+(s.loop?' · loop '+cycle:''):time===question.end?'Complete':time===question.start?'Ready':'Paused';
    $('playBtn').textContent=running?'Pause':time===question.end?'Replay':time===question.start?'Start':'Resume';
    $('playBtn').disabled=s.constraintInvalid;$('progress').disabled=!question.duration;$('progress').value=s.progress*1000;
    $('progressValue').textContent=Math.round(s.progress*100)+'%';$('progressLabel').textContent=mode==='full'?'Full process':'Part '+part+' · '+selected.en;
    $('equationScope').textContent='Part '+part+(s.continuation?' · reference':'');
    $('equations').querySelectorAll('li').forEach(row=>{const active=s.activeSteps.includes(+row.dataset.step);row.classList.toggle('active',active);if(active)row.setAttribute('aria-current','step');else row.removeAttribute('aria-current');});
    $('result').textContent=selected.result;$('target').hidden=!isRobot&&part===3;
    const branch=!isRobot&&part===3 ? s.constraintInvalid?'k > 3: T_required < 0; rope cannot sustain the prescribed arc.'
      :s.critical?'k = 3: zero initial tension · critical state, separate from the strict-taut answer range.'
      :s.branch==='interior'?`θ* = ${f(s.peakTheta*180/Math.PI,1)}° · Eₖ,max/(mgd) = ${f(s.peakK,3)}`
      :`At N · Eₖ,max/(mgd) = ${f(s.peakK,3)}`:'';
    $('branch').textContent=branch;$('branch').classList.toggle('warning',s.constraintInvalid||s.critical);
    $('modelNote').textContent=content.note;
    $('intervalNote').textContent=s.continuation?'Continuation · outside calculation interval':isRobot?(part===3&&mode==='question'?'Stops after first landing':'Upward velocity is positive')
      :part===1?'Quasi-static · playback time is schematic':'Ratios: v/√(gd), T/(mg), Eₖ/(mgd)';
    $('kInput').value=k;$('kOutput').textContent='k = '+f(k);
    $('constraintNote').textContent=s.constraintInvalid?'Constraint fails':s.critical?'Critical T_start = 0':'Answer range: 0 < k < 3';
    $('fullBtn').setAttribute('aria-pressed',String(mode==='full'));$('loopToggle').checked=s.loop;
    $('questions').querySelectorAll('button').forEach(btn=>{const active=+btn.dataset.part===part;btn.setAttribute('aria-pressed',String(active));});
    $('presets').querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',String(+btn.dataset.k===k)));
    $('checkpoints').querySelectorAll('button').forEach(btn=>{const c=question.checkpoints[+btn.dataset.checkpoint];btn.setAttribute('aria-pressed',String(Math.abs(time-c.t)<1e-9&&side===(c.side??(c.t===question.end?question.endSide:'after'))));});
    $('accessibleState').textContent='Part '+part+'. '+selected.goal+'. '+s.phase+'. '+(isRobot?'Shell height '+f(s.y,3)+' m; loss '+f(s.loss)+' J.':'Angle '+f(s.theta*180/Math.PI,1)+' degrees; '+branch);
    $('scene').setAttribute('aria-label',selected.goal+'; '+s.phase);
    return s;
  }
  function start(){if(getState().constraintInvalid)return;if(time>=question.end&&!hold){restart();cycle=1;}running=true;last=null;render();}
  function pause(){running=false;last=null;render();}
  function reset(){running=false;cycle=1;restart();render();}
  function finish(){
    if(getState().constraintInvalid){running=false;hold=null;}
    else if(loopOptions[mode])hold={type:'end',remaining:1.2};
    else running=false;
  }
  function update(dt){
    if(!Number.isFinite(dt))throw Error('Invalid timestep');if(!running)return;dt=Math.max(0,Math.min(.06,dt));
    if(hold){
      hold.remaining=Math.max(0,hold.remaining-dt);
      if(hold.remaining>0){render();return;}
      const ended=hold.type==='end';hold=null;
      if(ended){if(loopOptions[mode]){restart();cycle++;}else running=false;render();return;}
      dt=0;
    }
    const nextTime=Math.min(question.end,time+dt*Number($('rate').value));
    const stop=mode==='full'?question.stops[stopIndex]:null;
    if(stop&&stop.t<=nextTime+1e-12){
      time=stop.t;side=stop.side;stopIndex++;
      if(time===question.end&&side===question.endSide)finish();
      else hold={type:'checkpoint',remaining:.65};
    }else{time=nextTime;side=time===question.end?question.endSide:'after';if(time===question.end)finish();}
    render();
  }
  function setParameters(values){
    if(Object.keys(values).length===0)return;
    const nextK=values.k===undefined?k:Number(values.k),nextPart=values.part===undefined?part:Number(values.part),nextMode=values.mode??(values.part===undefined?mode:'question');
    if(!Number.isFinite(nextK)||nextK<.05||nextK>3.2)throw Error('k outside UI range');
    if(![1,2,3].includes(nextPart)||!['full','question'].includes(nextMode))throw Error('Invalid playback selection');
    if(values.loop!==undefined&&typeof values.loop!=='boolean')throw Error('Invalid loop setting');
    if(Object.keys(values).every(key=>key==='loop')){setLoop(values.loop);return;}
    const resume=mode==='full'&&running&&nextMode==='full'&&values.part===undefined;
    k=nextK;if(values.loop!==undefined)loopOptions[nextMode]=values.loop;
    if(nextMode==='full')fullProcess(resume);else setQuestion(nextPart);
  }
  function init(){
    $('questions').innerHTML=content.parts.map((p,i)=>`<button data-part="${i+1}" aria-pressed="false"><span class="part-no">0${i+1}</span><span><b>${p.zh}</b><small>${p.en}</small></span></button>`).join('');
    $('questions').querySelectorAll('button').forEach(btn=>btn.onclick=()=>setQuestion(+btn.dataset.part));
    $('givens').innerHTML=content.givens;$('playBtn').onclick=()=>running?pause():start();$('resetBtn').addEventListener('click',reset);$('fullBtn').onclick=()=>fullProcess(true);$('loopToggle').onchange=e=>setLoop(e.target.checked);
    $('progress').oninput=e=>seek(question.start+(question.end-question.start)*(+e.target.value/1000));
    $('beforeBtn').onclick=()=>seek(question.events[+$('eventSelect').value].t,'before');
    $('afterBtn').onclick=()=>seek(question.events[+$('eventSelect').value].t,'after');
    $('kInput').oninput=e=>setParameters({k:+e.target.value});$('presets').querySelectorAll('button').forEach(btn=>btn.onclick=()=>setParameters({k:+btn.dataset.k}));
    fullProcess();
    const params=new URLSearchParams(location.search),requestedPart=Number(params.get('part'));
    if([1,2,3].includes(requestedPart))setQuestion(requestedPart);
    if(params.get('preview')==='1'){setQuestion(2);time=question.end;side=question.endSide;render();}
    window.simulation={init,start,pause,reset,update,render,setParameters,getState,getReadouts,seek,runModelChecks:WalkthroughModel.checks};
    requestAnimationFrame(frame);
  }
  function frame(ts){if(last!==null&&running)update((ts-last)/1000);last=ts;requestAnimationFrame(frame);}
  init();
})();
