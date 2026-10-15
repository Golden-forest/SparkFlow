#!/usr/bin/env python3
"""Import ZhiJiao production animations into SparkFlow's public/simcanvas/ gallery.

Source: /tmp/zj_export.tar.gz (dumped from 49.235.184.137:/home/stu25/project/data/simcanvas.db).
Rules:
  - Latest version per conversation only (older drafts stay in the server DB).
  - Skip generations already present (matched by generation_id in existing meta.json).
  - Slug: zj-NNN where NNN matches the numbering in generation-list.md
    (conversations sorted by earliest generation, versions ascending).
  - Registers every imported item in social-publish/batch-gen/topics.json as
    featured, so `batch_gen.py --list / --remove` covers them for self-service
    deletion.
Run:  python3 docs/agent-work/zhijiao-migration/import_all.py [--dry-run]
"""
import io
import json
import sys
import tarfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
GALLERY = REPO / "public" / "simcanvas"
TOPICS = REPO / "social-publish" / "batch-gen" / "topics.json"
TARBALL = Path("/tmp/zj_export.tar.gz")

# devicePixelRatio pin for LazyPreview thumbnails — same as batch_gen.py --pull
PREVIEW_FLAG = (
    '<script>if(location.search.indexOf("preview=1")!==-1)'
    'Object.defineProperty(window,"devicePixelRatio",{get:function(){return 1}})</script>'
)

CATEGORY_MAP = {
    "物理": "physics", "化学": "chemistry", "数学": "math",
    "地理/生物": "earth-science", "艺术/生成": "art", "其他": "physics",
}


def extract_html(html: str) -> str:
    """Some DB rows stored the model's whole reply (HTML + agent chatter after
    the closing tag); keep only the document itself."""
    i = html.lower().rfind("</html>")
    if i != -1:
        html = html[: i + len("</html>")]
    return html


