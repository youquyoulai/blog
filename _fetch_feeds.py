#!/usr/bin/env python3
"""
文汇 RSS 抓取脚本
运行方式: python _fetch_feeds.py
建议在 hugo build 前自动运行

依赖: pip install feedparser requests
"""
import json
import time
import sys
from pathlib import Path

# 修复 Windows 控制台编码
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

try:
    import feedparser
except ImportError:
    print("缺少 feedparser，正在安装...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "feedparser", "-q"])
    import feedparser


def clean_text(s):
    """清理 HTML 标签并转义特殊字符"""
    if not s:
        return ""
    import re
    # 去掉 HTML 标签
    s = re.sub(r'<[^>]+>', '', s)
    # 还原 HTML 实体
    s = s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    s = s.replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    # 合并空白
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def truncate(s, length=200):
    """截断字符串"""
    if not s:
        return ""
    if len(s) > length:
        return s[:length] + "..."
    return s


def parse_date(date_str):
    """解析各种日期格式"""
    if not date_str:
        return None
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str).isoformat()
    except Exception:
        pass
    # 尝试直接解析
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            from datetime import datetime
            return datetime.strptime(date_str[:19], fmt[:len(date_str)]).isoformat()
        except Exception:
            pass
    return None


def fetch_feed(source):
    """抓取单个 RSS 源，只取最新一篇"""
    url = source.get("url")
    name = source.get("name", url)
    category = source.get("category", "")

    if not url:
        return []

    print(f"  抓取: {name} ({url})")
    try:
        feed = feedparser.parse(url)

        if feed.bozo and not feed.entries:
            print(f"    ⚠️  解析失败: {feed.bozo_exception}")
            return []

        articles = []
        # 只取最新一篇 (feed.entries 已按发布时间降序排列)
        for entry in feed.entries[:1]:
            # 获取标题
            title = clean_text(getattr(entry, 'title', '') or '')

            # 获取链接
            link = ''
            if hasattr(entry, 'link'):
                link = entry.link
            elif hasattr(entry, 'links') and entry.links:
                for l in entry.links:
                    if l.get('rel') == 'alternate' or not l.get('type'):
                        link = l.get('href', '')
                        break
                if not link:
                    link = entry.links[0].get('href', '')

            # 获取摘要/正文
            desc = ''
            if hasattr(entry, 'summary'):
                desc = clean_text(entry.summary)
            elif hasattr(entry, 'description'):
                desc = clean_text(entry.description)
            elif hasattr(entry, 'content') and entry.content:
                desc = clean_text(entry.content[0].value)

            # 获取发布时间
            pub_date = ''
            if hasattr(entry, 'published'):
                pub_date = parse_date(entry.published) or ''
            elif hasattr(entry, 'updated'):
                pub_date = parse_date(entry.updated) or ''

            if title and link:
                articles.append({
                    "title": title,
                    "link": link,
                    "desc": truncate(desc, 200),
                    "pubDate": pub_date,
                    "source": name,
                    "sourceUrl": url,
                    "category": category,
                })

        print(f"    ✅ 获取 {len(articles)} 篇")
        return articles

    except Exception as e:
        print(f"    ❌ 失败: {e}")
        return []


def main():
    base_dir = Path(__file__).parent.resolve()
    feeds_file = base_dir / "data" / "wenhui-feeds.json"
    output_file = base_dir / "static" / "feeds" / "wenhui.json"

    # 读取配置
    if not feeds_file.exists():
        print(f"⚠️  未找到配置文件: {feeds_file}")
        print("请先在后台添加 RSS 源")
        output = {"feeds": [], "articles": [], "updated": ""}
    else:
        with open(feeds_file, "r", encoding="utf-8") as f:
            config = json.load(f)

        feeds = config.get("feeds", [])
        if not feeds:
            print("⚠️  未配置 RSS 源，请在后台添加")
            output = {"feeds": [], "articles": [], "updated": ""}
        else:
            print(f"📡 开始抓取 {len(feeds)} 个 RSS 源...\n")
            all_articles = []
            for source in feeds:
                articles = fetch_feed(source)
                all_articles.extend(articles)
                time.sleep(0.5)  # 避免请求过快

            # 按发布时间降序排列（None 的排最后）
            all_articles.sort(
                key=lambda x: x.get("pubDate") or "0",
                reverse=True
            )

            output = {
                "feeds": feeds,
                "articles": all_articles,
                "total": len(all_articles),
                "updated": __import__('datetime').datetime.now().isoformat()
            }
            print(f"\n✅ 完成，共 {len(all_articles)} 篇文章")

    # 确保输出目录存在
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # 写入 JSON
    with open(output_file, "w", encoding="utf-8", errors='replace') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"📄 已写入: {output_file}")


if __name__ == "__main__":
    main()
