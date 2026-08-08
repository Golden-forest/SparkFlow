# i18n 国际化（汉化）设计规格 v1.0

> **日期**：2026-08-08
> **状态**：已批准，待写实施计划
> **作者**：brainstorming session 产出
> **前置**：本设计反转 CLAUDE.md 2026-01-18 条款"所有 UI 必须英文"

## 1. 背景与目标

### 1.1 现状

- 项目当前 **95%+ UI 文案为英文**（严格执行旧规范）
- 仅有约 22 处中文硬编码残留在氢原子工具栏（BottomToolbar/AbstractSideToolbar）和电容公式卡
- **没有任何 i18n 基础设施**（无 i18next、无 locale 文件、无翻译键）
- 实验元数据（metadata.name/description/keywords）100% 英文
- 实验动态返回的 label（getDisplayData）100% 英文

### 1.2 目标

- **中英双语可切换**：默认中文，可一键切英文
- **首页右上角语言切换按钮**：纯文字"中 / EN"双标签，高亮当前
- **主路径全覆盖**：首页、通用组件、实验层文案全部走 i18n
- **3D 内嵌文字延后**：同步辐射等实验的 3D TextSprite 保留英文，留作后续 PR
- **CLAUDE.md 规范同步更新**：从"必须英文"改为"必须走 i18n"

### 1.3 非目标

- ❌ 不做懒加载 / 网络加载（文案总量小，全量打包）
- ❌ 不做浏览器语言自动检测（用户选择优先，默认中文）
- ❌ 不做 3D TextSprite 翻译（本次范围外）
- ❌ 不做服务端翻译 / 第三方翻译 API

## 2. 技术选型

| 维度 | 选择 | 理由 |
|---|---|---|
| i18n 库 | `i18next` + `react-i18next` | 生态最成熟，React 19 / TS 支持完善，命名空间懒加载可扩展 |
| 初始化方式 | 同步 `init()` + bundled JSON import | 28 个 JSON 文件体积小（<30KB），避免 Suspense/闪烁 |
| 加载器 | 不使用 `i18next-http-backend` | 零网络请求，零运行时依赖 |
| 语言检测 | 手动读 `localStorage('sparkflow.lang')` | 不引入 `i18next-browser-languageDetector` |
| Suspense | 不使用 | 同步初始化永远命中资源 |

### 依赖增量

```
i18next: ^23.x
react-i18next: ^15.x
```

预计 bundle 增量约 50KB（gzip），可接受。

## 3. 目录结构

```
src/i18n/
├── config.ts                    # i18next 初始化
├── LanguageSwitcher.tsx         # 中/EN 双标签按钮
└── locales/
    ├── zh-CN/
    │   ├── common.json          # 通用按钮、标题
    │   ├── home.json            # 首页 Tab、卡片、空状态
    │   └── experiments/
    │       ├── hydrogen-transitions.json
    │       ├── rutherford-scattering.json
    │       ├── capacitor-charge-discharge.json
    │       ├── light-refraction.json
    │       ├── double-slit-interference.json
    │       ├── boyle-law.json
    │       ├── solar-system.json
    │       ├── pendulum.json
    │       ├── spring-oscillation.json
    │       ├── motion-collision.json
    │       ├── inclined-plane-friction.json
    │       ├── uniform-circular-motion.json
    │       ├── momentum-carts.json
    │       ├── projectile-motion.json
    │       ├── synchrotron-em-fields.json
    │       └── galvanic-cell.json
    └── en-US/                    # 完全镜像 zh-CN 结构
        ├── common.json
        ├── home.json
        └── experiments/
            └── ... (同上 16 个文件)
```

**文件总数**：2 语言 × (2 通用 + 16 实验) = **36 个 JSON 文件**

## 4. 数据流与切换机制

### 4.1 初始化流程

