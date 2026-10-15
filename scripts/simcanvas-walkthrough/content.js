const WalkthroughContent = {
  robot: {
    parts: [
      {zh:'碰后动能',en:'Impact energy',goal:'Kinetic energy immediately after the bumper impact',result:'Eₖ = 4 J',rows:[
        ['Each bob · smooth ascent','½mv₀² = ½mv<sub>b</sub>² + mgR'],
        ['Incoming speed','v<sub>b</sub>² = v₀² − 2gR = 8 m²/s²<br>v<sub>b</sub> = 2√2 m/s'],
        ['Vertical momentum · short impact','2mv<sub>b</sub> = MV<br>V = √2 m/s'],
        ['Whole robot · after impact','Eₖ = ½MV² = <b>4 J</b>']
      ]},
      {zh:'最大高度',en:'Maximum rise',goal:'Rise of the shell from launch to the highest point',result:'hₘₐₓ = 0.10 m',rows:[
        ['Whole robot · launch → apex','½MV² = Mgh<sub>max</sub><br>V² = 2gh<sub>max</sub>'],
        ['Maximum rise','h<sub>max</sub> = V²/(2g)<br>= 2/(2 × 10) = <b>0.10 m</b>'],
        ['At the highest point','v = 0<br>V = √2 m/s at launch']
      ]},
      {zh:'两次损失',en:'Two impact losses',goal:'Mechanical-energy loss from release through first landing',result:'ΔE = 6 J',rows:[
        ['Bumper collision','ΔE₁ = ½(2m)v<sub>b</sub>² − ½MV²<br>= 8 − 4 = <b>4 J</b>'],
        ['Ground collision · shell stops','ΔE₂ = ½(M − 2m)V²<br>= <b>2 J</b>'],
        ['Total loss · first landing','ΔE = ΔE₁ + ΔE₂ = <b>6 J</b>'],
        ['Whole-interval check','E<sub>initial</sub> = ½(2m)v₀² = 16 J<br>E<sub>final</sub> = 2mgR + ½(2m)V² = 10 J<br>ΔE = 16 − 10 = 6 J']
      ]}
    ],
    givens:'M = 4 kg · mA = mB = 1 kg<br>R = 0.4 m · v₀ = 4 m/s · g = 10 m/s²',
    note:'M includes both bobs · shell mass M − 2m = 2 kg'
  },
  bead: {
    parts: [
      {zh:'缓慢升压',en:'Quasi-static voltage',goal:'Voltage when the positive bead first reaches N',result:'U₀ = mgd/(√3q)',rows:[
        ['Contact geometry','sinθ<sub>N</sub> = (d/2)/d = ½<br>θ<sub>N</sub> = 30°'],
        ['Equilibrium · charge +q','qE = mg tanθ<br>E = U/d'],
        ['Voltage at first N contact','U₀ = (mgd/q)tan30°<br>= <b>mgd/(√3q)</b>']
      ]},
      {zh:'碰前张力',en:'Tension before M',goal:'Tension in each rope immediately before the first M contact',result:'T = (2√6/3)mg',rows:[
        ['N → M · equal endpoint heights','½mv<sub>M</sub>² = qU₀<br>U₀ = mgd/(√3q)'],
        ['Speed at M · before contact','v<sub>M</sub>² = 2gd/√3'],
        ['Radial Newton law · at M','√2T − mg cos30° − qE sin30°<br>= mv<sub>M</sub>²/d<br>qE = mg/√3'],
        ['Each rope · not the resultant','T = <b>(2√6/3)mg</b><br>≈ 1.633mg']
      ]},
      {zh:'范围与极值',en:'Range & maximum',goal:'Allowed k and maximum kinetic energy after M, with U = kU₀',result:'Piecewise Eₖ,max',rows:[
        ['At M release · taut-rope answer range','T<sub>start</sub> = (3 − k)mg/(2√6) > 0<br><b>0 &lt; k &lt; 3</b>'],
        ['Work-energy · M → θ','Eₖ/(mgd) = cosθ − √3/2<br>+ (k/√3)(sinθ + ½)'],
        ['Candidate interior maximum','−sinθ + (k/√3)cosθ = 0<br>tanθ* = k/√3'],
        ['0 < k ≤ 1 · interior / boundary at k = 1','Eₖ,max = mgd[√(1 + k²/3)<br>− √3/2 + k/(2√3)]'],
        ['1 < k < 3 · at N, before contact','Eₖ,max = <b>kmgd/√3</b>']
      ]}
    ],
    givens:'Symbols: m, q, d, g · plate gap d<br>Two equal ropes: ℓ = √2d · angle 90°',
    note:'Symbolic problem · displayed ratios are dimensionless'
  }
};
