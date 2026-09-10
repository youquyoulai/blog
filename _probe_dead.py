#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
比邻 · 站点存活探测
用途：真实探测每个博客的 RSS 是否可达，输出失联名单。

背景：CI（GitHub Actions）里批量抓 RSS 失败率极高（实测 87%），
      不能拿 CI 的抓取结果当"失联"依据，否则会误杀大量正常站。
      本脚本在本机跑，对失败项做多轮重试（代理 / 直连 / 放宽 UA），
      仍失败才判定为失联。

用法：
    python _probe_dead.py                 # 探测 data/alliance.json 全量
    python _probe_dead.py --workers 30    # 自定义并发
输出：
    data/_probe_result.json  每个域名的探测结果
"""

import argparse
import concurrent.futures
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

CST = timezone(timedelta(hours=8))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

# 代理噪声：这类错误多半是本环境代理/网络的问题，不代表站点真挂
PROXY_NOISE = ("Tunnel connection failed", "Bad Gateway", "ProxyError")


def build_opener(direct: bool):
    """direct=True 强制不走系统代理"""
    handlers = [urllib.request.HTTPSHandler(context=_ctx)]
    if direct:
        handlers.append(urllib.request.ProxyHandler({}))
    return urllib.request.build_opener(*handlers)


OP_PROXY = build_opener(direct=False)
OP_DIRECT = build_opener(direct=True)


def fetch_once(url: str, opener, timeout: int):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })
    with opener.open(req, timeout=timeout) as r:
        body = r.read(300000)
        # 少数站点无视 Accept-Encoding 仍返回 gzip，不解开会误判成 not-xml
        if body[:2] == b"\x1f\x8b":
            import gzip
            try:
                body = gzip.decompress(body)
            except Exception:
                pass
    return getattr(r, "status", 200), body


def looks_like_feed(body: bytes) -> bool:
    head = body[:4000].decode("utf-8", "ignore").lower()
    return "<rss" in head or "<feed" in head or "<?xml" in head


def probe(item):
    """返回 (domain, ok:bool, reason:str)"""
    domain, url = item
    if not url:
        return domain, False, "no-feed"

    last = ""
    # 轮次：1) 代理 2) 直连 3) 代理放宽超时 4) 直连放宽超时
    for opener, timeout in ((OP_PROXY, 12), (OP_DIRECT, 12),
                            (OP_DIRECT, 25), (OP_PROXY, 25)):
        try:
            status, body = fetch_once(url, opener, timeout)
            if status >= 400:
                last = "HTTP %d" % status
                # 4xx 基本是确定的（404/410 源已删），不必再试
                if 400 <= status < 500:
                    return domain, False, last
                continue
            if looks_like_feed(body):
                return domain, True, "ok"
            last = "not-xml"
        except urllib.error.HTTPError as e:
            last = "HTTP %d" % e.code
            if 400 <= e.code < 500:
                return domain, False, last
        except socket.timeout:
            last = "timeout"
        except Exception as e:
            last = type(e).__name__ + ":" + str(e)[:50]
        time.sleep(0.4)
    return domain, False, last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="data/alliance.json")
    ap.add_argument("--out", default="data/_probe_result.json")
    ap.add_argument("--workers", type=int, default=30)
    ap.add_argument("--only", default="", help="只探测这些域名，逗号分隔")
    args = ap.parse_args()

    with open(args.src, encoding="utf-8") as f:
        data = json.load(f)
    blogs = data.get("blogs") or []
    if args.only:
        want = set(x.strip().lower() for x in args.only.split(",") if x.strip())
        blogs = [b for b in blogs if b["domain"] in want]

    items = [(b["domain"], b.get("feed") or "") for b in blogs]
    print("探测 %d 个站点，并发 %d ..." % (len(items), args.workers))

    result = {}
    t0 = time.time()
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for domain, ok, reason in ex.map(probe, items):
            result[domain] = {"ok": ok, "reason": reason}
            done += 1
            if done % 50 == 0 or done == len(items):
                print("  %d/%d  用时 %.0fs" % (done, len(items), time.time() - t0))

    alive = sum(1 for v in result.values() if v["ok"])
    dead = {k: v for k, v in result.items() if not v["ok"]}
    print("\n存活 %d, 失联 %d" % (alive, len(dead)))

    from collections import Counter
    print("失联原因分布:", Counter(v["reason"].split(":")[0] for v in dead.values()).most_common(8))

    out = {
        "probed_at": datetime.now(CST).isoformat(timespec="seconds"),
        "total": len(result),
        "alive": alive,
        "dead": len(dead),
        "result": result,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("输出: %s" % args.out)


if __name__ == "__main__":
    sys.exit(main())
