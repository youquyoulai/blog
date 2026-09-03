#!/usr/bin/env python3
"""
# DEPRECATED: 文汇 RSS 聚合功能已暂停（源列表 wenhui-hidden.md 不存在，输出恒为空）。
# 脚本保留仅作历史参考；新需求请勿在此扩展，复用 _import_alliance.py 的 feed 逻辑。

文汇 RSS 聚合抓取脚本（零第三方依赖版）

源列表读取 content/pages/wenhui-hidden.md 里的 [feed:名称|RSS地址] 短代码，
并发抓取每个源的最新一篇文章，输出到 data/wenhui-feeds.json 供 Hugo 构建时渲染。

用法:
    python _fetch_feeds.py                 # 正常抓取
    python _fetch_feeds.py --limit 20      # 只抓前 20 个（调试用）
    python _fetch_feeds.py --workers 32    # 调并发数
    python _fetch_feeds.py --timeout 15    # 调单源超时秒数

设计要点:
  - 只用标准库，任何环境都能跑，无需 pip install
  - 支持 RSS 2.0 / Atom / RDF(RSS 1.0) 三种格式
  - 单源失败自动降级到上次缓存，不会让一个死链污染整页
  - 每个源记录 last_success，前端可显示"更新于 X 天前"
"""
import argparse
import gzip
import json
import re
import sys
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE_DIR = Path(__file__).parent.resolve()
SOURCES_MD = BASE_DIR / "content" / "pages" / "wenhui-hidden.md"
DATA_OUT = BASE_DIR / "data" / "wenhui-feeds.json"
STATIC_OUT = BASE_DIR / "static" / "feeds" / "wenhui.json"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# XML 标准实体白名单，其余（如 &nbsp; &mdash;）会让 ElementTree 直接报错
_KNOWN_ENTITIES = {"amp", "lt", "gt", "quot", "apos"}
_ENTITY_RE = re.compile(r"&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);")
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_NUM_ENT_RE = re.compile(r"&#(\d+);|&#[xX]([0-9a-fA-F]+);")
# [feed:名称|URL]
_FEED_RE = re.compile(r"\[feed:([^|\]]+)\|([^\]]+)\]")

CST = timezone(timedelta(hours=8))


# ---------------------------------------------------------------- 文本处理

def sanitize_xml_entities(text: str) -> str:
    """把非标准 XML 实体替换掉，避免 ElementTree 解析失败"""
    def repl(m):
        body = m.group(1)
        if body.startswith("#"):
            return m.group(0)
        if body in _KNOWN_ENTITIES:
            return m.group(0)
        return " "
    return _ENTITY_RE.sub(repl, text)


def clean_text(s, limit=120):
    """去 HTML 标签、还原实体、合并空白、截断"""
    if not s:
        return ""
    s = _TAG_RE.sub(" ", s)
    s = (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
          .replace("&quot;", '"').replace("&apos;", "'").replace("&#39;", "'")
          .replace("&nbsp;", " "))
    s = _NUM_ENT_RE.sub(
        lambda m: chr(int(m.group(1) or m.group(2), 16 if m.group(2) else 10))
        if 0 < int(m.group(1) or m.group(2), 16 if m.group(2) else 10) < 0x110000 else " ",
        s)
    s = _WS_RE.sub(" ", s).strip()
    if len(s) > limit:
        s = s[:limit].rstrip() + "…"
    return s


def parse_date(value):
    """把各种日期格式统一成 ISO 字符串，失败返回空串"""
    if not value:
        return ""
    value = value.strip()
    try:
        return parsedate_to_datetime(value).astimezone(CST).isoformat()
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(value[:25], fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=CST)
            return dt.astimezone(CST).isoformat()
        except Exception:
            continue
    # 退而求其次：正则抠出 YYYY-MM-DD
    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", value)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}T00:00:00+08:00"
    return ""


# ---------------------------------------------------------------- 源列表

