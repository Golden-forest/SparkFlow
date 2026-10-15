# Independent energy quadrature; does not reuse runtime RK4 or its acceleration.
import json, math, sys
rows=json.load(sys.stdin)
def simpson(f,a,b,tol=1e-10):
 def rec(a,b,fa,fb,fm,S,eps,depth):
  mid=(a+b)/2;l=(a+mid)/2;r=(mid+b)/2;fl=f(l);fr=f(r)
  L=(mid-a)*(fa+4*fl+fm)/6;R=(b-mid)*(fm+4*fr+fb)/6
  if depth==0 or abs(L+R-S)<15*eps:return L+R+(L+R-S)/15
  return rec(a,mid,fa,fm,fl,L,eps/2,depth-1)+rec(mid,b,fm,fb,fr,R,eps/2,depth-1)
 fa=f(a);fb=f(b);fm=f((a+b)/2);return rec(a,b,fa,fb,fm,(b-a)*(fa+4*fm+fb)/6,tol,24)
worst_t=worst_v=0
for row in rows:
 if row['kind']=='return':
  theta=row['theta'];energy=lambda a:2+8*math.cos(a);t=simpson(lambda a:.4/math.sqrt(energy(a)),theta,math.pi/2);v=math.sqrt(energy(theta))
 elif row['kind']=='robot':
  theta=row['theta'];energy=lambda a:16-8*(1-math.cos(a));t=simpson(lambda a:.4/math.sqrt(energy(a)),0,theta);v=math.sqrt(energy(theta))
 else:
  k=row['mult'];c=row['charge'];a0=row['startTheta'];theta=row['theta'];direction=1 if theta>a0 else -1
  def v2(a):return 2*9.8*.6*(math.cos(a)-math.cos(a0)+c*k/math.sqrt(3)*(math.sin(a)-math.sin(a0)))
  def f(z):
   if z<1e-6:return 2*math.sqrt(.6/(2*9.8*abs(c*k/math.sqrt(3)*math.cos(a0)-math.sin(a0))))
   return .6*2*z/math.sqrt(max(1e-25,v2(a0+direction*z*z)))
  t=simpson(f,0,math.sqrt(abs(theta-a0)),2e-9);v=math.sqrt(max(0,v2(theta)))
 worst_t=max(worst_t,abs(t-row['elapsed']));worst_v=max(worst_v,abs(v-abs(row['v'])))
assert worst_t<2e-6,(worst_t,'time mismatch')
assert worst_v<2e-6,(worst_v,'speed mismatch')
print(json.dumps({'independent_snapshots':len(rows),'max_time_error_s':worst_t,'max_speed_error_m_s':worst_v,'tolerance':2e-6}))