def guess_topic(title: str) -> str:
    rules = [
        ("物理", ["物理", "力", "运动", "电", "磁", "场", "光", "衍射", "干涉", "透镜", "成像", "单缝", "双缝", "牛顿", "能量", "动量", "碰撞", "弹簧", "振子", "摆", "波", "压强", "浮力", "热", "温度", "粒子", "原子", "核", "电容", "电路", "电流", "电压", "电阻", "欧姆", "楞次", "感应", "公转", "自转", "天体", "卫星", "行星", "万有引力", "斜面", "滑块", "板块", "摩擦", "加速度", "速度", "位移", "抛体", "平抛", "圆周", "简谐", "机械波", "折射", "反射", "色散", "光谱", "光电", "衰变"]),
        ("化学", ["化学", "晶胞", "晶体", "分子", "元素", "周期表", "酸", "碱", "盐", "pH", "指示剂", "原电池", "电解", "反应", "离子", "共价", "化学键", "溶液", "溶解", "硫酸铜", "氧化", "还原", "有机", "苯", "甲烷", "乙烯", "乙醇", "酯", "水解", "平衡", "电离", "胶体", "蒸馏", "摩尔", "燃烧", "焰色"]),
        ("数学", ["数学", "函数", "三角", "单位圆", "正弦", "余弦", "正切", "向量", "矩阵", "微积分", "导数", "积分", "极限", "数列", "等差", "等比", "概率", "统计", "随机", "几何", "椭圆", "双曲线", "抛物线", "复数", "极坐标", "斐波那契", "黄金分割", "分形", "曼德博", "朱利亚", "洛伦兹", "Lorenz", "混沌", "吸引子", "公式", "定理", "圆周率", "欧拉", "傅里叶", "莫比乌斯", "科赫", "谢尔宾斯基"]),
        ("地理/生物", ["地理", "地球", "气候", "洋流", "大气", "降水", "地形", "地貌", "河流", "经纬", "时区", "昼夜", "四季", "月相", "日食", "月食", "星空", "星座", "银河", "宇宙", "太阳系", "彗星", "黑洞", "星系", "生物", "细胞", "DNA", "遗传", "进化", "光合", "呼吸", "生态", "种群", "群落", "食物链", "酶", "蛋白质", "病毒", "细菌"]),
        ("艺术/生成", ["艺术", "生成", "星夜", "梵高", "笔触", "流场", "噪声", "perlin", "程序化", "城市", "画廊", "kaleidoscope", "万花筒", "流星", "极光", "aurora", "harmonograph", "tesseract", "superformula", "phyllotaxis", "breathing", "matrix"]),
    ]
    low = title.lower()
    for cat, kws in rules:
        if any(kw.lower() in low for kw in kws):
            return cat
    return "其他"


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    if not TARBALL.exists():
        sys.exit(f"missing {TARBALL} — re-export from server first")

    with tarfile.open(TARBALL, "r:gz") as tar:
        members = {m.name: m for m in tar.getmembers()}
        meta = json.load(tar.extractfile("meta.json"))
        htmls = {r[0]: tar.extractfile(r[0] + ".html").read().decode("utf-8") for r in meta}

    # already-migrated generation ids
    migrated = {}
    for f in GALLERY.glob("*/meta.json"):
        m = json.loads(f.read_text())
        if m.get("generation_id"):
            migrated[m["generation_id"]] = f.parent.name

    # conversations sorted by earliest generation, versions ascending —
    # same ordering as generation-list.md so zj-NNN == checklist #NNN
    by_conv: dict[str, list] = {}
    for row in meta:
        by_conv.setdefault(row[1], []).append(row)
    number, plan = 0, []  # (slug, row)
    for conv_id, items in sorted(by_conv.items(), key=lambda kv: min(r[5] for r in kv[1])):
        latest = sorted(items, key=lambda r: r[2])[-1]
        for _ in items:
            number += 1
        if latest[0] in migrated:
            continue
        plan.append((f"zj-{number:03d}", latest))

    existing = {d.name for d in GALLERY.iterdir() if d.is_dir()}
    clashes = [s for s, _ in plan if s in existing]
    if clashes:
        sys.exit(f"slug collision with existing dirs: {clashes}")

    topics = json.loads(TOPICS.read_text())
    known_ids = {t["id"] for t in topics}

    created = 0
    for slug, (gid, cid, ver, title, prov, created_at, prompt, size) in plan:
        assert gid in htmls
        html = extract_html(htmls[gid])
        if PREVIEW_FLAG not in html:
            html = html.replace("<head>", "<head>" + PREVIEW_FLAG, 1) if "<head>" in html else PREVIEW_FLAG + html
        if not dry_run:
            target = GALLERY / slug
            target.mkdir(parents=True)
            (target / "index.html").write_text(html, encoding="utf-8")
            (target / "meta.json").write_text(json.dumps({
                "title": title[:80],
                "category": CATEGORY_MAP[guess_topic(title)],
                "generation_id": gid,
                "conversation_id": cid,
                "version": ver,
                "provider": prov,
                "updated_at": created_at,
                "source": "zhijiao-import 2026-10-14",
            }, ensure_ascii=False, indent=1), encoding="utf-8")
            if slug not in known_ids:
                topics.append({
                    "id": slug, "title": title[:80], "prompt": prompt,
                    "featured": True, "category": CATEGORY_MAP[guess_topic(title)],
                    "source": "zhijiao-import",
                })
        created += 1

    if not dry_run:
        TOPICS.write_text(json.dumps(topics, ensure_ascii=False, indent=1))
    print(f"conversations with generations: {len(by_conv)}")
    print(f"skipped (already migrated): {sum(1 for c in by_conv.values() if sorted(c, key=lambda r: r[2])[-1][0] in migrated)}")
    print(f"{'would import' if dry_run else 'imported'}: {created} animations -> public/simcanvas/zj-*")
    print(f"topics.json: {len(topics)} entries ({'dry-run, unchanged' if dry_run else 'updated'})")


if __name__ == "__main__":
    main()
