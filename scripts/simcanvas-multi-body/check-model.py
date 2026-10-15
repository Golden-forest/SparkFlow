#!/usr/bin/env python3
"""Independent energy/quadrature oracle; standard-library-only, no runtime solver import."""
import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
source = "const m=require('./scripts/simcanvas-multi-body/model.cjs');console.log(JSON.stringify(m.CASES.map(c=>{const tr=m.trajectory(c);return {c,s:[m.sample(tr,tr.duration/2),m.sample(tr,tr.duration)]}})))"
data = json.loads(subprocess.check_output(['node', '-e', source], cwd=ROOT))
g = 9.8

def energy_mass(c, q):
    a,b = c['mA'],c['mB']
    k,q0 = c['kind'],c['q0']
    if k in ['cart','cylinder']:
        return b*g*(q-q0), a+b, b*g
    if k == 'atwood':
        return (b-a)*g*(q-q0),a+b,(b-a)*g
    if k == 'incline':
        f=(b-a*math.sin(c['angle']))*g
        return f*(q-q0),a+b,f
    if k in ['central','offset','elbow']:
        ra,rb=c['rA'],c['rB']
        mass=a*ra**2+b*rb**2
        if k == 'central':
            force=g*(b*rb-a*ra)
            return force*math.sin(q),mass,force
        if k == 'offset':
            force=g*(a*ra+b*rb)
            return force*math.sin(q),mass,force
        return a*g*ra*math.sin(q)-b*g*rb*(1-math.cos(q)),mass,a*g*ra
    if k == 'cord':
        d=c['D'];l=math.hypot(d,q);l0=math.hypot(d,q0)
        return a*g*(q-q0)-b*g*(l-l0),a+b*q*q/(d*d+q*q),g*(a-b*q0/l0)
    l=c['L']
    return a*g*l*(math.cos(q0)-math.cos(q)),l*l*(a*math.sin(q)**2+b*math.cos(q)**2),a*g*l*math.sin(q0)

def travel_time(c, q, n=6000):
    end=math.sqrt(q-c['q0']);h=end/n
    def f(w):
        if w == 0:
            _,mass,force=energy_mass(c,c['q0'])
            return math.sqrt(2*mass/force)
        drop,mass,_=energy_mass(c,c['q0']+w*w)
        return 2*w*math.sqrt(mass/(2*drop))
    return h/3*(f(0)+f(end)+sum((4 if i%2 else 2)*f(i*h) for i in range(1,n)))

max_time_error=0
for entry in data:
    c=entry['c']
    for s in entry['s']:
        drop,mass,_=energy_mass(c,s['q'])
        speed=math.sqrt(2*drop/mass)
        assert abs(speed-s['u'])<1e-7,(c['id'],'speed',speed,s['u'])
        elapsed=travel_time(c,s['q'])
        error=abs(elapsed-s['t']);max_time_error=max(max_time_error,error)
        assert error<2e-6,(c['id'],'time',error)
    print('PASS independent energy/time oracle:',c['id'])
print('18 oracle snapshots passed; max time error:',max_time_error,'s; tolerance: 2e-6 s')
