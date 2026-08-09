# 电容充放电实验 — 执行计划

> 关联规格: `docs/superpowers/specs/2026-08-06-capacitor-rc-circuit-design.md` (v2.0)
> 状态: **待启动（v2.0 已二次审查）**
> 预估总工时: ~10h

---

## Phase 0 · simulationStore + MonitorSchema 改造 [0.5h]

### 任务
- [ ] **T0.1** 修改 `src/experiments/base/IExperiment.ts`
  - `MonitorSchema` 接口增加 `maxHistoryLength?: number` 可选字段
- [ ] **T0.2** 修改 `src/stores/simulationStore.ts`
  - `updateMonitoringHistory(key, value)` 通过 `get()` 读取当前 experiment 的 `getMonitorSchema()?.maxHistoryLength`，缺省 100
  - 用法: `const max = get().currentExperiment?.getMonitorSchema?.()?.maxHistoryLength ?? 100`
  - 然后 `[...prev, value].slice(-max)`
- [ ] **T0.3** 回归验证
  - 访问 Synchrotron / Hydrogen / Rutherford 三个实验
  - 启动后查看曲线图正常滚动，无报错

### 验证
- TypeScript 编译通过
- 三个现有实验曲线图行为不变（默认 100 点）

---

## Phase 1 · RCCircuitPhysics 物理模块 [1.5h]

### 任务
- [ ] **T1.1** 创建目录 `src/experiments/electromagnetism/capacitor-charge-discharge/`
- [ ] **T1.2** 编写 `RCCircuitPhysics.ts`
  - `SwitchMode = 'charging' | 'discharging' | 'disconnected'`
  - `CircuitState { mode, voltage(V), current(A), charge(C), time(s) }`
  - `CircuitParams { resistance(kΩ), capacitance(μF), sourceVoltage(V) }`
  - `createInitialState(): CircuitState`（mode=disconnected, 全零）
  - `step(state, params, dt): CircuitState`（RK4 积分）
    - 内部换算: `R_Ω = resistance × 1000`, `C_F = capacitance × 1e-6`
    - 充电: `dU/dt = (U₀ - U)/RC`, `i = (U₀ - U)/R`
    - 放电: `dU/dt = -U/RC`, `i = -U/R`
    - 断开: `i = 0`, U 保持
    - `charge = C × voltage`
    - `time += dt`
  - `analyzeTimeConstant(params): number` 返回 τ（秒）
- [ ] **T1.3** 编写 `__tests__/RCCircuitPhysics.test.ts`
  - 测试 1: 充电稳态收敛到 U₀（误差 < 0.1%）
  - 测试 2: 放电稳态收敛到 0（误差 < 0.1%）
  - 测试 3: 断开状态 U_C 保持不变
  - 测试 4: 充电 t=τ 时 U_C ≈ 0.632 × U₀（误差 < 1%）
  - 测试 5: 放电 t=τ 时 U_C ≈ 0.368 × U₀（误差 < 1%）
  - 测试 6: 单位换算正确（kΩ/μF → Ω/F）
  - 测试 7: i 与 U_C 符号关系（充电同号、放电异号）
  - 测试 8: 大 dt（1/30s）下不发散（RK4 稳定性）
- [ ] **T1.4** 跑测试全部通过

### 验证
- `npm test` 通过
- 物理模块零 Three.js / React 依赖

---

## Phase 2 · 主类 + 注册 + 首页卡片 [1.5h]

### 任务
- [ ] **T2.1** 编写 `CapacitorExperiment.ts`（继承 `ExperimentBase`，实现 `IExperiment2D`）
  - `metadata.renderMode = '2d'`
  - `metadata`: id=`capacitor-charge-discharge`, category=`electromagnetism`, name=`Capacitor Charge/Discharge`
  - `config.parameters`: resistance / capacitance / sourceVoltage / switchMode(select) / showField3D(boolean) / showLabels(boolean)
  - `config.camera`: 占位（2D 模式不使用）
  - `physicsState: CircuitState`（内部）
  - `init(container)`: 用 `ReactDOM.createRoot(container)` 挂载 `<CircuitView2D>`（Phase 3 实现，先占位返回空 div）
  - `start/pause/reset`: 状态机 + `physicsState = createInitialState()`
  - `update(dt)`: dt clamp 1/30 → `physicsState = step(physicsState, params, dt)`
  - `setDisplayData()`: 返回 `{ voltage: {V}, current: {mA}, charge: {μC} }`
  - `getMonitorSchema()`: 三量 + sampleIntervalMs=50 + maxHistoryLength=1000
  - `setParameter(key, value)`: 拦截 `switchMode` → 更新 `physicsState.mode`；拦截 `showField3D` → 挂载/卸载 3D 视图
  - `dispose()`: unmount React root + dispose 3D view
