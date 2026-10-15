# 方案 B：Benchmark 设计文档（v0.1）

> 项目：Domain-constrained human-AI authoring of verifiable interactive physics simulations
> 工作名：**TeachPhysBench**（投稿前需做名称查重：PhysBench / PhysGym 等近似名已存在）
> 日期：2026-09-18　状态：设计稿，待试点（pilot）后修订为 v1.0 并预注册
> 上游文档：`research.md`（缺口验证与文献池）
>
> **决策记录**：2026-09-18 用户确认——研究全程只用自有 IP（本地 simcanvas skill + Claude API 链路），**智教云（ZhiJiao）平台不用于任何生成与数据**。

---

## 0. 设计原则（写进论文 Method 开头的立场）

1. **四层正确性严格分离**：L1 可执行 / L2 视觉正确 / L3 物理模型正确 / L4 教学表达正确。任何指标不得跨层合并成单一"质量分"。
2. **对称信息、不对称机制**：三条件给模型的任务信息相同，差异只在"是否有领域约束机制"（物理契约、oracle 检验、验证-修复循环）。这样才能把效应归因于框架而非信息量。
3. **同一模型、同一温度策略、全程存证**：固定模型版本并在论文中披露；每次生成的 prompt、原始输出、修复轮次、token/耗时全量入库。
4. **自动化指标与人工盲评互补，不互相替代**：自动化只测可客观判定的层（L1、L3 的可计算子集），L2/L4 及 L3 不可计算部分交人工盲评（评分者不知条件归属）。
5. **如实报告失败**：失败任务是数据，不是噪音。预计 Proposed 也有失败案例（见 run.log 58 次失败记录），全部保留。

---

## 1. 研究问题（收敛后）

- **RQ1**（可靠性）：生成式 AI 能以何种成功率把教师自然语言教学意图转化为可执行的交互物理仿真？（L1 层）
- **RQ2**（错误类型学）：生成失败与缺陷呈何种类型分布？四层正确性（执行/视觉/物理/教学）的失败率结构如何？哪些错误最隐蔽（代码能跑但物理错误）？
- **RQ3**（框架效应）：与无约束 prompting 相比，领域约束工作流在各层正确性、可修改性、修订成本上带来何种差异？
- **RQ4**（成本）：三条件的时间/token/修复轮次成本如何权衡？

（教师创作行为研究与学生学习效果 = Study 2，另行设计，本文只声明 scope。）

## 2. 条件设计（三条件）

| 条件 | 定义 | 模拟什么 |
|---|---|---|
| **A. Naive** | 单轮朴素 prompt："写一个交互式 HTML 仿真，演示 X"（教师原话，来自 topics.json 风格的真实教学意图） | 教师直接用通用 ChatGPT |
| **B. Detailed** | 同等信息的详细 prompt（把任务规格中的教学需求、参数、交互全部写进 prompt），仍为一次性生成，**不含**物理契约、验证要求、组件规范 | 会写 prompt 的教师 |
| **C. Proposed** | simcanvas 领域约束工作流：需求状态提取 → 设计门（gate 方案，脚本化自动采纳以标准化）→ 物理契约 → 实施（starter + 布局契约 + 视觉规范）→ `validate_simulation.py` + 浏览器验证 → 修复循环（**上限 2 轮**，与平台行为一致） | 完整框架 |

**公平性控制**：
- 三条件同一模型、同日期批次生成，k=3 重复/任务/条件
- C 条件的"采纳"用脚本自动采纳 gate 的第一推荐方案（复用 batch 管线的 auto-采纳逻辑），消除实验者人为选择偏差；论文中如实披露该标准化处理
- C 条件修复上限 2 轮；A/B 不给修复轮次（它们没有内建验证器可触发修复）——这本身是框架的组成部分，不是不公平
- 生成通道（**已决策 2026-09-18**）：**本地 simcanvas skill + 本机 claude CLI，全程自有 IP**。实测该 CLI 后端为 **GLM**（`--safe-mode` 最小调用返回 `unrecognized_model {"model":"glm-5.3"}` 佐证），非 Anthropic——论文模型名如实写 GLM，不得写 "Claude API"。智教云平台不用于本研究的任何生成与数据：其运行记录（run.log/state.json 的 182/58 统计、158/159 成功率、平台 DB 存证、26 个画廊产物）**一律不作为论文证据**，仅可作为内部设计参考。topics.json 中的高中物理 prompt 为用户本人撰写，属自有 IP，作为任务意图种子改写进任务规格（3.2 节），由本地链路全新生成

## 3. 任务集设计

### 3.1 规模与分层

**T = 60 任务**（自动化指标全集），人工盲评子集 T' = 30（分层抽样）。

两个分层轴（各任务标注）：

- **学科域**（6）：力学 / 电磁学 / 振动波动与光学 / 热学 / 原子物理 / 实验测量
- **模型风险层**（4，对应 skill 的 6 级路由裁剪为可操作 4 档）：
  - `qualitative`（定性演示，无定量规律）
  - `analytic`（有解析解，如匀加速、折射、能级跃迁）
  - `continuous-ode`（数值积分，如 RC 电路、阻尼振动）
  - `event-contact`（碰撞/接触/约束，如滑块-木板、动量守恒）

