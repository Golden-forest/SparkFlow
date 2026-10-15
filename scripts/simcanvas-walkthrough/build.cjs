const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
const kernel=fs.readFileSync(path.join(__dirname,'../simcanvas-exam/model.cjs'),'utf8').split("if(typeof module")[0];
const adapter=read('model.cjs').split("if(typeof module")[0],template=read('template.html');
const entries=[
  {id:'jumping-robot-exam-steps',kind:'robot',zh:'跳跃机器人 · 逐问推演',en:'Jumping Robot · Question Walkthrough',number:14},
  {id:'charged-bead-exam-steps',kind:'bead',zh:'带电小球 · 逐问推演',en:'Charged Bead · Question Walkthrough',number:15}
];
for(const c of entries){
  const dest=path.join(root,'public/simcanvas',c.id);fs.mkdirSync(dest,{recursive:true});
  const replacements={ZH:c.zh,EN:c.en,NUMBER:c.number,KIND:JSON.stringify(c.kind),KERNEL:kernel,MODEL:adapter,CONTENT:read('content.js'),VIEW:read('view.js')};
  let html=template;for(const[key,value]of Object.entries(replacements))html=html.replaceAll('__'+key+'__',()=>String(value));
  fs.writeFileSync(path.join(dest,'index.html'),html);
  fs.writeFileSync(path.join(dest,'meta.json'),JSON.stringify({title:c.zh+' / '+c.en,category:'physics',version:2,exam:'Guangdong 2026',question:c.number,presentation:'question-walkthrough'},null,2)+'\n');
}
console.log('Built two new walkthrough entries; no old animation files written');
