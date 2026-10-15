const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const baseline=process.env.SIMCANVAS_BASELINE_ROOT||'/private/tmp/sparkflow-ball-spring-release',release=process.env.SIMCANVAS_RELEASE_ROOT||'/private/tmp/sparkflow-walkthrough-release',workspace=path.resolve(__dirname,'../..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
let checked=0;
for(const original of files(path.join(baseline,'public/simcanvas'))){const relative=path.relative(path.join(baseline,'public'),original);for(const target of ['public','dist'])assert.equal(hash(path.join(release,target,relative)),hash(original),target+' changed original '+relative);checked++;}
assert.equal(hash(path.join(release,'functions/_middleware.ts')),hash(path.join(baseline,'functions/_middleware.ts')),'Existing access middleware changed');
for(const slug of ['jumping-robot-exam-steps','charged-bead-exam-steps'])for(const file of ['index.html','meta.json'])assert.equal(hash(path.join(release,'dist/simcanvas',slug,file)),hash(path.join(workspace,'public/simcanvas',slug,file)),'New release differs from verified source');
const previous=JSON.parse(fs.readFileSync(path.join(baseline,'dist/resource-manifest.json'))),next=JSON.parse(fs.readFileSync(path.join(release,'dist/resource-manifest.json')));
assert.equal(next.simcanvas.length,previous.simcanvas.length+2);for(const old of previous.simcanvas)assert.deepEqual(next.simcanvas.find(item=>item.id===old.id),old,'Old gallery entry changed: '+old.id);
assert.deepEqual(next.courseware,previous.courseware);assert.deepEqual(next.images,previous.images);
console.log('PASS release preservation:',checked,'original asset files and original gallery entries unchanged; two new verified HTML entries; original middleware retained');
