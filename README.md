# Spark Flow · 高中物理虚拟实验平台

> 一个用 3D 可视化和交互把高中物理"做出来"的实验平台——不是看动画,是亲手调参数、看现象、读数据。

## 这是什么

Spark Flow 是一个跑在浏览器里的物理实验仿真平台。它把课本里那些"想象一下"的物理场景——α 粒子轰击金箔、电子在能级间跳跃、卫星绕地球转、两辆车撞在一起——做成了 **15 个可以动手玩的实验**。

每个实验都是真仿真:你拖动滑块改参数,物理引擎实时算,3D 场景实时变,数据图表实时画。不是 PPT,不是视频,是真能调的实验。

---

## 功能亮点

### 15 个实验,覆盖 7 个物理领域

| 领域 | 实验 | 你能干什么 |
|------|------|-----------|
| **原子物理** | 卢瑟福 α 粒子散射 | 在宏观装置视图里发射 α 粒子轰击金箔,看散射统计;切换微观视图近距离看库仑偏转 |
|  | 氢原子能级跃迁 | 在 3D 玻尔模型里发射光子,或切到抽象能级图触发自发辐射 / 受激吸收 / 受激辐射 |
| **天体物理** | 天体运动仿真 | 太阳系视图里 8 大行星按真实周期运行;切换卫星视图看 ISS、极轨、GPS、地球同步轨道 |
| **力学** | 单摆实验 | 调摆长、摆角、重力,测周期,推当地 g 值 |
|  | 运动与碰撞实验室 | 多对象场景:小车、斜面、碰撞,最复杂的力学沙盒 |
|  | 平抛运动 (2D) | 唯一的 2D 实验,调初速度和高度看轨迹 |
|  | 匀速圆周运动 | 调线速度、半径,看向心加速度和力的实时变化 |
|  | 斜面摩擦力实验 | 调倾角和摩擦系数,看物体何时开始滑动 |
|  | 弹簧振子 | 调劲度系数和质量,看简谐运动周期 |
|  | 动量碰撞小车 | 两车正碰,调质量、初速度,验证动量守恒 |
| **电磁学** | 同步加速器与洛伦兹力 | 宏观视图看整个加速器环;微观视图看 E/B 场中粒子的 4 种行为:RF 加速、磁弯曲、同步轨道、碰撞点 |
| **光学** | 光的折射 | 调介质折射率,看光线偏折 |
|  | 双缝干涉 | 调缝距和波长,看干涉条纹,颜色随波长真实变化 |
| **热学** | 玻意耳定律 | 调活塞位置改变体积,看压强实时响应 |
| **电化学** | 原电池 | 看粒子流如何在电极间移动,实时电化学计算 |

### 双视图:宏观 + 微观,抽象 + 具象

部分实验支持**视角切换**,让物理更直观:

- **卢瑟福散射** — 宏观装置视图(α 源 / 金箔 / 环形探测屏 / 散射统计) ⇄ 微观视图(库仑偏转的近距离观察)
- **同步加速器** — 加速器环全景 ⇄ 单个粒子在 E/B 场中的 4 种机制
- **氢原子** — 3D 玻尔模型 ⇄ SVG 能级抽象图(可手点能级触发跃迁)

### 声明式控制面板:写配置,不写 UI

实验开发的核心是 `ControlSchema` 和 `MonitorSchema`——你声明"有哪些参数可调、有哪些量要监控",框架自动渲染滑块、开关、按钮和实时折线图。加一个新参数 = 加一行配置,**不用碰 UI 代码**。

```typescript
// 实验类里这么写,控制面板自动生成
getControlSchema() {
  return [
    { key: 'velocity', label: 'Initial Velocity', type: 'range',
      min: 0, max: 100, step: 1, unit: 'm/s' },
    { key: 'showTrail', label: 'Show Trail', type: 'boolean' },
    { key: 'mode', label: 'Mode', type: 'select',
      options: ['free', 'forced'] },
    { key: 'fire', label: 'Fire Particle', type: 'action' },
  ];
}
```

### 实时数据监控

每个实验运行时,选中的物理量(位移、速度、能量、力……)会被自动采集并以**实时折线图**呈现(基于 recharts)。监控哪些量也是声明式配置的,最多保留最近 100 个数据点。

### 课件资源中心

平台除了实验,还集成了一个**课件展示系统**。已经导入 5 个 HTML 课件(包括 AI 生成报告、班级成绩对比等),通过首页"Courseware"标签页访问。新增课件只需:

```bash
npm run import:courseware path/to/your.html -- --name my-lesson
```

