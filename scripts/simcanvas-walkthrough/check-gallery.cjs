const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{chromium}=require('playwright');
const release=process.env.SIMCANVAS_RELEASE_ROOT||'/private/tmp/sparkflow-walkthrough-release',root=path.join(release,'dist'),out='/private/tmp/simcanvas-walkthrough-check';
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+'/')&&file!==root){res.writeHead(403);return res.end();}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(18744,'127.0.0.1',r));const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:18744');await page.getByRole('button',{name:'SimCanvas',exact:true}).click();
 const counts={'全部 · All':41,'力学 · Mechanics':15,'电磁 · Electromagnetism':4,'波与光 · Waves & Optics':5,'数学 · Mathematics':9,'视觉艺术 · Visual Arts':8,'高考真题 · Exam Problems':4},seen=new Set();
 for(const[label,count]of Object.entries(counts)){
  const button=page.getByRole('button',{name:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('article').count(),count);
  if(!label.startsWith('全部')&&!label.startsWith('高考'))(await page.locator('article').allTextContents()).forEach(t=>seen.add(t.trim()));
 }
 assert.equal(seen.size,41);assert.equal(await page.locator('article').filter({hasText:'逐问推演'}).count(),2);
 assert.equal(await page.locator('article').filter({hasText:'双板间带电小球'}).count(),1);assert.equal(await page.locator('article').filter({hasText:'双摆锤跳跃机器人'}).count(),1);
 await page.screenshot({path:path.join(out,'gallery-exam.png')});
 for(const[slug,zh,en]of [['jumping-robot-exam-steps','跳跃机器人 · 逐问推演','Jumping Robot'],['charged-bead-exam-steps','带电小球 · 逐问推演','Charged Bead']]){
  const card=page.locator('article').filter({hasText:zh});assert.equal(await card.count(),1);assert((await card.innerText()).includes(en));await card.scrollIntoViewIfNeeded();await card.locator('iframe').waitFor();
  const element=await card.locator('iframe').elementHandle(),preview=await element.contentFrame();await preview.waitForFunction(()=>!!window.simulation);const pinned=await preview.evaluate(()=>simulation.getState());assert.equal(pinned.part,2);assert.equal(pinned.running,false);assert.equal(pinned.t,pinned.end);
  await card.click();const frame=page.frameLocator('[role="dialog"] iframe');await frame.getByRole('heading',{name:zh,exact:true}).waitFor();
  const defaults=await frame.locator('body').evaluate(()=>simulation.getState());assert.equal(defaults.mode,'full');assert.equal(defaults.loop,true);assert.equal(defaults.running,false);
  for(const part of [1,2,3]){await frame.locator(`[data-part="${part}"]`).click();let s=await frame.locator('body').evaluate(()=>simulation.getState());assert.equal(s.part,part);assert.equal(s.t,s.start);await frame.locator('#progress').fill('1000');await frame.locator('#progress').dispatchEvent('input');s=await frame.locator('body').evaluate(()=>simulation.getState());assert.equal(s.t,s.end);assert.equal(s.side,slug.startsWith('jumping')?'after':'before');}
  await frame.locator('#fullBtn').click();const playing=await frame.locator('body').evaluate(()=>simulation.getState());assert.equal(playing.mode,'full');assert.equal(playing.loop,true);assert.equal(playing.running,true);await frame.locator('#playBtn').click();
  await page.locator('[role="dialog"] button').click();assert.equal(await page.locator('[role="dialog"]').count(),0);console.log('PASS release gallery opens all three parts and returns to full looping playback:',slug);
 }
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(viewport);assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));await page.screenshot({path:path.join(out,'gallery-'+viewport.width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);await browser.close();await new Promise(r=>server.close(r));console.log('PASS release gallery: 41 entries, 7 category filters, 4 exam entries, both original exam entries retained, bilingual titles, previews and dialogs; no page errors');
})().catch(e=>{console.error(e);process.exit(1)});
