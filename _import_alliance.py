#!/usr/bin/env python3
"""
博客联盟 — 博友圈站点导入脚本（零第三方依赖）

数据源: https://www.boyouquan.com/api/blogs?pageNo=N
  - 公开 JSON 接口，无鉴权
  - 服务端强制 pageSize=10（传别的值也按 10 返回），全量需翻约 120 页
  - 返回结构: { pageNo, pageSize, results, total }

用法:
    python _import_alliance.py                  # 全量导入
    python _import_alliance.py --limit 3        # 只抓前 3 页（调试用）
    python _import_alliance.py --workers 6      # 调并发数
    python _import_alliance.py --fresh          # 忽略本地分页缓存，重新抓
    python _import_alliance.py --out data/alliance.json

设计要点:
  - 只用标准库，任何环境都能跑
  - 每页原始 JSON 缓存到 _alliance_cache/page_N.json，断点续传不重复请求
  - 按 domain 去重，过滤 deleted / draft
  - 时间统一归一化成 ISO 格式，Hugo 里可直接比较排序
  - 输出带 meta 头（updated / total），前端可显示"数据更新于 X"
"""
import argparse
import base64
import gzip
import html
import http.client
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

API = "https://www.boyouquan.com/api/blogs?page={page}"
ALL_BLOGS_API = "https://www.boyouquan.com/api/blog-intimacies/all-source-blogs"
STATS_API = "https://www.boyouquan.com/api/statistics"
CACHE_DIR = "_alliance_cache"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
CST = timezone(timedelta(hours=8))


def log(msg):
    print(msg, flush=True)


def http_get(url, timeout=20, retries=3):
    """带重试的 GET。返回文本，失败抛异常。"""
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "application/json,text/plain,*/*",
                "Accept-Language": "zh-CN,zh;q=0.9",
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
            return raw.decode("utf-8", "replace")
        except Exception as e:
            last = e
            time.sleep(1.2 * (i + 1))
    raise last


# ── P04: 按 host 复用 HTTPS 连接的字节级 GET（keep-alive + gzip + 跟随重定向）──
# 每个 worker 线程持有独立的连接池（threading.local），避免跨线程共享 socket。
# 池容量封顶，超过则关闭最久未用的连接，防止 671 个不同域名累积大量空闲 socket。
_POOL_CAP = 16
_conn_local = threading.local()


def _conn_pool():
    pool = getattr(_conn_local, "pool", None)
    if pool is None:
        pool = {}
        _conn_local.pool = pool
    return pool


def _get_conn(host, timeout, https=True):
    pool = _conn_pool()
    conn = pool.get(host)
    if conn is None:
        conn = http.client.HTTPSConnection(host, timeout=timeout) if https \
            else http.client.HTTPConnection(host, timeout=timeout)
        pool[host] = conn
    return conn


def _evict_pool():
    """连接池超出容量时，关闭并移除最久未使用的连接。"""
    pool = _conn_pool()
    while len(pool) > _POOL_CAP:
        old_host, old_conn = pool.popitem(last=False)
        try:
            old_conn.close()
        except Exception:
            pass


def _http_get_bytes(url, timeout=15):
    """GET 单个 URL，返回原始字节；失败返回 None（与 fetch_feed 的 fail-soft 一致）。
    自动解 gzip、跟随至多 5 次重定向、复用同 host 连接。"""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    host = parsed.hostname
    https = parsed.scheme == "https"
    path = parsed.path or "/" + (("?" + parsed.query) if parsed.query else "")
    for _ in range(5):
        try:
            conn = _get_conn(host, timeout, https)
            conn.request("GET", path, headers={
                "User-Agent": UA,
                "Accept": "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*",
                "Accept-Encoding": "gzip, identity",
            })
            resp = conn.getresponse()
            if resp.status in (301, 302, 303, 307, 308):
                loc = resp.getheader("Location")
                resp.read()
                if not loc:
                    return None
                nxt = urllib.parse.urlparse(loc)
                if nxt.netloc:
                    host = nxt.netloc
                    https = nxt.scheme != "http"
                    conn.close()
                path = nxt.path or "/" + (("?" + nxt.query) if nxt.query else "")
                continue
            if resp.status != 200:
                resp.read()
                return None
            raw = resp.read()
            enc = resp.getheader("Content-Encoding", "")
            if "gzip" in enc:
                raw = gzip.decompress(raw)
            _evict_pool()
            return raw
        except Exception:
            # 连接可能已损坏，丢弃后下次重建
            try:
                _conn_local.pool.pop(host, None).close()
            except Exception:
                pass
            return None
    return None