平衡目标：6 域 × 4 层的可行组合各 ≥2 题（共 ≥48），余量给高难组合。**实验测量域是差异化重点**（伏安法、单摆测 g 等——测量误差与读数是教学独有需求，现有仿真生成研究未覆盖）。

### 3.2 任务来源

- 24 个现有 topics.json 高中物理条目（力学 11 / 电磁 6 / 原子 3 / 热 2 / 光 2）改写为任务规格（保留教师原话风格作为意图 prompt）
- 新增 ~36 个：补热学/光学/实验测量的薄层 + 高难组合 + 每域至少 1 个"易错陷阱"任务（内置常见 misconception，如磁感线闭合、超失重、感应电流方向）

### 3.3 任务规格 schema（每任务一份 YAML，进入版本库）

```yaml
task_id: mech-block-plank-01
domain: mechanics
model_tier: event-contact
title_en: "Block-on-plank with friction and relative sliding"
teacher_intent: |          # 教师自然语言原话（A 条件直接用）
  演示滑块在木板上的相对滑动……可调摩擦系数和初速度，
  实时显示 v-t 图……
detailed_spec: |           # B 条件：同等信息量的详细 prompt（无框架知识）
  [交互清单][参数表][显示要求][教学要点]，纯文本，不含验证要求
physics_verification:      # C 条件的 oracle（也是 L3 自动化判据来源）
  invariants: [momentum_conservation_before_after_collision]
  analytic_cases:
    - { setup: "mu=0, m1=m2", expect: "elastic transfer, v1'=0, v2'=v1" }
  limiting_behavior:
    - { setup: "mu->large", expect: "immediate common velocity" }
  numerical_tolerance: { rtol: 0.02, atol: 1e-3 }
functional_requirements: [slider_mu, slider_v0, v_t_graph, play_pause, reset]
pedagogical_requirements: [show_relative_sliding_phase, highlight_friction_force_direction]
misconception_trap: "滑块不会穿入地面；两者速度图线在共速点相交后重合"
rating_notes: "评分者重点核查共速后是否共同减速"
difficulty: hard
source: rewritten_from_topics_json | new
```

**说明**：`physics_verification` 的设计工作量最大（每任务需写解析特例/守恒律/极限行为），这是 benchmark 的核心资产——任务不是 prompt，是 **prompt + 可验证断言**。 pilot 阶段先做 10 个验证可行性，估计每任务 20-40 分钟设计成本。

## 4. 指标体系与 Rubric

### 4.1 指标总表（四层映射）

| 维度 | 层 | 测法 | 工具/判据 |
|---|---|---|---|
| D1 execution success | L1 | **自动** | Playwright 无头加载 10s，console 0 error；控件可点击 |
| D2 offline/self-contained | L1 | **自动** | 无外部请求；单文件 |
| D3 functional completeness | L1→L3 | **人工** | 必需交互清单逐项核对（checklist 计分） |
| D4 physical-model correctness | L3 | **自动+人工** | 自动：oracle 断言（仅对暴露 `window.simulation` 契约的产物可插桩——此不对称性如实报告，并作为"可仪器化性"发现）；人工：物理教师判断规律表现 |
| D5 numerical correctness | L3 | **自动+人工** | 解析特例数值比对（rtol 2%）；无插桩接口时人工读数比对 |
| D6 interaction correctness | L3 | **人工** | 参数-响应因果正确（调 μ 滑得远、调 v₀ 图线变化正确） |
| D7 visual correctness | L2 | **人工** | 表征无物理性误导（矢量方向、场线闭合、图形同步）——注意这不是"美观" |
| D8 visual clarity | L2 | **人工** | 层次、可读性、遮挡 |
| D9 pedagogical appropriateness | L4 | **人工** | 教学序列、可观察状态、错误概念规避、标注语言 |
| D10 editability | 横切 | **自动代理+人工** | 代理：文件结构/token 化清晰度；人工：教师"能否找到改参数的地方"（1-5） |
| 成本 | — | **自动** | wall time、token 数、修复轮次、对话轮数 |

### 4.2 人工盲评 Rubric（D3-D10 通用锚点，1-5）

| 分 | 通用锚点 |
|---|---|
| 5 | 完全达标，无缺陷，可直接上课用 |
| 4 | 达标，有轻微瑕疵，不影响教学 |
| 3 | 基本达标，存在一处明显但可容忍的缺陷 |
| 2 | 严重缺陷（物理错误/关键交互缺失/严重误导），需大改 |
| 1 | 不可用（不可执行核心功能/根本性物理错误） |

每维度配任务级 `rating_notes` 具体化锚点（见 3.3 schema）。**D4/D7 的"通过但物理错误"案例需评分者强制填写自由文本描述**——这是 RQ2 错误类型学的原始数据。

### 4.3 评分者与信度

