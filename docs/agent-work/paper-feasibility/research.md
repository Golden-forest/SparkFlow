# 论文方向可行性调研报告

> 调研日期：2026-09-18
> 方法：deep-research skill（lit-review 模式）+ 双线系统实地审计（代码 + 生成管线）
> 数据来源：5 个并行调研 agent —— 仓库审计、simcanvas 管线审计、国际仿真生成文献（arXiv/OpenAlex/Crossref 活检索）、教师-AI 协同文献（58 轮活检索）、中文期刊+JOSS 要求核查
> 诚信声明：所有文献均经在线核验，未验证条目已单列剔除；系统数据来自本地文件与 git 历史实查。

---

## 一、总结论（先看这里）

**四方案可行性排序：B > A > C(AIED) > D(JOSS)**

| 方案 | 判定 | 核心理由 |
|---|---|---|
| **B 国际期刊**（benchmark + 框架） | ✅ **立即可做，首选** | 研究缺口实证成立；159 任务语料 + 失败/修复记录是现成实证基底；无需人类被试即可完成 Study 1 |
| **A 中文核心**（机制 + 设计型研究） | ✅ **可并行，次快** | 中文文献确证空白（物理教学期刊零 GenAI 仿真论文）；"资源创生"概念有 2020 年锚点可承接；需补专家评价数据 |
| **C 顶会** | ⚠️ AIED 可行（2027），CHI 风险高 | SimStep 已登 CHI 2026 占位；CHI 2027 截稿临近且需强用户研究；AIED 更匹配学科正确性主题，需补教师研究 |
| **D JOSS** | ❌ **暂缓，但今天就该启动整改** | 2026-01 新政（≥6 个月连续公开开发史 + 研究影响证据 + 防 vibe-coding 审查）使"现在投"必被拒；正确姿势是 B 论文成为其"研究影响"证据后再投 |

**战略定位：这不是四篇独立论文，而是一条研究流水线。**
同一核心资产（simcanvas 领域约束知识 + 两阶段生成管线 + 159 任务语料 + 四层正确性框架）依次产出：
B（benchmark 论文，~2-3 个月）→ A（中文机制论文，并行）→ C-AIED（教师研究论文，2027 初）→ D（JOSS 软件论文，2027 中）。

---

## 二、研究客体盘点（系统审计结论）

### 2.1 你实际拥有的系统（三层结构）

```
第一层：simcanvas skill（~/.claude/skills/simcanvas，30 文件 ~2700 行）
  = 领域约束知识库：6 级模型风险路由 + 10 类 oracle 检验 + 物理契约模板
    + 设计门协议 + 布局契约 + 视觉基线 + validate_simulation.py 确定性校验
第二层：ZhiJiao 平台（~/Projects/ZhiJiao，FastAPI+React，为公司构建）
  = 生成引擎：两阶段生成（gate 采纳确认 → 实施 temp 0.45）
    + validate_contract() 契约校验 + 自动修复 pass（temp 0.2 回灌校验 JSON）
    + SQLite 全量存证（prompt/html/provider/model/version/validation_json/时间戳）
第三层：SparkFlow（本仓库，React+Three.js，16 实验插件架构）
  = 托管与展示层：public/simcanvas/ 26 个精选产物 + manifest 自动索引
```

### 2.2 现有实证资产（可直接入论文的证据）

| 资产 | 规模 | 研究价值 |
|---|---|---|
| topics.json 选题库 | 159 个（含中文自然语言 prompt + 分类 + 26 featured + 11 条 failure feedback） | benchmark 任务池 + 错误类型学种子 |
| run.log 生成记录 | 182 次成功 vs 58 次失败（2026-08-21~08-28） | 成功率、重试模式、失败分类 |
| 平台侧生成总数 | 158/159 选题成功生成 | ⚠️ 这是"契约通过率"，**不是物理正确率**，论文中严禁混用 |
| 错误修复记录 | 11 条 feedback（磁感线不回 S 极=物理错误；滑块穿地=数值错误；shadowBlur=工程错误；snells-window 3 败重写=prompt 错误） | RQ2 错误类型学的真实案例 |
| 版本迭代记录 | v1→v2→v3（phyllotaxis2），156 题 v1 / 1 题 v2 / 1 题 v3 | 迭代行为证据（但多数迭代走新 id 而非 version 递增） |
| 可复现元数据 | 平台 DB 存 prompt+html+model+validation_json；本地 meta.json 可按 id 关联回 prompt | 可复现性设计的基础设施已存在 |