def load_sources():
    """从 wenhui-hidden.md 解析 [feed:名称|URL]"""
    if not SOURCES_MD.exists():
        print(f"ℹ️  源列表文件不存在（{SOURCES_MD}），跳过文汇抓取。")
        return []
    text = SOURCES_MD.read_text(encoding="utf-8")
    sources, seen = [], set()
    for name, url in _FEED_RE.findall(text):
        name, url = name.strip(), url.strip()
        if not url or url in seen:
            continue
        seen.add(url)
        sources.append({"name": name, "url": url})
    return sources


# ---------------------------------------------------------------- 抓取

def http_get(url, timeout):
    """GET 请求，自动处理 gzip，返回文本"""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, identity",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            try:
                raw = gzip.decompress(raw)
            except Exception:
                pass
    for enc in ("utf-8", "gb18030", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _find(node, *names):
    """按本地名查找子节点，忽略命名空间"""
    want = {n.lower() for n in names}
    for child in node:
        tag = child.tag.split("}", 1)[-1].lower()
        if tag in want:
            return child
    return None


def _findall(node, *names):
    want = {n.lower() for n in names}
    return [c for c in node if c.tag.split("}", 1)[-1].lower() in want]


def _node_text(node):
    if node is None:
        return ""
    return "".join(node.itertext()).strip()


def _extract_entry(item):
    """从一个 item/entry 提取标题、链接、摘要、时间"""
    title = _node_text(_find(item, "title"))

    link = ""
    for lk in _findall(item, "link"):
        href = (lk.get("href") or "").strip()
        rel = (lk.get("rel") or "alternate").strip()
        if href and (rel == "alternate" or not link):
            if rel == "alternate" or not link:
                link = href
        if rel == "alternate" and href:
            break
    if not link:
        link = _node_text(_find(item, "link")).strip()
    if not link:
        gid = _node_text(_find(item, "id", "guid"))
        if gid.startswith("http"):
            link = gid.strip()

    desc = ""
    for tag in ("description", "summary", "content", "encoded"):
        val = _node_text(_find(item, tag))
        if val:
            desc = val
            break

    pub = ""
    for tag in ("pubDate", "published", "updated", "date", "modified"):
        val = _node_text(_find(item, tag))
        if val:
            pub = parse_date(val)
            if pub:
                break

    return {
        "title": clean_text(title, 80),
        "link": link.strip(),
        "desc": clean_text(desc, 120),
        "pubDate": pub,
    }


FEED_CANDIDATES = [
    "/feed", "/feed/", "/rss.xml", "/rss", "/atom.xml",
    "/feed.xml", "/index.xml", "/rss.php", "/?feed=rss2",
]


def _grab_latest(url, timeout):
    """抓取并解析出最新一篇，任何问题都抛异常"""
    text = sanitize_xml_entities(http_get(url, timeout))
    root = ET.fromstring(text.strip())

    if root.tag.split("}", 1)[-1].lower() == "feed":          # Atom
        entries = _findall(root, "entry")
    else:                                                      # RSS 2.0 / RDF
        channel = _find(root, "channel")
        entries = _findall(channel if channel is not None else root, "item")

    if not entries:
        raise ValueError("feed 中没有条目")

    best = None
    for entry in entries[:3]:                                  # 前 3 篇里挑摘要最全的
        data = _extract_entry(entry)
        if data["title"] and data["link"]:
            if best is None or len(data["desc"]) > len(best["desc"]):
                best = data
    if not best:
        raise ValueError("条目缺少标题或链接")
    return best


def _probe_feed(url, timeout):
    """判断某个地址是不是可用的 feed"""
    try:
        text = http_get(url, timeout)
    except Exception:
        return False
    head = text[:800].lower()
    if not any(k in head for k in ("<rss", "<feed", "<rdf:rdf", "<?xml")):
        return False
    try:
        root = ET.fromstring(sanitize_xml_entities(text.strip()))
    except Exception:
        return False
    if root.tag.split("}", 1)[-1].lower() == "feed":
        return bool(_findall(root, "entry"))
    channel = _find(root, "channel")
    return bool(_findall(channel if channel is not None else root, "item"))


def discover_feed(url, timeout=6):
    """源失效时，在站点上探测真实存在的 feed 地址"""
    m = re.match(r"(https?://[^/]+)", url)
    if not m:
        return None
    origin = m.group(1)
    rest = url[len(origin):]
    base = rest[:rest.rfind("/")] if "/" in rest else ""

    seen, cands = set(), []
    for prefix in ([origin + base, origin] if base else [origin]):
        for c in FEED_CANDIDATES:
            u = prefix + c
            if u not in seen:
                seen.add(u)
                cands.append(u)
    cands = cands[:10]
    if not cands:
        return None

    with ThreadPoolExecutor(max_workers=len(cands)) as pool:
        futures = {pool.submit(_probe_feed, u, timeout): u for u in cands}
        for fut in as_completed(futures):
            try:
                if fut.result():
                    return futures[fut]
            except Exception:
                continue
    return None


def fetch_one(source, timeout, cache, discover=True):
    """抓取单个源，只取最新一篇。失败则退回缓存"""
    name, url = source["name"], source["url"]
    result = {
        "name": name,
        "url": url,
        "site": re.match(r"https?://[^/]+", url).group(0) if url.startswith("http") else "",
        "status": "ok",
        "error": "",
        "suggested_url": "",
        "last_success": "",
        "latest": None,
    }
    try:
        result["latest"] = _grab_latest(url, timeout)
        result["last_success"] = datetime.now(CST).isoformat(timespec="seconds")
        return result

    except Exception as e:
        result["status"] = "failed"
        result["error"] = f"{type(e).__name__}: {e}"[:160]

        # 源挂了，试着在站点上找真实的 feed 地址
        if discover:
            alt = discover_feed(url, min(timeout, 6))
            if alt and alt != url:
                result["suggested_url"] = alt
                try:
                    result["latest"] = _grab_latest(alt, timeout)
                    result["status"] = "recovered"
                    result["error"] = ""
                    result["last_success"] = datetime.now(CST).isoformat(timespec="seconds")
                    return result
                except Exception as e2:
                    result["error"] += f" | 新地址仍失败: {type(e2).__name__}"

        cached = cache.get(url)
        if cached and cached.get("latest"):
            result["latest"] = cached["latest"]
            result["last_success"] = cached.get("last_success", "")
            result["status"] = "stale"
        return result


# ---------------------------------------------------------------- 主流程

def load_cache():
    """读取上次结果，用于失败降级"""
    if not DATA_OUT.exists():
        return {}
    try:
        data = json.loads(DATA_OUT.read_text(encoding="utf-8"))
        return {f["url"]: f for f in data.get("feeds", []) if f.get("url")}
    except Exception:
        return {}


def main():
    ap = argparse.ArgumentParser(description="文汇 RSS 聚合抓取")
    ap.add_argument("--workers", type=int, default=20, help="并发数（默认 20）")
    ap.add_argument("--timeout", type=int, default=10, help="单源超时秒数（默认 10）")
    ap.add_argument("--limit", type=int, default=0, help="只抓前 N 个源（调试用）")
    ap.add_argument("--no-discover", action="store_true",
                    help="源失效时不做自动探测（更快，但少一次抢救机会）")
    args = ap.parse_args()

    sources = load_sources()
    if not sources:
        # 源列表为空（如 content/pages/wenhui-hidden.md 缺省）不再视为失败：
        # 写入一个合法的空结果文件，让后续的 hugo 构建可继续，避免 CI 退码 1 卡死部署。
        print("⚠️  没有解析到任何源（wenhui-hidden.md 缺省或为空），写入空 feeds 文件后退出。")
        empty = {
            "updated": datetime.now(CST).isoformat(timespec="seconds"),
            "elapsed_sec": 0,
            "total": 0, "ok": 0, "recovered": 0, "stale": 0, "failed": 0,
            "feeds": [],
        }
        payload = json.dumps(empty, ensure_ascii=False, separators=(",", ":"))
        DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
        DATA_OUT.write_text(payload, encoding="utf-8")
        return 0
    if args.limit:
        sources = sources[:args.limit]

    cache = load_cache()
    print(f"📡 共 {len(sources)} 个源，并发 {args.workers}，超时 {args.timeout}s\n")

    started = time.time()
    results = [None] * len(sources)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        future_map = {
            pool.submit(fetch_one, s, args.timeout, cache, not args.no_discover): i
            for i, s in enumerate(sources)
        }
        done = 0
        for fut in as_completed(future_map):
            idx = future_map[fut]
            try:
                res = fut.result()
            except Exception as e:
                res = {"name": sources[idx]["name"], "url": sources[idx]["url"],
                       "site": "", "status": "failed", "error": str(e)[:160],
                       "last_success": "", "latest": None}
            results[idx] = res
            done += 1
            mark = {"ok": "✅", "recovered": "🔄", "stale": "🗄️ ",
                    "failed": "❌"}.get(res["status"], "❌")
            title = (res["latest"]["title"][:34] + "…") if (
                res["latest"] and len(res["latest"]["title"]) > 34) else (
                res["latest"]["title"] if res["latest"] else res["error"][:40])
            print(f"  [{done:>3}/{len(sources)}] {mark} {res['name'][:14]:<14} {title}")

    elapsed = round(time.time() - started, 1)
    ok = sum(1 for r in results if r["status"] == "ok")
    recovered = sum(1 for r in results if r["status"] == "recovered")
    stale = sum(1 for r in results if r["status"] == "stale")
    failed = sum(1 for r in results if r["status"] == "failed")
    alive = ("ok", "recovered", "stale")

    # 先按最新文章时间降序，再稳定地把彻底失败的沉到底部
    results.sort(key=lambda r: (r["latest"] or {}).get("pubDate") or "0", reverse=True)
    results.sort(key=lambda r: 0 if r["status"] in alive else 1)

    output = {
        "updated": datetime.now(CST).isoformat(timespec="seconds"),
        "elapsed_sec": elapsed,
        "total": len(results),
        "ok": ok,
        "recovered": recovered,
        "stale": stale,
        "failed": failed,
        "feeds": results,
    }

    payload = json.dumps(output, ensure_ascii=False, separators=(",", ":"))
    DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text(payload, encoding="utf-8")

    size_kb = round(len(payload.encode("utf-8")) / 1024, 1)
    print(f"\n{'='*56}")
    print(f"✅ 成功 {ok}   🔄 抢救 {recovered}   🗄️ 缓存 {stale}   ❌ 失败 {failed}   共 {len(results)} 个源")
    print(f"⏱️  耗时 {elapsed}s   数据体积 {size_kb} KB")
    print(f"📄 data/wenhui-feeds.json  (Hugo 构建用)")
    print(f"📄 static/feeds/wenhui.json (前端 JS 可选)")

    fixed = [r for r in results if r.get("suggested_url")]
    if fixed:
        print(f"\n🔧 {len(fixed)} 个源地址已失效但找到新地址，建议更新 wenhui-hidden.md：")
        for r in fixed:
            print(f"   {r['name']}")
            print(f"     旧: {r['url']}")
            print(f"     新: {r['suggested_url']}")

    dead = [r for r in results if r["status"] == "failed"]
    if dead:
        print(f"\n💀 {len(dead)} 个源彻底抓不到（站点可能已关闭）：")
        for r in dead:
            print(f"   {r['name']}  {r['url']}  ->  {r['error'][:70]}")

    if elapsed > 0 and results:
        est = round(elapsed / len(results) * 200, 1)
        print(f"📊 按此速度推算，200 个源同并发约需 {est}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