脚本会自动解析 HTML 引用的所有本地资源(图片、CSS、JS),复制到独立子目录,并更新资源清单。无需改任何代码。

---

## 技术栈

| 层 | 技术 | 干什么 |
|----|------|--------|
| 框架 | React 19 + TypeScript | UI 和类型安全 |
| 3D 渲染 | Three.js + React Three Fiber + drei | 声明式写 3D 场景 |
| 2D 渲染 | 原生 Canvas + requestAnimationFrame | 平抛运动等 2D 实验 |
| 物理 | 自实现物理计算 + cannon-es | 每个实验有独立的 *Physics.ts,精确控制教学场景 |
| 动画 | GSAP + @react-spring/three | 时间轴和物理动画 |
| 状态 | Zustand | 单一 simulationStore 管全部仿真状态 |
| 样式 | Tailwind CSS v4 (Vite 插件) | 原子化 CSS |
| 路由 | React Router v7 | 页面和实验视图分发 |
| 图表 | Recharts | 实时监控折线图 |
| 构建 | Vite 7 | 极速 HMR |
| E2E 测试 | Playwright | 力学实验冒烟测试 |

---

## 项目结构

```
atomic_physics/
├── src/
│   ├── experiments/              # 15 个实验,按领域分目录
│   │   ├── base/                 # 实验基类 + 注册中心 + 接口
│   │   │   ├── IExperiment.ts        # 3D 实验接口
│   │   │   ├── IExperiment2D.ts      # 2D 实验接口
│   │   │   ├── ExperimentBase.ts     # 3D 基类(参数/监控/场景工厂)
│   │   │   ├── ExperimentBase2D.ts   # 2D 基类
│   │   │   └── ExperimentRegistry.ts # 注册中心(单例)
│   │   ├── atomic/                   # 卢瑟福散射 + 氢原子跃迁
│   │   ├── celestial/                # 太阳系
│   │   ├── mechanics/                # 7 个力学实验
│   │   ├── electromagnetism/         # 同步加速器
│   │   ├── optics/                   # 折射 + 双缝
│   │   ├── thermodynamics/           # 玻意耳定律
│   │   ├── electrochemistry/         # 原电池
│   │   └── shared/                   # 跨实验共享组件(发光球、向量箭头)
│   │
│   ├── components/
│   │   ├── simulation/           # 3D/2D 画布容器、播放控制、工具栏
│   │   ├── experiment/           # ExperimentWorkbench(核心控制侧栏)、秒表
│   │   ├── monitoring/           # 物理量监控 + 实时折线图
│   │   └── physics/              # 轨迹线、向量箭头等可视化对象
│   │
│   ├── pages/
│   │   ├── Home.tsx                  # 首页:实验 / 课件 / 图片三标签
│   │   ├── ExperimentView.tsx        # 通用实验视图(3D 或 2D 自动选择)
│   │   ├── MacroExperimentView.tsx   # 卢瑟福宏观装置视图
│   │   └── HydrogenAbstractView.tsx  # 氢原子能级抽象图
│   │
│   ├── stores/
│   │   └── simulationStore.ts        # Zustand:状态机 + 监控历史
│   │
│   └── utils/                        # 物理常数、公式、向量
│
├── public/
│   ├── courseware/               # 5 个已导入的 HTML 课件
│   ├── images/                   # 图片资源
│   └── resource-manifest.json    # 自动生成的资源清单
│
├── scripts/
│   ├── import-courseware.ts      # 课件导入工具
│   └── resource-manifest.ts      # 资源清单生成器
│
├── tests/e2e/                    # Playwright 冒烟测试
└── vite.config.ts                # 含资源清单插件 + 课件路由中间件
```

---

## 快速开始

### 环境要求

- Node.js 18+
- 现代浏览器(支持 WebGL 2.0)