```
main.tsx 启动
  ↓
import '@/i18n/config'   ← 同步执行 i18next.init()
  ↓
i18next 读取 localStorage('sparkflow.lang')
  ├─ 有值 → 使用该语言
  └─ 无值 → 默认 'zh-CN'
  ↓
所有 ns 的 JSON 已 bundled（Vite import.json）
  ↓
createRoot().render(<App />)
  ↓
所有 useTranslation() 命中已加载资源，零闪烁
```

### 4.2 语言切换流程

```
用户点击 LanguageSwitcher
  ↓
i18next.changeLanguage('en-US' | 'zh-CN')
  ├─ 写入 localStorage('sparkflow.lang', targetLang)
  ├─ 所有 useTranslation 组件触发重渲染
  └─ zustand store 不受影响（实验状态保留）
```

### 4.3 LanguageSwitcher 组件

```tsx
// src/i18n/LanguageSwitcher.tsx
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language; // 'zh-CN' | 'en-US'

  return (
    <div className="inline-flex rounded-full border border-[#30363D] bg-[#111827]/70 p-1">
      <button
        onClick={() => i18n.changeLanguage('zh-CN')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
          current === 'zh-CN'
            ? 'bg-gradient-to-r from-cyan-600 to-sky-500 text-white'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        中
      </button>
      <button
        onClick={() => i18n.changeLanguage('en-US')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
          current === 'en-US'
            ? 'bg-gradient-to-r from-cyan-600 to-sky-500 text-white'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  );
}
```

**位置**：Home.tsx `<header>` 区绝对定位右上角，仅首页显示。

### 4.4 config.ts 示例

```ts
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhCommon from './locales/zh-CN/common.json';
import zhHome from './locales/zh-CN/home.json';
import zhHydrogen from './locales/zh-CN/experiments/hydrogen-transitions.json';
// ... 其余 zh-CN imports

import enCommon from './locales/en-US/common.json';
import enHome from './locales/en-US/home.json';
// ... 其余 en-US imports

const savedLang = localStorage.getItem('sparkflow.lang') || 'zh-CN';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': {
      common: zhCommon,
      home: zhHome,
      'experiments.hydrogen': zhHydrogen,
      // ...
    },
    'en-US': {
      common: enCommon,
      home: enHome,
      // ...
    },
  },
  lng: savedLang,
  fallbackLng: 'zh-CN',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React 已防 XSS
});

export default i18n;
```

## 5. 接口变更

### 5.1 DisplayValue 扩展（labelKey 可选字段）

文件：`src/experiments/base/`（DisplayValue 定义处）

**当前**：
```ts
interface DisplayValue {
  label: string;
  value: number | string;
  unit?: string;
  precision?: number;
}
```

**改造后**：
```ts
interface DisplayValue {
  label: string;        // 保留（fallback / 调试）
  labelKey?: string;    // 新增：i18n key（如 "experiments.refraction.angleOfIncidence"）
  value: number | string;
  unit?: string;
  precision?: number;
}
```

### 5.2 DataDisplay 改造

文件：`src/components/simulation/DataDisplay.tsx`

```tsx
const { t } = useTranslation();
// ...
<span>{item.labelKey ? t(item.labelKey) : item.label}</span>
```

**迁移策略**：渐进式。本次改造会覆盖全部 14 个实验的 getDisplayData 加 labelKey，但即使漏改也不会崩溃（fallback 到英文 label）。

### 5.3 metadata 策略

**保持不变**。`metadata.name/description/keywords` 仍为英文硬编码。

- metadata 是 ID 级数据，用于注册、路由匹配
- 翻译在 UI 层做映射（如 Home.tsx 卡片标题走 `t('home.card.{id}.title')`）
- 避免注册逻辑因语言切换出问题

## 6. 组件改造清单

### 6.1 批 1：基础设施 + 首页（必做）