- 3 名评分者：2 名高中物理教师（同事，非项目参与者）+ 作者本人（论文中披露）
- **盲评**：产物随机编号、去条件标识、跨条件交叉分发；作者评分在两位教师之后独立进行
- 信度：每个维度报告 **Krippendorff's α**（ordinal）+ 成对 Cohen's κ（加权）；α<0.667 的维度报告分歧分析而不强行合并
- Rubric 与分析计划在评分前**预注册**（OSF）并冻结版本

## 5. 数据采集表（五个 schema，全部 JSON Lines 入库）

**① generation_log.jsonl**（每次生成一行）
`{run_id, task_id, condition, repeat_idx, model_id, model_version, channel, timestamp, prompts_full, n_turns, n_repair_rounds, wall_time_s, tokens_in, tokens_out, outcome}`

**② artifact_registry.jsonl**
`{artifact_id, run_id, file_hash, path, bytes, single_file, external_requests[], injected_hooks[], skill_version, starter_version}`

**③ automated_metrics.jsonl**
`{artifact_id, d1_execution_pass, d1_console_errors, d2_offline_pass, oracle_checks[{name, setup, expected, observed, pass}], instrumentable: bool, d10_proxy{size_kb, structure_score}}`

**④ human_ratings.jsonl**
`{artifact_id, rater_id, d3..d10 scores, forced_free_text_on_d4_d7_fail, time_spent_min}`

**⑤ repair_events.jsonl**
`{run_id, round, trigger(validation_error|browser_check|oracle_fail), diagnosis, action_taken, resolved}`

存放：`social-publish/research/teachphysbench/`（git 管理，敏感信息不入库）；发表时产物全集 + 任务规格 Zenodo 存档发 DOI。

## 6. 统计分析计划（评分前冻结）

- 各维度通过率/均分 + **Wilson 95% CI**，按 条件 × 学科域 × 模型层 分层呈现
- 二元指标（D1/D2/通过-不通过）三条件配对：**Cochran's Q**，显著后 pairwise McNemar + Holm 校正
- 等级评分（D3-D10）三条件配对：**Friedman 检验** + pairwise Wilcoxon signed-rank（Holm）+ 效应量（rank-biserial）
- **RQ2 错误类型学**：四层失败率结构 + "L1 通过但 L3 失败"的隐蔽错误率（核心指标：deceptive success rate）+ 自由文本编码归类（两位编码者，报告一致性）
- 成本-质量散点（每条件的 Pareto 前沿图）
- 敏感性：任务难度、模型层作为协变量的分层复查；如资源允许，第二个模型上复现 20 任务子集
- 预先声明不做的：不做结构方程/深度学习类分析；样本量以任务为单元（n=60 自动 / n=30 人工），不冒充大样本

## 7. 执行时间线（约 12 周至投稿）

| 周 | 里程碑 |
|---|---|
| 1 | 任务规格 10 个试点 + rubric v0.9 + 生成链路打通（条件 A/B/C 各跑 10 任务） |
| 2 | 试点分析：oracle 可计算率、盲评可行性 → 修订 v1.0 + **OSF 预注册** |
| 3-4 | 60 任务规格完成；全量生成（60×3×3=540 次，batch 基建复用） |
| 5-6 | 自动化指标跑完；30 任务盲评子集分发评分（3 评分者 × 90 产物） |
| 7-8 | 信度计算、统计、错误类型编码 |
| 9-11 | 英文论文写作（结构按方案 B 大纲，Study 2 标注 future work） |
| 12 | 内部审稿（academic-paper-reviewer skill）+ 投稿（首选 IJAIED，备选 CAEAI / BJET） |

## 8. 风险登记

| 风险 | 概率 | 缓解 |
|---|---|---|
| oracle 断言可计算率低（多数任务无法自动化 L3） | 中 | pilot 优先验证；不足则 L3 以人工为主、自动化为辅，如实报告 |
| 评分者负担超预期 | 中 | 子集设计已压缩到 90 产物/人；必要时降至 25 任务 |
| C 条件与 A/B 的 agentic 差异被审稿人质疑"不公平" | 中 | 论文明确定位：比较的是**工作流**而非单次推理；补充 B+（详细 prompt + 相同修复轮次机会）的敏感性子集（20 任务） |
| 单模型结果外推性 | 低-中 | 披露 + 第二模型子集复现 |
| 名称撞车（PhysBench 等） | 低 | 投稿前查重改名 |

## 9. 待用户决策的执行项

1. ~~生成通道~~ **已决策（2026-09-18）**：本地 simcanvas skill + Claude API，自有 IP，排除智教云平台
2. ~~**模型与预算**~~ **pilot 已决策（2026-09-18）：GLM**（本机 claude CLI 订阅通道，零现金；harness 记录响应内 model id 以便论文如实标注）。全量 540 次的模型是否仍用 GLM、以及若换 Anthropic/其他 API 的预算授权，pilot 结束后复核
3. **评分者人选**：2 名同事物理教师是否可落实（需约每人 25-30 小时，分 2-3 周）
4. **是否 OSF 预注册**（推荐：是，IJAIED/BJET 对预注册无硬性要求但有加分）
5. **任务集批准**：24 个现有题目改写 + 36 新题的分工（我可以先产出 60 个任务规格草案供你逐个审定——物理断言必须由你终审，这是学科责任，不可委托给 AI）