def norm_time(s):
    """博友圈时间格式 '2026/09/01 08:00:00' -> '2026-09-01T08:00:00'。
    无法解析的返回空串（前端当作"未知"处理）。"""
    if not s:
        return ""
    s = str(s).strip()
    if not s or s in ("-", "null", "None"):
        return ""
    s = s.replace("/", "-").replace("T", " ")
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ ](\d{1,2}):(\d{2})(?::(\d{2}))?)?", s)
    if not m:
        return ""
    y, mo, d, hh, mm, ss = m.groups()
    return "{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}".format(
        int(y), int(mo), int(d),
        int(hh or 0), int(mm or 0), int(ss or 0))


def fetch_page(page, fresh=False, timeout=20):
    """取单页。命中本地缓存直接返回，除非 fresh=True。"""
    cache_file = os.path.join(CACHE_DIR, "page_%03d.json" % page)
    if not fresh and os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f), True
        except Exception:
            pass
    data = json.loads(http_get(API.format(page=page), timeout=timeout))
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data, False


def _local(tag):
    """取 XML tag 的本地名（去掉命名空间）。"""
    return tag.split("}")[-1] if "}" in tag else tag


def clean_text(s, limit=90):
    """RSS 文本清洗：去 HTML 标签、合并空白、截断到 limit 个字符。"""
    if not s:
        return ""
    s = html.unescape(s)
    s = re.sub(r"<[^>]+>", "", s)          # 去掉 HTML 标签
    s = re.sub(r"&nbsp;", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > limit:
        s = s[:limit] + "…"
    return s


def fetch_feed(url, timeout=15):
    """抓单个站的 RSS/Atom，返回最新一篇 {title, summary, link}，失败返回 None。
    只取第一个条目（按 RSS 默认倒序即最新）。"""
    if not url:
        return None
    try:
        # P04: 复用 HTTPS 连接 + P05: 自动 gzip（见 _http_get_bytes）
        raw = _http_get_bytes(url, timeout)
        if not raw:
            return None
        root = ET.fromstring(raw)
    except Exception:
        return None

    # 不依赖命名空间，按本地名找 item(RSS) / entry(Atom)
    items = [e for e in root.iter() if _local(e.tag) == "item"]
    entries = [e for e in root.iter() if _local(e.tag) == "entry"]

    if items:
        it = items[0]
        title = clean_text(it.findtext("title"), 60)
        link = (it.findtext("link") or "").strip()
        desc = clean_text(
            it.findtext("description")
            or it.findtext("{http://purl.org/rss/1.0/modules/content/}encoded"),
            90,
        )
        if not (title or link):
            return None
        return {"title": title, "link": link, "summary": desc}

    if entries:
        e = entries[0]
        NS = "{http://www.w3.org/2005/Atom}"
        title = clean_text(e.findtext(NS + "title"), 60)
        link = ""
        for l in e.findall(NS + "link"):
            if l.get("href"):
                link = l.get("href")
                break
        summ = clean_text(
            e.findtext(NS + "summary") or e.findtext(NS + "content"), 90
        )
        if not (title or link):
            return None
        return {"title": title, "link": link, "summary": summ}

    return None


def map_blog(b):
    """博友圈原始字段 -> 联盟数据字段。只留前端用得到的。"""
    desc = (b.get("description") or "").strip()
    return {
        "name": (b.get("name") or b.get("domainName") or "").strip(),
        "domain": (b.get("domainName") or "").strip().lower(),
        "site": (b.get("address") or "").strip(),
        "feed": (b.get("rssAddress") or "").strip(),
        "desc": desc,
        "posts": b.get("postCount") or 0,
        "updated": norm_time(b.get("latestPublishedAt")),
        "added": norm_time(b.get("collectedAt")),
        "location": (b.get("blogServerLocation") or "").strip(),
        "sunset": bool(b.get("sunset")),
        "ok": bool(b.get("statusOk")),
        "hidden": False,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="只抓前 N 页（0=全量）")
    ap.add_argument("--workers", type=int, default=5, help="并发数")
    ap.add_argument("--timeout", type=int, default=25, help="单页超时秒数")
    ap.add_argument("--fresh", action="store_true", help="忽略本地分页缓存")
    ap.add_argument("--out", default="data/alliance.json", help="输出文件")
    ap.add_argument("--out-latest", default="data/alliance-latest.json",
                    help="最新文章数据输出文件（按 domain 索引）")
    ap.add_argument("--no-latest", action="store_true",
                    help="跳过 RSS 抓取，只输出基础数据")
    ap.add_argument("--latest-only", action="store_true",
                    help="只抓 RSS 更新最新文章数据，不重抓博友圈")
    args = ap.parse_args()

    # P06: 缓存目录只建一次（原先在 fetch_page 内每页重复调用）
    os.makedirs(CACHE_DIR, exist_ok=True)
    t0 = time.time()

    log("=" * 56)
    log("比邻 · 博友圈站点导入")
    log("=" * 56)

    blogs = None
    if args.latest_only:
        # 只更新最新文章：从已有基础数据读取站点列表，不重抓博友圈
        try:
            with open(args.out, encoding="utf-8") as f:
                blogs = json.load(f).get("blogs") or []
            log("从 %s 读取 %d 个站点" % (args.out, len(blogs)))
        except Exception as e:
            log("! 读取基础数据失败: %s" % e)
            return
    else:
        # 先探第一页，拿 total 和真实 pageSize
        log("\n[1/4] 探测数据源 ...")
        first, cached = fetch_page(1, args.fresh, args.timeout)
        total = first.get("total") or 0
        page_size = first.get("pageSize") or 10
        pages = (total + page_size - 1) // page_size
        if args.limit:
            pages = min(pages, args.limit)
        log("  收录总数: %d" % total)
        log("  每页条数: %d (服务端锁定)" % page_size)
        log("  需抓页数: %d %s" % (pages, "(已 --limit 截断)" if args.limit else ""))

        # 并发翻页
        log("\n[2/4] 抓取分页 ...")
        raw = {1: first}
        hit = 0
        miss = 0
        todo = [p for p in range(2, pages + 1)]
        done = 0
        if todo:
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                futs = {ex.submit(fetch_page, p, args.fresh, args.timeout): p for p in todo}
                for fu in as_completed(futs):
                    p = futs[fu]
                    try:
                        d, c = fu.result()
                        raw[p] = d
                        hit += 1 if c else 0
                        miss += 0 if c else 1
                    except Exception as e:
                        log("  ! 第 %d 页失败: %s" % (p, e))
                    done += 1
                    if done % 20 == 0 or done == len(todo):
                        log("  进度 %d/%d  用时 %.1fs" % (done, len(todo), time.time() - t0))
        log("  完成: 命中缓存 %d 页, 网络请求 %d 页, 失败 %d 页"
            % (hit, miss, pages - len(raw)))

        # 汇总去重
        log("\n[3/4] 汇总去重 ...")
        seen = {}
        skipped = 0
        for p in sorted(raw):
            for b in (raw[p].get("results") or []):
                if b.get("deleted") or b.get("draft"):
                    skipped += 1
                    continue
                item = map_blog(b)
                if not item["domain"]:
                    skipped += 1
                    continue
                # 过滤 .io 域名后缀（用户要求精简站点量）
                if item["domain"].endswith(".io"):
                    skipped += 1
                    continue
                seen[item["domain"]] = item
        blogs = list(seen.values())
        blogs.sort(key=lambda x: (x["updated"] or "0000"), reverse=True)

        active = sum(1 for b in blogs if b["updated"] and b["updated"][:4] >= "2026")
        out = {
            "updated": datetime.now(CST).isoformat(timespec="seconds"),
            "source": "https://www.boyouquan.com/blogs",
            "total": len(blogs),
            "active": active,
            "blogs": blogs,
        }
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        # 紧凑输出（无缩进）：1180 站约 448KB，base64 后约 598KB，
        # 远在 GitHub Contents API 单文件 1MB 上限内。
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

        size = os.path.getsize(args.out)
        grabbed = sum(len(raw[p].get("results") or []) for p in raw)
        log("  抓回条目: %d, 去重后: %d" % (grabbed, len(blogs)))
        log("  有效站点: %d (跳过 %d 条已删除/草稿/无域名/.io)" % (len(blogs), skipped))
        log("  近一年有更新: %d" % active)
        log("  输出: %s (%.1f KB)" % (args.out, size / 1024.0))

        if grabbed and len(blogs) < grabbed * 0.8:
            log("  ! 警告: 去重率异常高，分页参数可能失效（各页返回了重复数据）")

        # 与博友圈「全部站点域名」接口对比，确认没有抓漏
        if not args.limit:
            log("\n[4/4] 校验完整性 ...")
            try:
                allb = json.loads(http_get(ALL_BLOGS_API, timeout=40))
                want = set()
                for x in allb:
                    d = (x.get("domainName") or "").strip().lower()
                    if d:
                        want.add(d)
                got = set(b["domain"] for b in blogs)
                missing = sorted(want - got)
                log("  博友圈域名全集: %d" % len(want))
                log("  本地已收录:     %d" % len(got))
                log("  缺失:           %d" % len(missing))
                if missing:
                    log("  缺失样例: %s" % ", ".join(missing[:10]))
                    log("  -> 可对这些域名单独补抓，或重跑 --fresh")
                else:
                    log("  OK 无缺失")
            except Exception as e:
                log("  校验跳过（接口不可用）: %s" % e)

    # ── 抓取最新文章（RSS），输出到独立文件，绕开 1MB 限制 ──
    if not args.no_latest:
        stage = "[5/5] 抓取最新文章(RSS) ..." if not args.latest_only else "抓取最新文章(RSS) ..."
        log("\n%s" % stage)
        feeds = [b for b in blogs if b.get("feed")]
        log("  需抓 RSS: %d 个" % len(feeds))
        latest_map = {}
        ok = 0
        fail = 0
        with ThreadPoolExecutor(max_workers=max(4, args.workers * 2)) as ex:
            futs = {ex.submit(fetch_feed, b["feed"], args.timeout): b["domain"]
                    for b in feeds}
            for fu in as_completed(futs):
                d = fu.result()
                if d:
                    latest_map[futs[fu]] = d
                    ok += 1
                else:
                    fail += 1
        out_latest = {
            "updated": datetime.now(CST).isoformat(timespec="seconds"),
            "total": len(latest_map),
            "map": latest_map,
        }
        os.makedirs(os.path.dirname(args.out_latest) or ".", exist_ok=True)
        with open(args.out_latest, "w", encoding="utf-8") as f:
            json.dump(out_latest, f, ensure_ascii=False, separators=(",", ":"))
        lsize = os.path.getsize(args.out_latest)
        log("  成功: %d, 失败: %d" % (ok, fail))
        log("  输出: %s (%.1f KB, base64 %.1f KB / 1024)"
            % (args.out_latest, lsize / 1024.0,
               len(base64.b64encode(open(args.out_latest, "rb").read())) / 1024.0))

    log("\n完成。用时 %.1f 秒" % (time.time() - t0))

    if blogs:
        log("\n前 5 条预览:")
        for b in blogs[:5]:
            log("  - %-16s %-28s 更新 %s"
                % (b["name"][:16], b["domain"], b["updated"] or "未知"))


if __name__ == "__main__":
    main()