| 文件 | 改动 |
|---|---|
| `src/i18n/config.ts` (新) | i18next 初始化 |
| `src/i18n/LanguageSwitcher.tsx` (新) | 中/EN 双标签按钮 |
| `src/i18n/locales/{lang}/common.json` (新) | 通用词表 |
| `src/i18n/locales/{lang}/home.json` (新) | 首页文案 |
| `src/i18n/locales/{lang}/experiments/*.json` (新) | 16 个实验 ns |
| `src/main.tsx` | 引入 i18n/config |
| `src/pages/Home.tsx` | 右上角 LanguageSwitcher + 替换全部硬编码 |

### 6.2 批 2：通用组件 + 实验层（必做）

| 文件 | 改动 | ns |
|---|---|---|
| `PlaybackControls.tsx` | Start/Pause/Resume/Reset → `t()` | common |
| `DataDisplay.tsx` | "Live Data" → `t()`；label 走 labelKey | common |
| `ControlPanel.tsx` | "Experiment Parameters" → `t()` | common |
| `SideToolbar.tsx` | 氢原子 3D 工具栏全英文 → `t()` | experiments.hydrogen |
| `BottomToolbar.tsx` | **已是中文** → 改为 `t()` | experiments.hydrogen |
| `AbstractSideToolbar.tsx` | **已是中文** → 改为 `t()` | experiments.hydrogen |
| `PendulumControlPanel.tsx` | 英文 → `t()` | experiments.pendulum |
| `Stopwatch.tsx` | 英文 → `t()` | common |
| `GravityCalculator.tsx` | 英文 → `t()` | common |
| `ScenePresetSelector.tsx` | 英文 → `t()` | experiments.mechanics |
| `ExperimentWorkbench.tsx` | 英文 → `t()` | common |
| `experiments/**//*.ts` (14 个) | `getDisplayData()` 加 labelKey | 各自 ns |
| `experiments/.../CircuitView2D.tsx` 等 2D 视图 | SVG `<text>` + 公式卡 → `t()` | 各自 ns |

### 6.3 批 3：3D 内嵌文字（**延后，本次不做**）

- `electromagnetism/synchrotron/` 的 3D TextSprite
- 其他实验 3D Canvas 内的 TextSprite

## 7. CLAUDE.md 规范变更

### 7.1 删除（旧规范）

2026-01-18 条款中"所有 UI 必须英文"相关内容全部删除。

### 7.2 新增（新规范）

```markdown
### UI 国际化规范

> [!IMPORTANT]
> **所有面向用户的界面文本必须通过 i18n 翻译键引用，禁止硬编码字面量**

1. **i18n 框架**：react-i18next + i18next
   - 翻译键集中在 `src/i18n/locales/{lang}/`
   - 组件用 `useTranslation()` hook 读取

2. **命名空间约定**
   - `common.json`：通用按钮、标题（Start/Pause/Reset 等）
   - `home.json`：首页专属文案
   - `experiments/{id}.json`：每个实验独立 ns

3. **支持语言**：中文（zh-CN，默认）+ 英文（en-US）

4. **数据接口约定**
   - 实验 `metadata.name/description/keywords` 保持英文（ID 级数据）
   - `getDisplayData()` 返回 `labelKey` 字段供 UI 翻译
   - UI 层调用 `t(labelKey)`，缺失时 fallback 到 `label`

5. **物理术语中英对照**（权威翻译，写入翻译键时遵循）

   | 中文 | English |
   |---|---|
   | 受激吸收 | Stimulated Absorption |
   | 自发辐射 | Spontaneous Emission |
   | 受激辐射 | Stimulated Emission |
   | 能级跃迁 | Energy-Level Transition |
   | 散射 | Scattering |

6. **禁止事项**
   - ❌ 在 .tsx/.ts 中硬编码用户可见字面量（中英文都不行）
   - ❌ 在 metadata.name 中放 i18n key
   - ✅ 例外：物理符号（R、C、U₀）、单位（kΩ、μF）、元素符号（Zn、Cu）、数学公式本身不翻译

7. **按钮样式**：渐变背景 + 阴影，不受 i18n 影响（保留旧规范）
```

### 7.3 变更记录追加

