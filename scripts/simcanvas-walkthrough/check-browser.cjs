const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=process.env.SIMCANVAS_ASSET_ROOT||path.resolve(__dirname,'../../public'),out='/private/tmp/simcanvas-walkthrough-check';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [slug,robot]of [['jumping-robot-exam-steps',true],['charged-bead-exam-steps',false]]){
    await page.goto('file://'+path.join(root,'simcanvas',slug,'index.html'));await page.waitForFunction(()=>!!window.simulation);
    assert((await page.evaluate(()=>simulation.runModelChecks())).every(c=>c.pass));
    assert.equal(await page.locator('#questions button').count(),3);
    assert.equal(await page.locator('#plot, #energyLedger, [data-region="insight"], #quantitySelect').count(),0);
    assert.equal(await page.locator('#phase').innerText(),robot?'Swing':'Quasi-static ramp');
    for(const part of [1,2,3]){
      await page.locator(`[data-part="${part}"]`).click();const initial=await page.evaluate(()=>simulation.getState());
      assert.equal(initial.part,part);assert.equal(initial.t,initial.start);assert.equal(initial.running,false);
      assert.equal(await page.locator(`[data-part="${part}"]`).getAttribute('aria-pressed'),'true');
      assert((await page.locator('#questionLabel').innerText()).includes('Part '+part));
      assert.equal(await page.locator('#equations li').count(),(robot?[4,3,4]:[3,4,5])[part-1]);
      for(const row of await page.locator('#equations li').all())assert(await row.isVisible());
      assert.equal(await page.locator('#kControl').isVisible(),!robot&&part===3);
      await page.evaluate(()=>{const s=simulation.getState();simulation.seek(s.end)});const terminal=await page.evaluate(()=>simulation.getState());
      if(robot){assert.equal(terminal.side,'after');assert(Math.abs((part===1?terminal.body.system.K:part===2?terminal.y:terminal.loss)-[4,.1,6][part-1])<1e-6);if(part===3){assert.equal(terminal.vy,0);assert(Math.abs(terminal.bobV+Math.SQRT2)<1e-6);assert.equal(await page.locator('#loss1Label').textContent(),'4.00 J');assert.equal(await page.locator('#loss2Label').textContent(),'2.00 J');}}
      else{assert.equal(terminal.side,'before');if(part===1){assert.equal(terminal.charge,1);assert.equal(await page.locator('#voltageLabel').textContent(),'U/U₀ = 1.00');}if(part===2){assert(Math.abs(terminal.tension-2*Math.sqrt(6)/3)<1e-6);assert.equal(await page.locator('#tensionLabel').textContent(),'T/(mg) = 1.633');}}
      await page.screenshot({path:path.join(out,slug+'-part'+part+'.png')});
      await page.locator('#resetBtn').click();assert.equal(await page.evaluate(()=>simulation.getState().t),initial.start);
      await page.locator('#playBtn').click();await page.waitForTimeout(130);await page.locator('#playBtn').click();
      const snapshot=await page.evaluate(()=>({s:simulation.getState(),scene:document.querySelector('#scene').innerHTML,board:document.querySelector('#board').innerHTML}));
      await page.waitForTimeout(90);assert.deepEqual(await page.evaluate(()=>({s:simulation.getState(),scene:document.querySelector('#scene').innerHTML,board:document.querySelector('#board').innerHTML})),snapshot);
      await page.locator('#playBtn').click();await page.waitForTimeout(90);await page.locator('#playBtn').click();assert((await page.evaluate(()=>simulation.getState().t))>snapshot.s.t);
      await page.evaluate(()=>{simulation.reset();simulation.start();for(let i=0;i<8000&&simulation.getState().running;i++)simulation.update(.06)});
      const finished=await page.evaluate(()=>simulation.getState());assert.equal(finished.t,finished.end);assert.equal(finished.running,false);assert.equal(finished.side,robot?'after':'before');
      console.log('PASS',slug,'Part',part,'coverage, endpoint, equation chain, lifecycle');
    }
    if(robot){
      await page.locator('[data-part="3"]').click();
      for(const event of [0,1]){await page.locator('#eventSelect').selectOption(String(event));await page.locator('#beforeBtn').click();const pre=await page.evaluate(()=>simulation.getState());await page.locator('#afterBtn').click();const post=await page.evaluate(()=>simulation.getState());assert.equal(pre.t,post.t);assert(Math.abs(post.loss-pre.loss-[4,2][event])<1e-6);}
    }else{
      await page.locator('[data-part="2"]').click();
      for(const ratio of [.15,.4,.7,.9]){
        await page.evaluate(r=>{const s=simulation.getState();simulation.seek(s.start+s.duration*r)},ratio);
        const a=await page.evaluate(()=>{const s=simulation.getState(),vector=id=>{const el=document.getElementById(id);return el?{x:+el.getAttribute('x2')-+el.getAttribute('x1'),y:+el.getAttribute('y2')-+el.getAttribute('y1')}:null};return {s,v:vector('velocityArrow'),f:vector('electricArrow'),rope:vector('ropeArrow')}});
        assert(Math.abs(a.v.x-74*a.s.velocity.x)<1e-8);assert(Math.abs(a.v.y+74*a.s.velocity.y)<1e-8);assert(Math.abs(a.f.x-65*a.s.electric.x)<1e-8);assert(Math.abs(a.rope.x-65*a.s.rope.x)<1e-8);assert(Math.abs(a.rope.y+65*a.s.rope.y)<1e-8);
      }
      await page.locator('[data-part="3"]').click();
      for(const k of [.05,.5,1,2,2.99,3,3.2]){
        await page.evaluate(k=>simulation.setParameters({k}),k);const s=await page.evaluate(()=>simulation.getState());assert.equal(s.k,k);assert.equal(s.t,s.start);assert.equal(s.charge,1);assert.equal(s.v,0);
        if(k>3){assert(s.invalid);assert(await page.locator('#playBtn').isDisabled());assert.equal(await page.locator('#maximumMarker').count(),0);assert((await page.locator('#branch').innerText()).includes('T_required < 0'));}
        else{await page.locator('[data-checkpoint="1"]').click();const peak=await page.evaluate(()=>simulation.getState());const expected=k<=1?Math.sqrt(1+k*k/3)-Math.sqrt(3)/2+k/(2*Math.sqrt(3)):k/Math.sqrt(3);assert(Math.abs(peak.kinetic-expected)<1e-6);assert.equal(await page.locator('#kineticLabel').textContent(),'Eₖ/(mgd) = '+expected.toFixed(3));assert(await page.locator(`[data-step="${k<=1?3:k<3?4:1}"]`).evaluate(el=>el.classList.contains('active')));}
      }
      await page.evaluate(()=>simulation.setParameters({k:.5,part:3}));await page.locator('[data-checkpoint="1"]').click();await page.screenshot({path:path.join(out,slug+'-interior-peak.png')});
      await page.evaluate(()=>simulation.setParameters({k:1,part:2}));await page.locator('#eventSelect').selectOption('1');await page.locator('#beforeBtn').click();const before=await page.evaluate(()=>simulation.getState());await page.locator('#afterBtn').click();const after=await page.evaluate(()=>simulation.getState());assert.equal(before.t,after.t);assert(before.v!==0);assert.equal(after.v,0);assert(after.outsideAnswer);assert((await page.locator('#eventSide').innerText()).includes('after answer instant'));
      for(const part of [2,3]){await page.evaluate(part=>simulation.setParameters({part,k:.5}),part);await page.locator('#eventSelect').selectOption('0');await page.locator('#beforeBtn').click();const previous=await page.evaluate(()=>simulation.getState());assert(previous.outsideAnswer);assert.equal(previous.charge,part===2?1:-1);assert((await page.locator('#eventSide').innerText()).includes('before this question interval'));assert.equal(await page.locator('.equation.active').count(),0);assert((await page.locator('#phase').innerText()).includes('before'));await page.locator('#afterBtn').click();const current=await page.evaluate(()=>simulation.getState());assert.equal(current.t,previous.t);assert.equal(current.charge,part===2?-1:1);assert.equal(current.v,0);assert(!current.outsideAnswer);}
      await page.evaluate(()=>simulation.setParameters({part:3,k:3.2}));await page.locator('#beforeBtn').click();assert(await page.locator('#playBtn').isDisabled());assert.equal(await page.locator('#maximumMarker').count(),0);assert((await page.locator('#branch').innerText()).includes('T_required < 0'));await page.evaluate(()=>simulation.start());assert.equal(await page.evaluate(()=>simulation.getState().running),false);
      await page.evaluate(()=>simulation.setParameters({part:1}));await page.locator('#afterBtn').click();assert((await page.locator('#annotations').textContent()).includes('Contact · charge reverses'));assert.equal(await page.locator('.equation.active').count(),0);
    }
    for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);
      for(const part of [1,2,3]){
        await page.evaluate(part=>simulation.setParameters({part,k:1}),part);await page.evaluate(()=>{const s=simulation.getState();simulation.seek(s.end)});
        const boxes=await page.evaluate(()=>{const b=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};return{overflow:document.documentElement.scrollWidth>innerWidth,stage:b('stage'),svg:b('scene'),board:b('board'),controls:b('controls'),height:innerHeight}});
        assert(!boxes.overflow,slug+' horizontal overflow '+JSON.stringify(viewport));assert(boxes.stage.h>=380&&boxes.svg.h>220);
        if(viewport.width===1440){assert(boxes.board.x>=boxes.stage.x+boxes.stage.w);assert(boxes.stage.w>boxes.board.w*1.6);assert(boxes.controls.bottom<=boxes.height+1);}
        const contained=await page.evaluate(robot=>{const scene=document.querySelector('#scene').getBoundingClientRect();return (robot?['bobA','bobB','shell']:['bead']).every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.x>=scene.x-1&&r.right<=scene.right+1&&r.y>=scene.y-1&&r.bottom<=scene.bottom+1})},robot);assert(contained,slug+' clipped primary body');
      }
      await page.screenshot({path:path.join(out,slug+'-'+viewport.width+'.png'),fullPage:true});
      await page.locator('#resetBtn').click();await page.locator('#progress').fill('500');await page.locator('#progress').dispatchEvent('input');assert((await page.evaluate(()=>simulation.getState().progress))>.49);
    }
    await page.setViewportSize({width:1440,height:900});
  }
  assert.deepEqual(errors,[]);await browser.close();console.log('PASS six parts, parameter branches, forces, pause, event sides, 3 viewports; no page errors. Screenshots:',out);
})().catch(e=>{console.error(e);process.exit(1)});
