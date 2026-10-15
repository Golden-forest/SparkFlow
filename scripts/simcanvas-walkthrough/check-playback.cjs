const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{chromium}=require('playwright');
const root=process.env.SIMCANVAS_ASSET_ROOT||path.resolve(__dirname,'../../public'),out='/private/tmp/simcanvas-playback-check';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const[slug,robot]of [['jumping-robot-exam-steps',true],['charged-bead-exam-steps',false]]){
  await page.goto('file://'+path.join(root,'simcanvas',slug,'index.html'));await page.waitForFunction(()=>!!window.simulation);
  let s=await page.evaluate(()=>simulation.getState());assert.equal(s.mode,'full');assert.equal(s.loop,true);assert.equal(s.running,false);assert(await page.locator('#loopToggle').isChecked());
  await page.locator('#playBtn').click();assert((await page.evaluate(()=>simulation.getState())).running);
  await page.locator('#playBtn').click();await page.locator('#fullBtn').click();s=await page.evaluate(()=>simulation.getState());assert(s.running&&s.loop&&s.mode==='full');
  const observed=await page.evaluate(()=>{
   simulation.reset();simulation.start();document.querySelector('#rate').value='1';
   const frames=[],seen=new Set();
   for(let i=0;i<10000;i++){
    simulation.update(.06);const s=simulation.getState(),key=s.part+'|'+s.t+'|'+s.side;
    if(s.holding&&!seen.has(key)){seen.add(key);frames.push({part:s.part,t:s.t,side:s.side,phase:s.phase,v:s.v,bobV:s.bobV,loss:s.loss,charge:s.charge,voltage:s.voltage,continuation:s.continuation,active:s.activeSteps,heading:document.querySelector('#questionLabel').textContent,scope:document.querySelector('#equationScope').textContent,domSteps:[...document.querySelectorAll('.equation.active')].map(e=>+e.dataset.step)});}
    if(s.cycle===2){simulation.pause();return {frames,s:simulation.getState()};}
   }throw Error('Loop never restarted');
  });
  assert.deepEqual([...new Set(observed.frames.map(f=>f.part))].sort(),[1,2,3]);assert(observed.frames.some(f=>f.continuation));assert.equal(observed.s.t,0);assert.equal(observed.s.cycle,2);assert.equal(observed.s.running,false);
  for(const frame of observed.frames){assert.deepEqual(frame.active,frame.domSteps);assert(frame.scope.includes('Part '+frame.part));if(frame.continuation)assert.equal(frame.active.length,0);}
  if(robot){const impact=observed.frames.find(f=>f.phase==='Bumpers · before impact');assert(Math.abs(impact.bobV-2*Math.SQRT2)<1e-6);assert(observed.frames.some(f=>Math.abs(f.loss-6)<1e-6));}
  else{const M=observed.frames.find(f=>f.phase==='M · immediately before contact');assert.equal(M.charge,-1);assert(Math.abs(M.v**2-2*9.8*.6/Math.sqrt(3))<1e-6);assert(observed.frames.some(f=>f.phase==='M release · changed voltage'&&f.charge===1&&f.v===0));}
  await page.evaluate(()=>{simulation.setParameters({mode:'full',loop:true});document.querySelector('#rate').value='1';simulation.start();for(let i=0;i<10000;i++){simulation.update(.06);const s=simulation.getState();if(s.holding&&s.t===s.end&&s.side==='after'){simulation.pause();return}}throw Error('No end hold')});
  const frozen=await page.evaluate(()=>({s:simulation.getState(),svg:document.querySelector('#scene').innerHTML,board:document.querySelector('#board').innerHTML}));await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>({s:simulation.getState(),svg:document.querySelector('#scene').innerHTML,board:document.querySelector('#board').innerHTML})),frozen);
  const resumed=await page.evaluate(()=>{simulation.start();const first=simulation.getState();for(let i=0;i<80&&simulation.getState().cycle===first.cycle;i++)simulation.update(.06);simulation.pause();return{first,last:simulation.getState()}});assert.equal(resumed.first.t,frozen.s.end);assert.equal(resumed.last.cycle,frozen.s.cycle+1);assert.equal(resumed.last.t,0);
  await page.evaluate(()=>{simulation.setParameters({mode:'full',loop:true});document.querySelector('#rate').value='1';simulation.start();for(let i=0;i<10000;i++){simulation.update(.06);const s=simulation.getState();if(s.holding&&s.t===s.end&&s.side==='after'){simulation.pause();return}}throw Error('No loop end hold')});await page.locator('#loopToggle').uncheck();s=await page.evaluate(()=>simulation.getState());assert.equal(s.t,s.end);assert.equal(s.holding,false);assert.equal(s.running,false);assert.equal(s.loop,false);
  await page.evaluate(()=>{simulation.setParameters({mode:'full',loop:false});document.querySelector('#rate').value='1';simulation.start();for(let i=0;i<10000&&simulation.getState().running;i++)simulation.update(.06)});s=await page.evaluate(()=>simulation.getState());assert.equal(s.t,s.end);assert.equal(s.side,'after');assert.equal(s.cycle,1);assert.equal(s.running,false);assert.equal(s.holding,false);
  await page.locator('[data-part="2"]').click();s=await page.evaluate(()=>simulation.getState());assert.equal(s.mode,'question');assert.equal(s.part,2);assert.equal(s.loop,false);assert.equal(s.t,s.start);
  await page.locator('#loopToggle').check();const individual=await page.evaluate(()=>{document.querySelector('#rate').value='1';simulation.start();for(let i=0;i<10000;i++){simulation.update(.06);if(simulation.getState().cycle===2){simulation.pause();return simulation.getState()}}throw Error('Question loop failed')});assert.equal(individual.part,2);assert.equal(individual.t,individual.start);assert.equal(individual.mode,'question');
  await page.evaluate(()=>{simulation.setParameters({mode:'full',loop:true});simulation.start();document.querySelector('#rate').value='1';for(let i=0;i<20;i++)simulation.update(.06)});await page.locator('#progress').fill('500');await page.locator('#progress').dispatchEvent('input');s=await page.evaluate(()=>simulation.getState());assert.equal(s.running,false);assert.equal(s.holding,false);assert(Math.abs(s.progress-.5)<1e-9);await page.locator('#resetBtn').click();s=await page.evaluate(()=>simulation.getState());assert.equal(s.t,0);assert.equal(s.cycle,1);assert.equal(s.mode,'full');
  if(!robot){
   await page.evaluate(()=>{simulation.start();simulation.setParameters({k:.5})});s=await page.evaluate(()=>simulation.getState());assert.equal(s.mode,'full');assert.equal(s.running,true);assert.equal(s.t,0);assert.equal(s.k,.5);
   await page.evaluate(()=>{simulation.setParameters({mode:'full',k:3.2,loop:true});document.querySelector('#rate').value='1';simulation.start();for(let i=0;i<10000&&simulation.getState().running;i++)simulation.update(.06)});s=await page.evaluate(()=>simulation.getState());assert(s.constraintInvalid);assert.equal(s.t,s.end);assert.equal(s.cycle,1);assert.equal(s.running,false);assert(await page.locator('#playBtn').isDisabled());assert.equal(await page.locator('#maximumMarker').count(),0);
  }
  await page.evaluate(()=>simulation.setParameters({mode:'full',k:1,loop:true}));await page.evaluate(()=>{const s=simulation.getState();simulation.seek(s.events[0].t,'before')});await page.screenshot({path:path.join(out,slug+'-full-desktop.png')});
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.locator('#fullBtn').click();await page.locator('#playBtn').click();assert.equal(await page.evaluate(()=>simulation.getState().mode),'full');assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
   const boxes=await page.evaluate(()=>{const ids=['stage','scene','fullBtn','loopToggle','playBtn'];return Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{w:r.width,h:r.height,bottom:r.bottom}]}))});assert(boxes.stage.h>=380&&boxes.scene.h>220);assert(boxes.fullBtn.w>70&&boxes.playBtn.w>60&&boxes.loopToggle.w>0);if(viewport.width===1440)assert(boxes.playBtn.bottom<=900);
   await page.screenshot({path:path.join(out,slug+'-'+viewport.width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});console.log('PASS',slug,'default full mode, one-click playback, automatic question/equation mapping, exact contact holds, full/question loops, end-hold pause/resume, single pass, reset/seek, 3 viewports');
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS no page errors; screenshots:',out);
})().catch(e=>{console.error(e);process.exit(1)});
