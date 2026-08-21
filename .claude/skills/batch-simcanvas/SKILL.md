---
name: batch-simcanvas
description: Use when batch-generating canvas animations via the SimCanvas API (adding topics, running batch_gen.py, or iterating on a generated animation)
---

# batch-simcanvas — SimCanvas 批量动画生成

## 背景与定位

- 通过 SimCanvas 平台 API 批量生成动画（生成消耗平台的 token，不是本地）。
- 当前 API 平台 `http://stu25.space.aiec.wflaiedu.com` 是**暂用的一方平台**（用户为该公司开发的）；未来会迁移到用户自己的产品级平台，届时需改 `BASE` 和鉴权方式。
- **禁止为单次任务新写一次性脚本**：批量用现有 `batch_gen.py`，迭代修改也走已有通道（见下）。

## 文件位置（方法与数据分离）

- 脚本：`social-publish/batch-gen/batch_gen.py`（稳定复用，只在暴露真实缺陷时改）
- 提示词库：`social-publish/batch-gen/topics.json`（追加式；好提示词原样保留当模板，差的加 `feedback` 字段记翻车原因）
- 运行状态：`state.json`（可续跑）、`run.log`
- cookie：引用 `~/.claude/skills/publish-simvideo/secrets.json` 的 `simcanvas_session`（勿输出/提交）

## 运行

```bash
cd social-publish/batch-gen
export PATH="$(pyenv root)/versions/3.11.9/bin:$PATH"   # 系统 python 没有 httpx
python batch_gen.py
```

- 并发 3（3 并发下已有随机失败，勿盲目调高）
- 失败分类：**随机失败**（"message status=error"，清 `state['failed']={}` 重跑即可）vs **提示词问题**（同一选题连挂 3 次以上，需改写提示词换新 id）
- 预览 URL：`{BASE}/api/generations/{gen_id}/preview`（需 cookie）

## 迭代修改已生成的动画

向原会话发修改文案 → 出现设计门（`awaiting_confirmation`）→ 发「采纳」→ 轮询 version+1。流程：POST `/api/conversations/{cid}/messages` 带 `{"content":文案,"attachment_ids":[],"client_request_id":uuid}`；gate 后再 POST 同接口 content=「采纳」（nginx 可能 502/504，容忍），然后每 10s GET `/api/conversations/{cid}` 直到 `generations[0].version` 增加，`messages[-1].status=="error"` 即失败。对话 id 在 `state.json` 的 `done` 里。**用 python heredoc 内联跑即可，跑完不留脚本文件。**

## 提示词经验（每次跑完更新）

- 结构：前半段描述画面（视觉元素、颜色、运动、角落公式），后半段接通用"画面与工程要求"硬性约束块（见 topics.json 壁纸类选题）
- 公式必须纯文本，禁止上标/下标/英文术语堆砌（黄金角向日葵因符号写法连挂 3 次，改纯文本一次过）
- 必须显式禁止 `ctx.shadowBlur`（否则模型必用，导致卡顿）；发光用双层描边模拟
- 必须写"固定随机种子、时间是确定性函数"，否则每帧闪烁
- 物理正确性要写明确：如磁感线"从 N 极出发回到 S 极的闭合曲线"，否则模型画错
- 3D 效果写明"canvas 2D 手写透视投影，不引入外部库"
- 生成后用 curl 下载 preview HTML grep 验证：shadowBlur 计数、外部库、lineWidth
