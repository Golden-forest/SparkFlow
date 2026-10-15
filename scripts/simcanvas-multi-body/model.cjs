/* Textbook SI contract: x right, y up, g=9.8. Two point masses, fixed
   massless guides/pivots, inextensible cord or massless rigid rod.
   q is rope travel (m), vertical gap (m), or clockwise rotation (rad).
   M(q) qddot + M'(q) qdot²/2 + U'(q) = generalized friction force.
   All constraints are imposed by geometry; no collision or slack phase.
   From rest, stop at prescribed pre-contact travel/angle boundary.
   Only cart supports friction (mu_s=mu_k=0.25, positive first descent).
   Finite guide pictures are schematic; cord-slide uses an ideal point guide.
   RK4 physical step 1ms, bisection locates final travel boundary.
   Every observable/arrow/readout derives from one q,u,t model result.
*/
const G=9.8,STEP=.001;
const CASES=[
 {id:'energy-cart-hanger',zh:'台面与悬挂物',en:'Cart & Hanger',kind:'cart',group:'Equal speed',mA:2,mB:1,q0:0,end:1.0,scale:158,ox:130,ground:540},
 {id:'energy-atwood',zh:'双悬挂物',en:'Two Hanging Masses',kind:'atwood',group:'Equal speed',mA:1,mB:2,q0:0,end:1.2,scale:128,ox:230,ground:555},
 {id:'energy-incline-hanger',zh:'斜面与悬挂物',en:'Incline & Hanger',kind:'incline',group:'Equal speed',mA:1,mB:2,q0:0,end:.85,angle:Math.PI/6,scale:165,ox:110,ground:540},
 {id:'energy-cylinder-guide',zh:'圆柱导绳',en:'Cylindrical Cord Guide',kind:'cylinder',group:'Equal speed',mA:2,mB:1,q0:0,end:.95,scale:162,ox:125,ground:540},
 {id:'energy-central-rod',zh:'中间支点直杆',en:'Center-Pivot Rod',kind:'central',group:'Equal angular velocity',mA:1,mB:2,q0:0,end:1.15,rA:.9,rB:.9,scale:172,ox:450,ground:600},
 {id:'energy-offset-rod',zh:'同侧不同半径直杆',en:'Two Radii, One Rod',kind:'offset',group:'Equal angular velocity',mA:1,mB:1,q0:0,end:1.1,rA:.9,rB:1.8,scale:140,ox:290,ground:560},
 {id:'energy-right-angle-rod',zh:'直角杆',en:'Right-Angle Rod',kind:'elbow',group:'Equal angular velocity',mA:1,mB:1,q0:0,end:1.35,rA:1.6,rB:.8,scale:137,ox:360,ground:560},
 {id:'energy-cord-sliders',zh:'斜绳与竖直滑块',en:'Slanted Cord & Slider',kind:'cord',group:'Equal projected speed',mA:2,mB:1,q0:1,end:2.6,D:2,H:3.3,b0:2.2,scale:145,ox:260,ground:555},
 {id:'energy-rod-sliders',zh:'杆连水平与竖直滑块',en:'Linked Perpendicular Sliders',kind:'sliders',group:'Equal projected speed',mA:1.5,mB:1,q0:.45,end:1.32,L:2.4,scale:165,ox:240,ground:535}
];
function geometry(c,q){let A,B,dA,dB,ddA=[0,0],ddB=[0,0];const k=c.kind,S=Math.sin(q),C=Math.cos(q);
 if(k==='cart'){A=[.4+q,2];B=[3.25,1.6-q];dA=[1,0];dB=[0,-1];}
 if(k==='atwood'){A=[1.5,1.3+q];B=[2.1,2.7-q];dA=[0,1];dB=[0,-1];}
 if(k==='incline'){A=[.7+q*Math.cos(c.angle),.6+q*Math.sin(c.angle)];B=[3.38,1.6-q];dA=[Math.cos(c.angle),Math.sin(c.angle)];dB=[0,-1];}
 if(k==='cylinder'){A=[.5+q,1.73];B=[3.15,1.5-q];dA=[1,0];dB=[0,-1];}
 if(k==='central'){A=[-c.rA*C,2.3+c.rA*S];B=[c.rB*C,2.3-c.rB*S];dA=[c.rA*S,c.rA*C];dB=[-c.rB*S,-c.rB*C];ddA=[c.rA*C,-c.rA*S];ddB=[-c.rB*C,c.rB*S];}
 if(k==='offset'){A=[c.rA*C,3.5-c.rA*S];B=[c.rB*C,3.5-c.rB*S];dA=[-c.rA*S,-c.rA*C];dB=[-c.rB*S,-c.rB*C];ddA=[-c.rA*C,c.rA*S];ddB=[-c.rB*C,c.rB*S];}
 if(k==='elbow'){A=[c.rA*C,3.2-c.rA*S];B=[-c.rB*S,3.2-c.rB*C];dA=[-c.rA*S,-c.rA*C];dB=[-c.rB*C,c.rB*S];ddA=[-c.rA*C,c.rA*S];ddB=[c.rB*S,c.rB*C];}
 if(k==='cord'){const l=Math.hypot(c.D,q),l0=Math.hypot(c.D,c.q0);A=[0,c.H-q];B=[c.D,c.H-c.b0-l0+l];dA=[0,-1];dB=[0,q/l];ddB=[0,c.D*c.D/l**3];}
 if(k==='sliders'){A=[0,c.L*C];B=[c.L*S,0];dA=[0,-c.L*S];dB=[c.L*C,0];ddA=[0,-c.L*C];ddB=[-c.L*S,0];}
 return {A,B,dA,dB,ddA,ddB};
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function dynamics(c,q,u,rough=false){const z=geometry(c,q),M=c.mA*dot(z.dA,z.dA)+c.mB*dot(z.dB,z.dB),Mp=2*(c.mA*dot(z.dA,z.ddA)+c.mB*dot(z.dB,z.ddB)),Up=G*(c.mA*z.dA[1]+c.mB*z.dB[1]);const f=rough&&c.kind==='cart'?.25*c.mA*G:0;let drive=-Up-.5*Mp*u*u;if(f){if(Math.abs(u)<1e-12&&Math.abs(drive)<=f)drive=0;else drive-=f*Math.sign(u||drive);}return {du:drive/M,M,Mp,Up,f,z};}
function step(c,s,dt,rough=false){const f=(q,u)=>[u,dynamics(c,q,u,rough).du],k1=f(s.q,s.u),k2=f(s.q+dt*k1[0]/2,s.u+dt*k1[1]/2),k3=f(s.q+dt*k2[0]/2,s.u+dt*k2[1]/2),k4=f(s.q+dt*k3[0],s.u+dt*k3[1]);return {q:s.q+dt*(k1[0]+2*k2[0]+2*k3[0]+k4[0])/6,u:s.u+dt*(k1[1]+2*k2[1]+2*k3[1]+k4[1])/6,t:s.t+dt};}
function observables(c,s,rough=false){const d=dynamics(c,s.q,s.u,rough),z=d.z,z0=geometry(c,c.q0),vA=z.dA.map(a=>a*s.u),vB=z.dB.map(a=>a*s.u),aA=z.dA.map((a,i)=>a*d.du+z.ddA[i]*s.u*s.u),aB=z.dB.map((a,i)=>a*d.du+z.ddB[i]*s.u*s.u),KA=.5*c.mA*dot(vA,vA),KB=.5*c.mB*dot(vB,vB),dyA=z.A[1]-z0.A[1],dyB=z.B[1]-z0.B[1],PA=c.mA*G*dyA,PB=c.mB*G*dyB,EA=KA+PA,EB=KB+PB,heat=d.f*Math.abs(s.q-c.q0);let relation,projA=null,projB=null,omega=null;
 if(['cart','atwood','incline','cylinder'].includes(c.kind))relation='|vA| = |vB|';
 if(['central','offset','elbow'].includes(c.kind)){omega=s.u;relation='vA / rA = vB / rB = ω';}
 if(c.kind==='cord'){const l=Math.hypot(c.D,s.q),n=[c.D/l,s.q/l];projA=n.map(a=>a*dot(vA,n));projB=[0,vB[1]];relation='vA cos α = vB';}
 if(c.kind==='sliders'){const n=[Math.sin(s.q),-Math.cos(s.q)];projA=n.map(a=>a*dot(vA,n));projB=n.map(a=>a*dot(vB,n));relation='vA cos θ = vB sin θ';}
 const tension=c.kind==='cord'?c.mB*(G+aB[1]):['cart','atwood','incline','cylinder'].includes(c.kind)?c.mB*(G+aB[1]):null;
 return {...s,A:z.A,B:z.B,vA,vB,aA,aB,speedA:Math.hypot(...vA),speedB:Math.hypot(...vB),dyA,dyB,KA,KB,PA,PB,EA,EB,K:KA+KB,P:PA+PB,E:EA+EB,heat,omega,projA,projB,relation,tension,rough};}
function trajectory(c,rough=false,dt=STEP){const states=[{q:c.q0,u:0,t:0}];for(let i=0;i<20000;i++){const prev=states[states.length-1],next=step(c,prev,dt,rough);if(next.q>=c.end){let lo=0,hi=dt;for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(step(c,prev,mid,rough).q<c.end)lo=mid;else hi=mid;}const end=step(c,prev,(lo+hi)/2,rough);end.q=c.end;states.push(end);return {c,rough,dt,states,duration:end.t};}states.push(next);}throw Error('Trajectory failed to reach its safe boundary');}
function sample(tr,t){t=Math.max(0,Math.min(tr.duration,t));if(t===tr.duration)return observables(tr.c,tr.states.at(-1),tr.rough);const i=Math.min(Math.floor(t/tr.dt),tr.states.length-2),s=tr.states[i];return observables(tr.c,step(tr.c,s,t-s.t,tr.rough),tr.rough);}
function runModelChecks(){const checks=[];const check=(name,actual,expected,tolerance=1e-6)=>checks.push({name,actual,expected,tolerance,pass:Math.abs(actual-expected)<=tolerance});for(const c of CASES){const tr=trajectory(c),initial=sample(tr,0),half=sample(tr,tr.duration/2),end=sample(tr,tr.duration);check(c.id+' initial rest',initial.K,0,1e-12);let energy=0,constraint=0,minT=Infinity;for(let i=0;i<=100;i++){const s=sample(tr,tr.duration*i/100);energy=Math.max(energy,Math.abs(s.E+s.heat));if(s.tension!==null)minT=Math.min(minT,s.tension);if(c.group==='Equal speed')constraint=Math.max(constraint,Math.abs(s.speedA-s.speedB));if(c.group==='Equal angular velocity')constraint=Math.max(constraint,Math.abs(s.speedA/c.rA-s.speedB/c.rB));if(c.kind==='cord')constraint=Math.max(constraint,Math.abs(s.speedA*s.q/Math.hypot(c.D,s.q)-s.speedB));if(c.kind==='sliders'){constraint=Math.max(constraint,Math.abs(s.speedA*Math.cos(s.q)-s.speedB*Math.sin(s.q)));check(c.id+' rigid length '+i,Math.hypot(s.B[0]-s.A[0],s.B[1]-s.A[1]),c.L,1e-10);}}
 check(c.id+' energy invariant',energy,0);check(c.id+' speed constraint',constraint,0,1e-9);check(c.id+' endpoint',end.q,c.end,1e-10);if(minT!==Infinity)checks.push({name:c.id+' cord remains taut',actual:minT,expected:'>= 0',pass:minT>=-1e-8});
 if(c.group==='Equal speed'){let acc=c.kind==='atwood'?G*(c.mB-c.mA)/(c.mA+c.mB):G*(c.mB-(c.kind==='incline'?c.mA*Math.sin(c.angle):0))/(c.mA+c.mB);check(c.id+' constant acceleration analytic position',half.q,c.q0+.5*acc*half.t**2,1e-8);check(c.id+' constant acceleration analytic velocity',half.u,acc*half.t,1e-8);}
 const fine=trajectory(c,false,STEP/2);const s2=sample(fine,tr.duration*.7),s1=sample(tr,tr.duration*.7);check(c.id+' step-halving position',s1.q,s2.q,1e-7);check(c.id+' step-halving velocity',s1.u,s2.u,1e-7);
 if(c.group==='Equal angular velocity'){const z=geometry(c,end.q),z0=geometry(c,c.q0),I=c.mA*c.rA**2+c.mB*c.rB**2,drop=-G*(c.mA*(z.A[1]-z0.A[1])+c.mB*(z.B[1]-z0.B[1]));check(c.id+' angular speed energy oracle',end.u,Math.sqrt(2*drop/I),1e-7);}}
 const cart=CASES[0],rough=trajectory(cart,true);const r=sample(rough,rough.duration);check('Friction: mechanical energy loss',r.E,-.25*cart.mA*G*(cart.end-cart.q0));check('Friction: energy including thermal',r.E+r.heat,0);check('Friction: slows descent',sample(rough,rough.duration/2).u**2,2*G*(cart.mB-.25*cart.mA)/(cart.mA+cart.mB)*(sample(rough,rough.duration/2).q-cart.q0),1e-7);
 const at=CASES[1],eq={...at,mA:1,mB:1};check('Atwood: equal masses remain at rest',step(eq,{q:0,u:0,t:0},1).u,0,1e-12);check('Atwood: reversed mass symmetry',dynamics({...at,mA:2,mB:1},0,0).du,-dynamics(at,0,0).du,1e-12);
 for(const id of ['cord','sliders']){const c=CASES.find(c=>c.kind===id),q=(c.q0+c.end)/2,eps=1e-5,z=geometry(c,q),plus=geometry(c,q+eps),minus=geometry(c,q-eps);for(const body of ['A','B'])for(let i=0;i<2;i++)check(id+' geometry derivative '+body+i,(plus[body][i]-minus[body][i])/(2*eps),z['d'+body][i],1e-8);}
 return checks;}
if(typeof module!=='undefined')module.exports={CASES,G,STEP,geometry,dynamics,step,observables,trajectory,sample,runModelChecks};