- [ ] **T2.2** 编写 `index.ts` 导出
- [ ] **T2.3** 修改 `src/experiments/index.ts`
  - `import` + `ExperimentRegistry.register('capacitor-charge-discharge', CapacitorExperiment)`
  - 添加到 `export` 列表
- [ ] **T2.4** 在 `src/pages/Home.tsx` 添加 `CapacitorCircuitDiagram` 组件
  - **视觉规范严格对齐**: SVG 240×132, viewBox `0 0 240 132`, opacity-80
  - 元素: 极板（红+蓝水平短线）、电场线（青色虚线 + 流动动画 `<animate>`）、电池符号（红蓝双线）、电阻矩形 + 滑片圆、粒子小球（橙色 + `<animate>` cx 属性）、径向渐变光晕（暖金色）
  - `<defs>` 定义 `<linearGradient>`（电流路径）和 `<radialGradient>`（极板光晕）
  - 动画 duration 1.6–2.4s（与其他卡片一致）
- [ ] **T2.5** 在 `Home.tsx` 的 `experiments` 数组追加卡片
  - 位置: 紧邻 `galvanic-cell` 之后（电磁学同色系聚集）
  - id, title=`Capacitor Circuit`, route=`/experiment/capacitor-charge-discharge`
  - gradient=`from-amber-900/20 via-yellow-900/10 to-orange-900/20`
- [ ] **T2.6** 启动 dev server 验证
  - 首页可见新卡片，视觉与其他卡片协调
  - 点击进入实验页（空白但无报错）
  - Workbench 显示 6 个控件（R/C/U/switchMode/showField3D/showLabels）

### 验证
- 首页卡片视觉与既有 16 张卡片协调（尺寸、动画、配色）
- 实验页 Header + Workbench 正常渲染
- 无 console 报错

---

## Phase 3 · CircuitView2D（SVG 电路视图）[3.5h]

### 任务
- [ ] **T3.1** 创建 `CircuitView2D.tsx` 主组件
  - props: `state: CircuitState`, `params: CircuitParams`, `onParameterChange: (key, value) => void`
  - 背景: `#0D1117`，SVG `viewBox="0 0 800 500"`（响应式）
  - 装饰光晕（与 ExperimentView 主区一致: `bg-cyan-400/10 blur-3xl`）
- [ ] **T3.2** 绘制电路拓扑
  - **电池**（左侧）: 红色长线（+）+ 蓝色短线（−），国际标准画法
  - **导线**: `stroke="#475569" strokeWidth="3"`，闭合回路
  - **开关**: 单刀三掷，根据 `switchMode` 显示三种位置（青色闭合/灰色断开）
  - **电容**（右侧）: 两条水平极板（上红 `#F87171` + 下蓝 `#60A5FA`），间距 30px
  - **公式标注**（顶部，半透明卡片）: `U_C = U₀(1 - e^(-t/RC))` 等，由 `showLabels` 控制显隐
  - **实时数值**: 在元件旁标注 `U₀ = 6.0 V`、`R = 10 kΩ`、`C = 1000 μF`、`U_C = 3.2 V`、`i = 0.28 mA`
    - 样式: `font-mono text-cyan-300`，背景 `bg-slate-900/70 backdrop-blur rounded-lg px-2 py-1`
- [ ] **T3.3** 绘制滑动变阻器（关键元件）
  - 矩形电阻丝底色 `#334155`（总长 200px）
  - 高亮段（左端起算到滑片位置）`#22D3EE` 青
  - 滑片: 白色实心圆（`#F0F6FC`，半径 8）+ 拖拽手柄（rect）
  - 拖拽: `onMouseDown/Move/Up` → 计算 x 偏移 → 反算 `resistance = min + (x / totalLength) × (max - min)` → 调 `onParameterChange('resistance', Math.round(newValue))`
  - 双向同步: 滑片 cx 完全由 `params.resistance` 决定（无内部状态，避免循环）
  - 阻值标签: `R = 10 kΩ`（跟随滑片移动）
- [ ] **T3.4** 实现**粒子流**
  - 定义 `<path id="circuit-loop" d="..." />`（围绕整个回路，隐藏 visibility）
  - N=15 个橙色 `<circle r="4" fill="#F97316">`，每帧更新位置
  - 位置: `path.getPointAtLength(t)`，每帧 `t += speed × dt`
  - `speed = baseSpeed × |i| / Imax`，`baseSpeed` 调到看起来自然
  - 方向: `i > 0` 顺时针，`i < 0` 逆时针，`i = 0` 静止
  - 光晕: 双层圆（外层 `fill="#F97316" opacity="0.3" r="8"`）
  - **性能**: 用 `<g>` 包裹粒子，仅 transform 而非重设 cx/cy