```markdown
### 2026-08-08 - i18n 重构（反转旧规范）

- 🔄 **反转 2026-01-18 规范**：从"必须英文"改为"必须走 i18n"
- ✨ **引入 react-i18next**：双语（zh-CN/en-US）支持，默认中文
- ✨ **按 ns 拆分翻译键**：common + home + experiments/{id}
- ✨ **DisplayValue 接口扩展**：新增 labelKey 可选字段
- ✨ **LanguageSwitcher**：首页右上角"中/EN"双标签按钮
```

## 8. 物理术语翻译参考表（权威）

供写入翻译键时参考，避免术语不一致。

### 通用 UI

| 中文 | English | 键 |
|---|---|---|
| 开始 | Start | `common.playback.start` |
| 暂停 | Pause | `common.playback.pause` |
| 继续 | Resume | `common.playback.resume` |
| 重置 | Reset | `common.playback.reset` |
| 实时数据 | Live Data | `common.data.title` |
| 实验参数 | Experiment Parameters | `common.panel.title` |

### 首页

| 中文 | English | 键 |
|---|---|---|
| 实验 | Experiments | `home.tab.experiments` |
| 课件 | Courseware | `home.tab.courseware` |
| 图片 | Images | `home.tab.images` |
| 暂无课件 | No Courseware Found | `home.empty.courseware` |
| 暂无图片 | No Image Assets Found | `home.empty.images` |
| 打开 HTML | Open HTML | `home.button.openHtml` |

### 16 个实验卡片标题

| ID | 中文 | English |
|---|---|---|
| hydrogen-transitions | 氢原子 | Hydrogen Atom |
| rutherford-scattering | 卢瑟福散射 | Rutherford Scattering |
| capacitor-charge-discharge | 电容电路 | Capacitor Circuit |
| light-refraction | 光的折射 | Light Refraction |
| double-slit-interference | 双缝干涉 | Double-Slit Interference |
| boyle-law | 玻意耳定律 | Boyle's Law |
| solar-system | 太阳系 | Solar System |
| pendulum | 单摆 | Simple Pendulum |
| spring-oscillation | 弹簧振子 | Spring Oscillation |
| motion-collision | 运动与碰撞 | Motion & Collision |
| inclined-plane-friction | 斜面摩擦 | Inclined Plane |
| uniform-circular-motion | 匀速圆周运动 | Circular Motion |
| momentum-carts | 动量小车 | Momentum Carts |
| projectile-motion | 抛体运动 | Projectile Motion |
| synchrotron-em-fields | 同步辐射电磁场 | Synchrotron Fields |
| galvanic-cell | 原电池 | Electrochemical Cell |

### 视图标签

| 中文 | English |
|---|---|
| 3D 视图 | 3D View |
| 抽象视图 | Abstract View |
| 宏观视图 | Macro View |
| 微观视图 | Micro View |

### 氢原子相关

| 中文 | English |
|---|---|
| 实验场景 | Experiment Scene |
| 受激吸收 | Stimulated Absorption |
| 自发辐射 | Spontaneous Emission |
| 受激辐射 | Stimulated Emission |
| 光子能量 | Photon Energy |
| 电子数量 | Electron Count |
| 单电子 | Single Electron |
| 多电子 | Multiple Electrons |
| 发射光子 | Emit Photon |
| 控制面板 | Control Panel |
| 实验模式 | Experiment Mode |
| 初始能级 | Initial Energy Level |
| 激发态能级 | Excited State Level |
| 能级控制面板 | Energy-Level Control Panel |
| 激发演示 | Excitation Demo |
| 入射设置 | Incident Settings |
| 入射光子 | Incident Photon |
| 入射电子 | Incident Electron |
| 入射能量 | Incident Energy |
| 重置基态 | Reset to Ground State |
| 允许二次跃迁 | Allow Secondary Transitions |
| 重置演示 | Reset Demo |
| 能量匹配 | Energy matched |
| 能量不匹配 | Energy mismatch |
| 开始实验 | Start Experiment |
| 暂停实验 | Pause Experiment |
| 重置所有状态 | Reset All States |