### 2.3 必须正视的三个事实（写论文的红线）

1. **SparkFlow 应用本身无运行时 AI**。`src/`、`functions/` 只有访问授权门。AI 证据链在开发工作流与 simcanvas/ZhiJiao 管线中。论文表述必须是"AI 辅助创生工作流及其产物"，不是"内嵌 AI 的系统"。
2. **158/159 成功 = 契约校验通过**，其中至少 1 例（dipole-field-3d）存在物理错误（磁感线未闭合）——这恰好是论文核心论点"executable ≠ physically correct"的自家证据，但**绝不能**把 158/159 表述为"物理正确率 99.4%"。
3. **CLAUDE.md 中"JSON 配置驱动实验"未实现**（唯一 config.json 无人 import）。引用项目文档时勿把愿景当已实现功能。

### 2.4 归属权风险（投稿前必须解决，适用于全部方案）

> **✅ 已决策（2026-09-18）**：用户确认研究全程只用自有 IP——本地 simcanvas skill + Claude API 链路；**智教云（ZhiJiao）平台及其数据一律不用**。以下风险随该决策解除：

- ~~ZhiJiao 平台部署于公司域名（stu25.space.aiec.wflaiedu.com），LLM 走企业网关（TokenHub，模型自动选择）。**用平台数据发表论文需公司书面许可**~~ → **解除**：平台运行记录（run.log/state.json 的 182/58 统计、158/159 成功率、平台 DB 存证、26 个画廊产物）不作为论文证据，benchmark 数据由本地链路全新生成；2.2 节表中"平台侧生成总数"等条目相应降级为内部设计参考。
- simcanvas skill 的 IP 归属取决于与公司的雇佣/合作约定，需自行确认（若 skill 曾交付公司 vendor 使用，建议留存自己早于交付的版本证据）。
- 论文必须披露具体模型与版本（本地链路下从 generation_log 的 model_version 字段取）。

---

## 三、文献缺口验证结果

### 3.1 核心缺口陈述（三重交集为空，可写入论文）

> **教师创作工作流 × 可执行交互仿真生成 × 学科（物理）正确性约束** —— 经验证的 2022–2026 国际文献与 2023–2026 中文文献中，该交集均为空白。

支撑证据（全部经活检索核验）：
- arXiv 全库 `PhET + language model` 仅 1 篇（SimPal，不生成仿真本体）；`text-to-simulation` 10 条 0 相关；`interactive textbook + LLM` 0 条
- Yan et al. 2024 (BJET) 的 53 用途九分类 taxonomy 无"仿真生成"类目
- 中文四本物理教学期刊（《物理教学》《物理教师》《物理通报》《中学物理》）在检索覆盖范围内**零 GenAI 论文**；已有"教师用 AI 生成网页课件"论文（2026，知网核验）但学科是信息科技/工程实践，非物理仿真
- "资源创生"概念在中文文献已存在（李永智等 2020《教育传播与技术》，承接"课程资源创生"传统），但含义是"教师使用中创造性改编"，非"GenAI 批量创生交互式数字资源"——概念可承接、需重新定义，这是方案 A 的理论切入点

### 3.2 三篇必须精确对标的最近邻

| 工作 | 出处 | 它做了什么 | 你的差异点（写进 Related Work） |
|---|---|---|---|
| **SimStep** (Kaputa et al.) | **CHI 2026**, DOI 10.1145/3772318.3791514（预印本 arXiv:2507.09664） | 教师经四层教学抽象（Concept/Scenario/Learning Goal/UI Graph）人机循环创作仿真，含 educator 评测 | 其约束是**教学法抽象**，无物理定律正确性验证、无 oracle 检验、无定量物理核验；你有物理契约 + 6 级模型路由 + runModelChecks + 错误类型学实证 |
| **LivePhys** (Dai et al. 2026) | arXiv:2607.20990 | 教科书静态物理题→可执行仿真（scan-to-play），physics-aware 中间表示 | **学生侧转换已有题目** vs 你的教师侧从教学意图创生；其正确性来自人工构建引擎而非对生成物的验证 |
| **Shende & Camburn 2026** | arXiv:2602.12311 | 自然语言→物理仿真代码 + VLM 视觉自反思验证 | 无教育/教师情境；验证是"看起来合理"的感知判断，非守恒律/解析解等定量 oracle |