- [ ] **T3.5** 实现**极板电荷点阵**
  - 上板: 5×4 = 20 个 `+` 符号（红色 `<text>+"`），网格排布
  - 下板: 5×4 = 20 个 `−` 符号（蓝色 `<text>−"`)
  - 显示数量: `floor(|Q| / Qmax × 20)`
  - 渐入/渐出: 用 opacity 平滑过渡（避免突兀）
- [ ] **T3.6** React 子树与实验类连接
  - `CapacitorExperiment.init(container)`: `ReactDOM.createRoot(container).render(<RootComponent />)`
  - RootComponent 内部用 `useRef` 持有 `physicsState` 与 `params`
  - `setParameter(key, value)`: 直接 mutate ref，触发 forceUpdate 或 setState
  - 每帧 `update(dt)` 后用 `requestAnimationFrame` 内部同步触发渲染（或用 `useSyncExternalStore`）
  - **实现策略**: RootComponent 每帧 raf 自驱更新（不依赖 store），physicsState 通过 ref 共享

### 验证
- 充电过程: 粒子从电池正极顺时针流动，速度逐渐变慢
- 极板电荷点逐渐增多（从 0 到 20）
- Workbench Monitor: U_C 上升曲线 + i 下降曲线 + Q 上升曲线
- 拖动滑动变阻器滑片 → 阻值数字变化 → τ 改变 → 曲线斜率实时变化
- 切换到放电: 粒子反向，电荷点减少，U_C 下降
- 切换到断开: 粒子静止，所有量保持
- 视觉与项目其他页面协调（深底 + 青色强调 + 圆角卡片）

---

## Phase 4 · Capacitor3DView（3D 元件视图）[2h]

### 任务
- [ ] **T4.1** 创建 `Capacitor3DView.ts`
  - 暴露 `group: THREE.Group`
  - `update(state: CircuitState, dt: number)`: 根据电荷量更新可视元素
  - `reset()`: 清空动态元素
  - `dispose()`: 调用 `disposeObject3D(group)`
- [ ] **T4.2** 创建极板（`CylinderGeometry`）
  - 两个薄圆盘（半径 2，厚度 0.1），间距 1.5
  - 上板: 红色微透明 `MeshStandardMaterial({ color: 0xF87171, transparent: true, opacity: 0.6 })`
  - 下板: 蓝色微透明 `0x60A5FA`
- [ ] **T4.3** 创建电场线
  - 极板间垂直 `Line`（`BufferGeometry` + `LineBasicMaterial`）
  - 数量 = `floor(|Q| / Qmax × 12)`，均匀分布在极板间
  - 颜色 `0x22D3EE` 青，opacity 0.7
  - 动态 add/remove（保存到 `fieldLines: THREE.Line[]`）
- [ ] **T4.4** 创建关键矢量箭头
  - `THREE.ArrowHelper` × 4–8 个，均匀分布
  - 长度 = 0.8，方向 +y（从 + 极指向 − 极）
  - 颜色与电场线同色
- [ ] **T4.5** 创建极板表面电荷点阵
  - `SphereGeometry(0.08, 8, 8)` × 最多 30 个（上板 + 红，下板 − 蓝）
  - 排布: 在极板顶面/底面随机分布（用 seeded random 保持稳定）
  - 数量 ∝ |Q|
- [ ] **T4.6** 灯光（与 `SceneContainer.DefaultLighting` 一致）
  - `ambientLight(0.28)`
  - `hemisphereLight(0xffffff, 0x080820, 0.3)`
  - `directionalLight(0xffffff, 0.8)` + 2 个 `pointLight`（青 + 暖白）
- [ ] **T4.7** 在 `CircuitView2D.tsx` 内嵌套 R3F Canvas
  - 当 `params.showField3D === true` 时，在 SVG 下方渲染 `<Canvas>` 子组件
  - Canvas 尺寸固定（如 `width="100%" height="300"`）
  - Canvas 内部用 `<OrbitControls>` + `<PerspectiveCamera>`
  - Canvas 内的 group 由 `Capacitor3DView` 提供
- [ ] **T4.8** `CapacitorExperiment.setParameter('showField3D', value)` 触发 RootComponent 重渲染，挂载/卸载 3D Canvas
  - 卸载时调用 `capacitor3DView.dispose()`