### 安装与运行

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器 (默认 http://localhost:5173)
npm run build        # 构建生产版本
npm run preview      # 预览生产构建
```

### 测试

```bash
npm run test:e2e          # 运行 E2E 冒烟测试(5 个力学实验)
npm run test:e2e:headed   # 有头模式运行,看浏览器实际操作
```

### 导入课件

```bash
# 基础用法
npm run import:courseware path/to/lesson.html

# 指定目录名
npm run import:courseware path/to/lesson.html -- --name my-lesson

# 覆盖已存在目录
npm run import:courseware path/to/lesson.html -- --name my-lesson --force
```

脚本会自动:
1. 解析 HTML 中所有相对路径资源(图片、CSS、JS)
2. 创建 `public/courseware/<name>/` 独立子目录
3. 复制 HTML 和所有依赖资源
4. 更新 `resource-manifest.json`
5. 报告任何缺失的资源警告

---

## 架构设计

### 插件式实验架构

所有实验遵循 `IExperiment` 接口(3D)或 `IExperiment2D` 接口(2D),通过注册中心统一管理:

```typescript
// 注册一个实验(装饰器自动完成)
@registerExperiment('my-experiment')
class MyExperiment extends ExperimentBase {
  readonly metadata = { id: 'my-experiment', name: 'My Experiment', ... };

  async init(scene: THREE.Scene) { /* 搭建 3D 场景 */ }
  update(dt: number) { /* 每帧物理计算 */ }
  getControlSchema() { /* 返回参数定义,框架自动渲染 UI */ }
  getMonitorSchema() { /* 返回监控定义,框架自动画图 */ }
}
```

新增实验只需:
1. 在 `src/experiments/<category>/<name>/` 下创建实验类
2. 在 `src/experiments/index.ts` 注册
3. 在路由和首页添加入口

### 状态机驱动的仿真生命周期

```
Idle → Start → Running ⇄ Paused → Reset → Idle
                                    ↓
                              Completed
```

由 `simulationStore` 统一管理,所有组件订阅同一状态源,保证 UI 与仿真同步。

### 双渲染管线

- **3D 管线**:React Three Fiber `<Canvas>` → OrbitControls + PerspectiveCamera + 灯光 → 实验对象通过 `init(scene)` 注入
- **2D 管线**:原生 Canvas + `requestAnimationFrame` → ResizeObserver 自适应 → 实验对象通过 `init(container)` 注入

实验视图根据元数据 `renderMode: '2d' | '3d'` 自动选择管线。

### Vite 自定义插件

`vite.config.ts` 内含两个关键定制:

1. **资源清单插件** — 开发和构建时自动扫描 `public/courseware/` 和 `public/images/`,生成 `resource-manifest.json`,首页据此渲染课件和图片卡片。文件变化时 80ms 防抖重新生成。

2. **课件路由中间件** — 在 Vite 的 SPA fallback 之前拦截 `/courseware/<name>` 请求,直接返回子目录下的 `index.html`。这解决了 SPA 路由会"吃掉"课件 HTML 的问题。

---

## 已实现实验清单(完整)

<details>
<summary>点击展开 15 个实验的完整列表</summary>

| # | ID | 名称 | 领域 | 模式 |
|---|-----|------|------|------|
| 1 | `rutherford-scattering` | Rutherford Alpha Scattering | 原子物理 | 3D,双视图(宏观+微观) |
| 2 | `hydrogen-transitions` | Hydrogen Energy-Level Transitions | 原子物理 | 3D + SVG 抽象图 |
| 3 | `solar-system` | Celestial Motion Simulation | 天体物理 | 3D,双视图(太阳系+卫星) |
| 4 | `pendulum` | Simple Pendulum Lab | 力学 | 3D |
| 5 | `motion-collision` | Motion & Collision Laboratory | 力学 | 3D,多对象沙盒 |
| 6 | `projectile-motion` | Projectile Motion Lab | 力学 | **2D** |
| 7 | `uniform-circular-motion` | Uniform Circular Motion Lab | 力学 | 3D |
| 8 | `inclined-plane-friction` | Inclined Plane Friction Lab | 力学 | 3D |
| 9 | `spring-oscillation` | Spring Oscillation Lab | 力学 | 3D |
| 10 | `momentum-carts` | Momentum Carts Collision | 力学 | 3D |
| 11 | `synchrotron-em-fields` | Synchrotron and Lorentz Force | 电磁学 | 3D,双视图(宏观+微观) |
| 12 | `light-refraction` | Light Refraction | 光学 | 3D |
| 13 | `double-slit-interference` | Double-Slit Interference | 光学 | 3D |
| 14 | `boyle-law` | Boyle's Law Lab | 热学 | 3D |
| 15 | `galvanic-cell` | Electrochemical Cell | 电化学 | 3D |

</details>

---

## 扩展实验

想加一个新实验?最小步骤:

1. **创建目录**: `src/experiments/<领域>/<实验名>/`
2. **实现实验类**: 继承 `ExperimentBase`(3D)或 `ExperimentBase2D`(2D),实现 `init` / `update` / `getControlSchema` / `getMonitorSchema`
3. **注册**: 在 `src/experiments/index.ts` 调用 `ExperimentRegistry.register()`
4. **加路由**: 在 `src/App.tsx` 添加路由(或复用通用 `/experiment/:experimentId`)
5. **加首页卡片**: 在 `Home.tsx` 的实验列表添加元数据

框架会自动为你生成:参数控制面板、实时监控图表、播放控制、场景管理。

---

## License

私有项目。