次近邻（划界用）：SimPal (L@S 2024, 教师重设已有仿真目标)、Karpodinis & Kalles 2026 (虚拟实验流程规划 + LLM 可靠性警告)、WorldCoder-Bench 2026 (可执行 3D 世界合成基准，无教育情境)、WebGen-Bench 2025 (网站生成 + 自动功能测试的评测范式，可借用其方法论)、FlowCheck (LMPL'26, vibe-coded 应用验证)。

### 3.3 可直接使用的理论与方法文献（均已核验）

- **理论框架**：Liang et al. 2026 (BJET, DOI 10.1111/bjet.70055) AIED-HCD 框架（人类控制 × AI 自动化二维象限）——其结论"高人类控制×高 AI 自动化模式正在兴起"与你的设计门+采纳机制精确对应
- **领域现状 taxonomy**：Yan et al. 2024 (BJET, DOI 10.1111/bjet.13370) 九分类 53 用途
- **共创实验范式**：Maier et al. CHI 2026 (DOI 10.1145/3772318.3791185, model-led vs human-led)；Calo & MacLellan L@S 2024 (DOI 10.1145/3657604.3664694, 教师驱动 tutor 生成)
- **教师信任与核验**：Park et al. 2025 (CAEAI, DOI 10.1016/j.caeai.2025.100487, "批判性评估 AI 输出"是普遍弱项)；Han et al. CHI EA 2024（教师对作者身份/错误信息的担忧）
- **教师备课 GenAI 实证**（方案 A 引用池）：Lee et al. 2024 (IEEE TLT, DOI 10.1109/tlt.2024.3401457)；Sun et al. 2025 (JCAL, DOI 10.1111/jcal.70098)；Şimşek et al. 2025 (EAIT, DOI 10.1007/s10639-024-13258-x)；Küchemann et al. 2023 (PRPER, DOI 10.1103/PhysRevPhysEducRes.19.020128, 物理教师用 ChatGPT 编题)
- **中文文献**（方案 A 引用池，知网核验）：吴军其等 2023《中国电化教育》(05)；祝智庭等 2023《电化教育研究》(06)；卢宇等 2023《电化教育研究》(06)；余胜泉、熊莎莎 2024《开放教育研究》(01)；李锋等 2024《中国电化教育》(12)；李永智等 2020《教育传播与技术》(05, "资源创生"概念锚点)；秦丹、张立新 2020《电化教育研究》(11, 人机协同教师角色)；于浩然、吴文涛 2024《中小学电教》(06, GenAI 数字教育资源开发策略)

### 3.4 勘误记录（你的方案书里要改的）

- WorldCoder 真实作者为 **Hao Tang, Darren Key, Kevin Ellis** (Cornell, arXiv:2402.12275)，不是 "Torchinsky"
- SciCode 正确 ID：arXiv:2407.13168；Sketch2Code 正确 ID：arXiv:2410.16232
- "GenUTOR" 不存在（三库 0 命中），勿引用

---

## 四、四方案详细可行性分析

### 方案 B：国际期刊（首选，立即可做）

**判定：✅ 马上开工。这是唯一一个"不需要新的人类被试数据就能完成核心 Study"的方案。**

- **缺口**：实证成立（见 3.1），且 SimStep 的存在反而证明了领域热度，期刊编辑不会质疑选题冷门。
- **已有证据**：159 任务池、两阶段管线、验证基础设施、错误案例。缺的是**受控重跑**（现有语料是观察性的：单一条件、prompt 不一致、平台自动修复混淆变量）。
- **Study 1 设计（可直接执行）**：
  - 任务集：从高中物理子集（力学 11 + 电磁 6 + 原子 3 + 热 2 + 光 2 = 24 个现有 + 新增至 40-60 个，覆盖五大学科）
  - 三条件：Baseline A（朴素 prompt）/ Baseline B（详细 prompt）/ Proposed（simcanvas 领域约束工作流）
  - 每任务每条件重复 k=3；固定模型并披露版本
  - 评分：八维 rubric（execution success / functional completeness / physical correctness / numerical correctness / interaction correctness / pedagogical appropriateness / visual clarity / editability）——前四维可部分自动化（node 无错运行、runModelChecks、oracle 检查），后四维需人工
  - 评分者：2-3 名物理教师独立盲评（评分者不知条件归属），报告 Cohen's κ / Krippendorff's α
  - 统计：描述统计 + Wilson CI + 配对比较（Cochran's Q / McNemar），不乱上高级模型
- **目标期刊**（按匹配度）：IJAIED (International Journal of AI in Education)、Computers & Education: Artificial Intelligence、BJET、ETR&D
- **风险与对策**：
  - 自评自系统 → 确认偏倚质疑 ⇒ 评分者盲评 + 预注册 rubric + 如实报告失败案例（你有真实失败记录，这是可信度资产）
  - 单模型混淆 ⇒ 固定模型披露；理想时在第二个模型上复现子集
  - Study 2（教师创作研究）无数据 ⇒ 明确标注【Future empirical study / data required】，不做任何模拟
- **时间估算**：生成（batch 基建现成）1-2 周 + 评分 2-4 周（瓶颈）+ 写作 3-4 周 ≈ **2-3 个月可投**

### 方案 A：中文核心（可并行，注意与 B 的切分）

**判定：✅ 可行，且是"教师身份 + 真实系统"优势最大化的通道。**

- **缺口**：中文确证空白；"资源创生"有 2020 概念锚点（李永智等），你的"从资源调用到资源创生"叙事有文献落点
- **方法组合**（按你的实际数据）：设计型研究（DBR）+ 系统案例 + 专家评价。RQ1-RQ3 可写；**RQ4（教师使用效果变化）必须标【待补数据】**
- **必须补采**：3-5 名专家（物理教研员/教育技术专家）对生成资源的结构化评价（量规 + 半结构化评语）；如有条件，2-3 名同事教师试用并访谈
- **期刊定位**：《中国电化教育》《电化教育研究》（CSSCI，审稿 3-6 个月，录用难，但正对口 3.3 节引用池）；《现代教育技术》（北大核心/CSSCI 扩，相对快）；若走学科路线《物理教学》《物理教师》（北大核心，应用型，L3 核查显示这些期刊尚无 GenAI 论文——是空白也是先发机会）
- **"国内顶会"澄清**：教育技术领域国内没有严格意义的顶会，顶级发表渠道就是上述 CSSCI 期刊；会议（如 GCCSE/GCCCE）影响力不足以支撑"顶会"目标。**你说的"国内顶会"实际就是方案 A 的期刊**
- **与 B 的切分（防一稿多投/切香肠质疑）**：A 写"机制模型 + DBR + 专家评价"（理论贡献：教师-AI-学科约束三元协同），B 写"benchmark + 框架 + 错误类型学"（实证贡献）。两篇引用同一系统但不重复发表同一数据；A 引用 B（如 B 先挂 arXiv 预印本）

### 方案 C：顶会（AIED 2027 可行，CHI 高风险）

**判定：⚠️ 重定位后可行——从 CHI 转向 AIED。**

- **CHI 风险**：SimStep（CHI 2026, Stanford HCI 组）+ Maier et al.（CHI 2026）刚占位；CHI 2027 截稿周期临近（需核实，按惯例一轮截稿在 9 月，可能已过）。要在 CHI 2027 再进同空间需要非常强的用户研究
- **AIED 机会**：AIED 更看重学科正确性与教学工具有效性，你的"物理约束 + 验证 + 教师工作流"是 AIED 正统问题。AIED 2027 截稿按惯例在年初（需核实）
- **收敛后的研究问题**（区别于 SimStep）：**领域验证机制如何改变教师的信任校准与修复行为**——"executable ≠ correct"、"教师会否因代码能跑而误信物理正确"、"结构化验证是否建立 calibrated trust"。SimStep 没有这个问题意识
- **用户研究最低配置**：8-15 名在职物理教师，2-3 条件（自由 prompt / 结构化工作流 / 结构化+自动验证），完成任务时记录 time/prompts/repair cycles/error detection/think-aloud + 访谈。需要知情同意与伦理声明
- **时间**：2026-10 ~ 12 完成研究（利用教研网络），2027 初投 AIED。**前提是 B 的 benchmark 先行铺路**
- 骨架中的 Findings 全部留占位符，不预设结论

### 方案 D：JOSS（暂缓投稿，立即启动整改）

**判定：❌ 现在投必被拒（新政硬门槛），但整改动作今天就该做，投稿窗口在 2027。**

2026-01 新政四道预审硬门槛（任一不过即 desk reject）：
1. **公开开发史 >6 个月且提交分布连续**（有自动化检查，"repo dump 不是开发史"）——SparkFlow 仓库 2025-12 至今 166 commits 达标 ✅；但若抽出新包则历史清零 ⚠️（对策：monorepo 内包化，或在 paper.md 中说明抽取自 SparkFlow 的 commit 谱系）
2. **已证实的科研使用**（至少作者自用 + 理想的外部采用）——目前 ❌；**B 论文本身可成为此证据**（论文用该工具集做分析）→ 这就是"B 先行、D 殿后"的因果链
3. **开源实践**——无 LICENSE ❌（且法律上当前无人可复用你的代码）、无测试入口 ❌（7 个 node:test 物理测试写了但没有任何 script/CI 跑）、无英文文档 ❌、无 CONTRIBUTING/CHANGELOG ❌
4. **迭代式开发而非集中爆发**——git 历史形态需检查 ⚠️

其他 JOSS 要点（2026-09 实抓）：Web 软件须暴露可本地测试的 core library（Web 壳 + PyPI/npm 核心 = 合规路径 ①）；paper.md 750-1750 词必含 AI usage disclosure；**明确盯防 vibe-coding 式提交**（允许 AI 代码但需披露 + 人类核心设计决策叙事 + 测试）；docs 域名已迁移（joss.readthedocs.io，旧的 the-docs.org 已 NXDOMAIN）。

**可开源客体界定**（与归属权风险联动）：最有资格成为 JOSS 软件的是"物理仿真验证工具集"——validate_simulation.py + 物理契约/oracle 检查框架 + 评分 rubric 工具化 + 仿真脚手架，而非 SparkFlow 网站本身。抽取方案：`*Physics.ts`（7 个零依赖纯模块）+ `utils/math` + `base/` + simcanvas 的校验脚本打包。

---

## 五、必须补采的数据清单（按优先级）

### P0 — Study 1 benchmark（方案 B 核心，无人类被试）
| 数据 | 采集方式 | 备注 |
|---|---|---|
| 受控三条件生成结果 | 40-60 任务 × 3 条件 × k=3，固定模型 | batch 基建现成；需公司许可或改本地 skill 链路 |
| 自动指标 | 无错运行率、runModelChecks 通过率、oracle 检查（守恒/解析特例） | 部分已有工具 |
| 人工盲评 | 2-3 名物理教师，八维 rubric，不知条件 | 计算 inter-rater reliability |
| 失败案例档案 | 每个失败/错误任务的诊断记录 | 你已有 11 条 feedback 作种子 |

### P1 — 专家评价（方案 A 需要）
3-5 名专家结构化评价 8-12 个代表性生成资源（量规：物理正确性/教学适切性/交互性/视觉表达 + 评语）。

### P2 — 教师研究（方案 C / 方案 B Study 2 / 方案 A RQ4）
8-15 名教师任务式会话 + 出声思维 + 访谈；记录 time/prompts/repair cycles/error detection。需知情同意。**在 P0 完成前不要启动。**

### P3 — 课堂/学生数据（所有方案的 RQ5/效果研究）
当前无条件采集，一律标【待补数据】。不虚构。

---

## 六、立即执行清单（本周可做）

1. ~~**解决归属权**~~ **✅ 已解决（2026-09-18）**：自有 IP 路线，排除智教云平台
2. **方案 B 立项**：定任务集（先圈定高中物理子集）、写八维 rubric v0、定三条件 prompt 协议（详见 `plan-b-benchmark-design.md`，待用户审定）
3. **JOSS 整改（不投稿，只整改）**：加 LICENSE（MIT）、package.json 加 `test` script（`node --test`）并把 lint/typecheck/test 加进 deploy.yml、清根目录 43 个 TASK-* 杂物、英文 README
4. **证据归档**：~~平台 DB 导出快照~~（已排除）→ 改为：本地研究数据目录建立（`social-publish/research/teachphysbench/`），topics.json 中高中物理 prompt 备份留存（自有 IP 的任务意图种子）
5. **文献去重落地**：本报告 3.3 节引用池导入文献管理工具；3.4 节勘误改正你的方案书

---

## 七、遗留核查项（诚实边界）

- 本调研的中文检索非 CNKI 全库（新版知网反爬），**方案 A 投稿前需在 CNKI 高级检索做最终查新**（"生成式 AND 仿真 AND 物理"、"AIGC AND 虚拟实验"）
- L3 表 #17/#18/#19（2026 交互式网页教学论文）作者行未完整捕获，引用前需知网复核
- 荆洲、杨启光 2024《中国电化教育》一文未能在知网定位到稳定文章页，**引用前必须复核**（低置信）
- CHI 2027 / AIED 2027 具体截稿日期未核验，规划前需查官网
- 荆州市之外：2026 年最新会议（CHI/UIST 2026 正式 proceedings）可能有少量未同步到索引的条目，写作时补充检索
- WebSearch 通道当日限流，文献验证走了 arXiv/OpenAlex/Crossref API 与知网旧站直连；期刊全文库（ACM DL 站内、IEEE Xplore 站内）未逐库扫查

## 八、完整核验文献附录

（全部经 agent 活检索核验；此处列关键条目，完整注释见各 agent 报告已并入本文件上文）

**仿真/可执行制品生成**：SimStep (CHI 2026, 10.1145/3772318.3791514 / arXiv:2507.09664) · LivePhys (arXiv:2607.20990) · Shende & Camburn (arXiv:2602.12311) · PhysGym (arXiv:2507.15550) · WorldCoder (Tang/Key/Ellis, arXiv:2402.12275) · WorldCoder-Bench (arXiv:2606.01869) · MPMWorlds (arXiv:2606.01538) · ByteSized32 (EMNLP 2023, arXiv:2305.14879) · Word2World (arXiv:2405.06686) · Genie (arXiv:2402.15391) · GameNGen (ICLR 2025, arXiv:2408.14837) · Eureka (ICLR 2024, arXiv:2310.12931) · Voyager (arXiv:2305.16291)

**Prompt-to-app / 网页生成**：Design2Code (NAACL 2025, arXiv:2403.03163) · Web2Code (NeurIPS 2024 D&B, arXiv:2406.20098) · Sketch2Code (arXiv:2410.16232) · WebSight (arXiv:2403.09029) · WebGen-Bench (arXiv:2505.03733) · FlowCheck (LMPL'26, arXiv:2608.28880)

**Vibe coding**：Zeng et al. (arXiv:2608.29550, 78 人实证) · Michels et al. (arXiv:2608.20446, 综述) · Chow & Ng (Medical Teacher 2025, 10.1080/0142159X.2025.2488353) · Mitchell & Shaaban (SIGPLAN LMPL 2025, 10.1145/3759425.3763390)

**教师×GenAI 创作**：Calo & MacLellan (L@S 2024, 10.1145/3657604.3664694) · SimPal (L@S 2024, 10.1145/3657604.3664695) · Demirtaş et al. (AIED 2026, 10.1007/978-3-032-29760-0_50) · Yang et al. (arXiv:2603.03644) · Maier et al. (CHI 2026, 10.1145/3772318.3791185) · Han et al. (CHI EA 2024, 10.1145/3613904.3642438) · Lee et al. (IEEE TLT 2024, 10.1109/tlt.2024.3401457) · Sun et al. (JCAL 2025, 10.1111/jcal.70098) · Şimşek et al. (EAIT 2025, 10.1007/s10639-024-13258-x) · Küchemann et al. (PRPER 2023, 10.1103/PhysRevPhysEducRes.19.020128) · Brott et al. (Chem Teacher Int 2026, 10.1515/cti-2026-0002) · Karpodinis & Kalles (arXiv:2605.26333)

**综述/理论**：Yan et al. (BJET 2024, 10.1111/bjet.13370) · Liang et al. (BJET 2026, 10.1111/bjet.70055) · Park et al. (CAEAI 2025, 10.1016/j.caeai.2025.100487) · Bond et al. (IJETHE 2024, 10.1186/s41239-023-00436-z)

**物理教育 LLM 正确性**：Polverini & Gregorcic (Eur. J. Phys. 2024, 10.1088/1361-6404/ad1420) · Polverini et al. (arXiv:2412.10019) · Pimbblet & Morrell (arXiv:2412.01312) · Kieser et al. (PRPER 2023, arXiv:2307.14475) · SciCode (arXiv:2407.13168) · SciCode-Verified (arXiv:2608.04975) · LLM-as-judge (arXiv:2603.14732)

**中文**：吴军其等 (中国电化教育 2023(05)) · 祝智庭等 (电化教育研究 2023(06)) · 卢宇等 (电化教育研究 2023(06)) · 余胜泉、熊莎莎 (开放教育研究 2024(01)) · 李锋等 (中国电化教育 2024(12)) · 李永智等 (教育传播与技术 2020(05)) · 秦丹、张立新 (电化教育研究 2020(11)) · 周洪宇、李宇阳 (华东师大学报教科版 2023(07)) · 王欣颖、柳晨晨 (电化教育研究 2024(10)) · 于浩然、吴文涛 (中小学电教 2024(06))