### 验证
- `showField3D=true` 时 SVG 下方显示 3D 极板视图
- 充电过程中: 电场线增多、电荷点阵增多、电场箭头变长
- 切换到放电: 反向衰减
- 关闭 `showField3D`: 3D 视图消失，资源释放（Chrome DevTools Memory 检查无泄漏）
- 3D 视觉与 2D 视图协调（同样的深底色 + 青/红/蓝语义色）

---

## Phase 5 · 微调、验证、构建 [1h]

### 任务
- [ ] **T5.1** 曲线图视觉检查
  - X 轴显示采样点（recharts 默认），无需改 X 轴为时间（避免改动 `QuantityChart`）
  - Y 轴自适应，单位在 Workbench 显示（V / mA / μC）
- [ ] **T5.2** 公式标注（SVG 内）
  - 充电公式: `U_C(t) = U₀(1 - e^(-t/RC))`
  - 放电公式: `U_C(t) = U_C(0)·e^(-t/RC)`
  - 时间常数: `τ = RC = 10 s`
  - 由 `showLabels` 控制显隐
  - 用 SVG `<text>` + 半透明背景 `<rect>` 实现（不引入 KaTeX）
- [ ] **T5.3** 视觉协调性检查清单
  - [ ] 电路视图背景 `#0D1117` 与项目一致
  - [ ] 元件配色（红+极/蓝−极/青强调/橙电流）跨界面呼应
  - [ ] 数值文字 `font-mono text-cyan-300`
  - [ ] 卡片/标注用 `rounded-lg bg-slate-900/70 backdrop-blur`
  - [ ] 首页卡片动画 duration 在 1.4–2.8s 范围
  - [ ] 3D Canvas 与 SVG 共享深底色
- [ ] **T5.4** TypeScript 严格编译通过
- [ ] **T5.5** `npm run build` 生产构建通过
- [ ] **T5.6** 手动 e2e 验证清单
  - [ ] 默认 disconnected: 粒子不动，U_C = 0
  - [ ] 切 charging: 曲线呈 RK4 解形态上升
  - [ ] τ 时刻: U_C ≈ 0.632 × U₀（验证时间常数）
  - [ ] 稳态: U_C → U₀, i → 0
  - [ ] 调小 R: 曲线变陡（τ 减小）
  - [ ] 调大 C: 曲线变缓（τ 增大）
  - [ ] 切 discharging: U_C 反向 e^(-t/RC) 衰减
  - [ ] 切 disconnected: 所有量冻结
  - [ ] 开启 showField3D: 3D 视图同步显示
  - [ ] 关闭 showField3D: 3D 视图消失、资源释放
  - [ ] 拖动滑动变阻器滑片: 阻值数字变化，τ 实时改变
- [ ] **T5.7** 浏览器性能: 60 FPS（Chrome DevTools Performance）

### 验证
- 生产构建 dist 目录生成成功
- 所有 e2e 用例通过
- 视觉与项目其他页面协调统一
- 帧率稳定 60 FPS

---

## 总验收清单

| 维度 | 验收项 |
|------|--------|
| **物理严谨** | RK4 求解，τ ≈ RC（误差 <1%），稳态收敛（误差 <0.1%） |
| **高中可视化** | 粒子方向/速度、极板 +/− 电荷点、电场线密度全部正确反映物理状态 |
| **可调参数** | R/C/U₀ 滑块、滑动变阻器拖拽、switchMode 下拉、showField3D/showLabels 开关全部生效 |
| **曲线图** | 完整充放电周期可见（50s 窗口），单位正确 |
| **视觉协调** | 深底/青蓝渐变/毛玻璃/圆角/字体全部与项目一致 |
| **首页卡片** | 与既有 16 张卡片尺寸/动画/配色完全统一 |
| **架构** | 物理模块纯函数可测，3D 资源正确释放，2D React 子树正确卸载 |
| **扩展性** | CircuitState/CircuitParams 为 LC 预留 |
| **回归** | Synchrotron/Hydrogen/Rutherford 三实验不破坏 |

---

## 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-06 | v0.1 | 初版 |
| 2026-08-06 | **v1.0** | **二次审查同步 spec v2.0**：<br>① 移除路由修改任务（走 `renderMode: '2d'`）<br>② 物理积分改 RK4（T1 增加 0.5h）<br>③ Phase 2 增加 SVG 缩略图视觉规范对齐任务<br>④ Phase 3 增加 React 子树生命周期管理 + 视觉协调检查<br>⑤ Phase 5 增加视觉协调性检查清单<br>⑥ 总工时 8.5h → 10h |