### 电容相关

| 中文 | English |
|---|---|
| 充电 | Charging |
| 放电 | Discharging |
| 充电时间常数 | Charging Time Constant (τ_充 / τ_charge) |
| 放电时间常数 | Discharging Time Constant (τ_放 / τ_discharge) |

## 9. 测试与验证策略

### 9.1 自动化验证

| 层级 | 工具 | 验证内容 |
|---|---|---|
| 类型检查 | `tsc -b` | DisplayValue 接口扩展不破坏 14 个实验 |
| 构建 | `vite build` | i18next 集成、JSON import、bundle 体积（<60KB 增量） |
| 现有测试 | vitest | 物理引擎测试不受影响 |

**不写新单元测试**——i18n 是 UI 层胶水，靠浏览器端到端验证更可靠。

### 9.2 浏览器端到端验证（手动 checklist）

**首页 - 中文（默认）**：
- [ ] 右上角"中 / EN"按钮，"中"高亮
- [ ] 3 个 Tab 显示"实验 / 课件 / 图片"
- [ ] 16 张卡片标题为中文
- [ ] quickView 按钮为中文
- [ ] 课件/图片 Tab 空状态中文提示

**首页 - 切英文**：
- [ ] 点 "EN" → "EN" 高亮，文案变英文
- [ ] 刷新 → 保持英文（localStorage）

**实验页 - 中文**：
- [ ] 氢原子 SideToolbar 中文
- [ ] PlaybackControls: 开始/暂停/重置
- [ ] DataDisplay: 实时数据 + 中文 label
- [ ] 氢原子 AbstractSideToolbar 中文
- [ ] 电容公式卡 τ_充/τ_放 保持中文

**实验页 - 切英文**：
- [ ] 回首页切英文，再进实验
- [ ] SideToolbar 变英文
- [ ] DataDisplay: Live Data + 英文 label
- [ ] 电容公式卡 τ_charge/τ_discharge

**回归**：
- [ ] 卢瑟福实验正常
- [ ] 力学实验参数面板正常
- [ ] 电容充放电曲线正常

### 9.3 风险与缓解

| 风险 | 缓解 |
|---|---|
| 14 个实验改 labelKey 工作量大 | labelKey 可选，未填 fallback 到 label，可分批迁移 |
| Home 卡片 title 与 metadata.name 历史不一致 | 翻译键从卡片出发，不依赖 metadata.name |
| 切语言时实验运行状态丢失 | changeLanguage 只触发重渲染，zustand store 不受影响 |
| 切语言后 3D 场景内文字不更新（批 3 未做） | 已知遗留，主路径已 i18n，可接受 |
| 公式中 τ_充 在英文环境不自然 | 翻译键 `formula.tauCharge` → 中：τ_充 / 英：τ_charge |

## 10. 范围外（明确不做）

1. **3D TextSprite 翻译**（同步辐射等实验的 3D 场景内文字）— 后续 PR
2. **懒加载 / 命名空间按需加载** — 文案总量小，全量打包更简单
3. **浏览器语言自动检测** — 用户选择优先，默认中文
4. **服务端翻译 / 第三方 API**
5. **测试代码的 i18n**（测试断言文案保持原样）
6. **代码注释翻译**（CLAUDE.md 未强制注释语言，注释不影响用户）

## 11. 后续扩展

- **新增语言**（如日文、韩文）：只需在 `src/i18n/locales/` 下加新目录 + LanguageSwitcher 增加按钮
- **新增实验**：在 `experiments/{id}.json` 加翻译键，遵循 CLAUDE.md 新规范
- **3D TextSprite i18n**：后续 PR 可让 3D Canvas 内文字也响应语言切换（需要重建 Sprite material）
- **懒加载优化**：文案膨胀到 >100KB 时再考虑按 ns 懒加载

---

**设计版本**：v1.0
**批准状态**：用户已逐节确认（架构、数据流、组件清单、CLAUDE.md 变更、测试策略）
