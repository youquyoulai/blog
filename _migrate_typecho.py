#!/usr/bin/env python3
"""Typecho → Hugo 全量迁移脚本
功能：
1. 文章(post) → Hugo content/posts/YYYY-MM-DD-slug.md
2. 页面(page) → Hugo content/pages/slug.md（保留特殊模板 layout）
3. 分类/标签 → Hugo frontmatter
4. 评论 → Waline 可导入 JSON
5. 附件 → 拷贝到 static/images/
6. 图片路径替换
"""

import pymysql
import yaml
import os
import json
import re
import shutil
from datetime import datetime

# ============ 配置 ============
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'typgoj',
    'password': 'typgoj',
    'database': 'typgoj',
    'charset': 'utf8mb4',
}

# 项目根目录（blog Hugo 项目）
HUGO_ROOT = r'E:\blog'
CONTENT_DIR = os.path.join(HUGO_ROOT, 'content')
POSTS_DIR = os.path.join(CONTENT_DIR, 'posts')
PAGES_DIR = os.path.join(CONTENT_DIR, 'pages')
STATIC_DIR = os.path.join(HUGO_ROOT, 'static')
IMAGES_DIR = os.path.join(STATIC_DIR, 'images')

# Typecho 站点信息
TYPECHO_ROOT = r'd:/phpstudy_pro/WWW'
TYPECHO_UPLOADS = os.path.join(TYPECHO_ROOT, 'usr', 'uploads')
SITE_URL_OLD = 'http://localhost'

# Hugo 站点信息
SITE_URL_NEW = 'https://www.pgoj.top'
BASEURL = 'https://www.pgoj.top'

# 模板映射：Typecho 模板名 → Hugo layout
TEMPLATE_MAP = {
    'page-about.php': 'about',
    'links.php': 'links',
    'archives.php': 'archives',
    'page-tag-page.php': 'tag-page',
    'page-feed-aggregator.php': 'feed-aggregator',
}

# ============ 连接数据库 ============
print("🔗 连接 MySQL...")
conn = pymysql.connect(**DB_CONFIG)
cur = conn.cursor()

# ============ 创建必要目录 ============
for d in [POSTS_DIR, PAGES_DIR, IMAGES_DIR]:
    os.makedirs(d, exist_ok=True)

# ============ 1. 读取分类和标签 ============
print("\n📋 读取分类和标签...")
cur.execute("SELECT mid, name, slug, type, count, parent FROM pgojmetas ORDER BY type, mid")
all_metas = cur.fetchall()

categories = {}  # mid → {name, slug}
tags = {}        # mid → {name, slug}
cat_parents = {} # mid → parent_mid

for mid, name, slug, mtype, count, parent in all_metas:
    if mtype == 'category':
        categories[mid] = {'name': name, 'slug': slug, 'count': count}
        if parent and parent > 0:
            cat_parents[mid] = parent
    elif mtype == 'tag':
        tags[mid] = {'name': name, 'slug': slug, 'count': count}

print(f"   分类: {len(categories)} 个: {[(c['name'], c['count']) for c in categories.values()]}")
print(f"   标签: {len(tags)} 个")

# ============ 1.5 读取内容-分类/标签关系 ============
print("\n📋 读取内容-分类/标签关系...")
cur.execute("SELECT cid, mid FROM pgojrelationships ORDER BY cid")
relationships = {}
for cid, mid in cur.fetchall():
    if cid not in relationships:
        relationships[cid] = []
    relationships[cid].append(mid)

# ============ 2. 导出文章 ============
print("\n📝 导出文章...")
cur.execute("""
    SELECT cid, title, slug, created, modified, text, commentsNum,
           allowComment, template, authorId, `order`
    FROM pgojcontents
    WHERE type = 'post' AND status = 'publish'
    ORDER BY created ASC
""")
posts = cur.fetchall()
print(f"   共 {len(posts)} 篇文章")

post_slug_to_url = {}  # cid → Hugo URL path

for idx, (cid, title, slug, created, modified, text, commentsNum,
          allowComment, template, authorId, order) in enumerate(posts, 1):
    
    # 时间格式
    dt_created = datetime.fromtimestamp(created)
    dt_modified = datetime.fromtimestamp(modified)
    date_str = dt_created.strftime('%Y-%m-%dT%H:%M:%S+08:00')
    lastmod_str = dt_modified.strftime('%Y-%m-%dT%H:%M:%S+08:00')
    
    # 文件名：YYYY-MM-DD-slug.md
    date_prefix = dt_created.strftime('%Y-%m-%d')
    filename = f"{date_prefix}-{slug or str(cid)}.md"
    
    # 分类和标签
    post_cats = []
    post_tags = []
    for mid in relationships.get(cid, []):
        if mid in categories:
            post_cats.append(categories[mid]['name'])
        elif mid in tags:
            post_tags.append(tags[mid]['name'])
    
    # 处理内容中的图片路径
    content = text or ''
    # 替换 /usr/uploads/ 为 /images/
    content = content.replace('/usr/uploads/', '/images/')
    # 替换旧的 localhost URL（如有）
    content = content.replace(SITE_URL_OLD + '/usr/uploads/', '/images/')
    
    # 转换 Typecho 的 <!--more--> 为 Hugo 的 <!--more-->
    # (Typecho 也用 <!--more-->)
    
    # Hugo URL
    hugo_url = f"/archives/{slug or str(cid)}.html"
    post_slug_to_url[cid] = hugo_url
    
    # 构建 frontmatter
    frontmatter = {
        'title': title,
        'date': date_str,
        'lastmod': lastmod_str,
        'slug': slug or str(cid),
    }
    if post_cats:
        frontmatter['categories'] = post_cats
    if post_tags:
        frontmatter['tags'] = post_tags
    if allowComment == '0':
        frontmatter['comments'] = False
    else:
        frontmatter['comments'] = True
    
    # 生成 markdown 文件
    filepath = os.path.join(POSTS_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('---\n')
        yaml.dump(frontmatter, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        f.write('---\n\n')
        f.write(content)
    
    if idx % 50 == 0:
        print(f"   {idx}/{len(posts)}...")

print(f"   ✅ 文章导出完成 → {POSTS_DIR}")

# ============ 3. 导出页面 ============
print("\n📄 导出独立页面...")
cur.execute("""
    SELECT cid, title, slug, created, modified, text, commentsNum,
           allowComment, template, status
    FROM pgojcontents
    WHERE type = 'page'
    ORDER BY cid ASC
""")
pages = cur.fetchall()
print(f"   共 {len(pages)} 个页面")

page_slug_to_url = {}  # cid → Hugo URL path

for cid, title, slug, created, modified, text, commentsNum, \
    allowComment, template, status in pages:
    
    dt_created = datetime.fromtimestamp(created)
    dt_modified = datetime.fromtimestamp(modified)
    date_str = dt_created.strftime('%Y-%m-%dT%H:%M:%S+08:00')
    lastmod_str = dt_modified.strftime('%Y-%m-%dT%H:%M:%S+08:00')
    
    content = text or ''
    content = content.replace('/usr/uploads/', '/images/')
    
    hugo_url = f"/{slug or str(cid)}/"
    page_slug_to_url[cid] = hugo_url
    
    frontmatter = {
        'title': title,
        'date': date_str,
        'lastmod': lastmod_str,
        'slug': slug or str(cid),
    }
    
    # 特殊模板 → layout
    if template and template in TEMPLATE_MAP:
        frontmatter['layout'] = TEMPLATE_MAP[template]
    
    if allowComment == '0':
        frontmatter['comments'] = False
    else:
        frontmatter['comments'] = True
    
    if status == 'hidden':
        frontmatter['draft'] = False  # 保留发布但标记
        # 或者用 build 参数控制，这里先保持
        # frontmatter['_build'] = {'list': 'never', 'render': 'always'}
    
    # 归档页面特殊处理：保留隐藏页面数据但渲染
    status_note = "-hidden" if status == 'hidden' else ""
    filename = f"{slug or str(cid)}{status_note}.md"
    filepath = os.path.join(PAGES_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('---\n')
        yaml.dump(frontmatter, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        f.write('---\n\n')
        f.write(content)
    
    print(f"   {'[隐藏]' if status == 'hidden' else ''} {title} → {filename}")

print(f"   ✅ 页面导出完成 → {PAGES_DIR}")

# ============ 4. 导出评论 (Waline JSON) ============
print("\n💬 导出评论...")
cur.execute("""
    SELECT coid, cid, created, author, authorId, ownerId,
           mail, url, ip, agent, text, parent, type, status
    FROM pgojcomments
    WHERE status = 'approved'
    ORDER BY created ASC
""")
comments = cur.fetchall()
print(f"   共 {len(comments)} 条评论")

waline_comments = []
comment_id_map = {}  # Typecho coid → Waline import objectId

for coid, cid, created, author, authorId, ownerId, \
    mail, url, ip, agent, text, parent, ctype, status in comments:
    
    dt = datetime.fromtimestamp(created)
    inserted_at = dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    # 确定所属页面 URL
    if cid in post_slug_to_url:
        page_url = post_slug_to_url[cid]
    elif cid in page_slug_to_url:
        page_url = page_slug_to_url[cid]
    else:
        page_url = f"/archives/{cid}.html"  # fallback
    
    # 唯一 ID
    waline_obj_id = f"ty_{coid}"
    comment_id_map[coid] = waline_obj_id
    
    entry = {
        'objectId': waline_obj_id,
        'comment': text or '',
        'nick': author or '匿名',
        'mail': mail or '',
        'link': url or '',
        'ua': agent or '',
        'ip': ip or '',
        'insertedAt': inserted_at,
        'url': page_url,  # 所属页面
    }
    
    # 博主标记
    if authorId and ownerId and authorId == ownerId:
        entry['nick'] = entry['nick']  # 保留原名，Waline 通过 mail 判断博主
    
    # 父评论（回复）
    if parent and parent > 0:
        pid = f"ty_{parent}"
        entry['pid'] = pid
    
    waline_comments.append(entry)

# 保存 Waline JSON
waline_json_path = os.path.join(HUGO_ROOT, '_waline_import.json')
with open(waline_json_path, 'w', encoding='utf-8') as f:
    json.dump(waline_comments, f, ensure_ascii=False, indent=2)

print(f"   ✅ 评论导出完成 → {waline_json_path}")

# ============ 5. 拷贝附件 ============
print("\n🖼️ 拷贝附件...")
cur.execute("""
    SELECT cid, title, text FROM pgojcontents
    WHERE type = 'attachment' AND status = 'publish'
""")
attachments = cur.fetchall()

copied = 0
for cid, title, text in attachments:
    try:
        meta = json.loads(text) if text else {}
        rel_path = meta.get('path', '')
        if rel_path:
            # 去掉转义的反斜杠
            rel_path = rel_path.replace('\\/', '/')
            src_path = os.path.join(TYPECHO_ROOT, rel_path.lstrip('/'))
            # 保持原文件名的目标路径
            dest_name = os.path.basename(rel_path)
            dest_path = os.path.join(IMAGES_DIR, dest_name)
            
            if os.path.exists(src_path) and not os.path.exists(dest_path):
                shutil.copy2(src_path, dest_path)
                copied += 1
    except Exception as e:
        pass

print(f"   拷贝了 {copied}/{len(attachments)} 个附件")

# 也尝试递归拷贝整个 uploads 目录（如果存在）
src_uploads = os.path.join(TYPECHO_ROOT, 'usr', 'uploads')
if os.path.exists(src_uploads):
    for root, dirs, files in os.walk(src_uploads):
        for fn in files:
            src = os.path.join(root, fn)
            dest = os.path.join(IMAGES_DIR, fn)
            if not os.path.exists(dest):
                try:
                    shutil.copy2(src, dest)
                    copied += 1
                except:
                    pass
    print(f"   （总计拷贝 {copied} 个文件）")
else:
    print(f"   ⚠️ 上传目录不存在: {src_uploads}")

# ============ 6. 生成分类 _index.md ============
print("\n🏷️ 生成分类索引...")
for mid, cat in categories.items():
    cat_dir = os.path.join(CONTENT_DIR, cat['slug'])
    os.makedirs(cat_dir, exist_ok=True)
    index_file = os.path.join(cat_dir, '_index.md')
    with open(index_file, 'w', encoding='utf-8') as f:
        f.write(f"""---
title: "{cat['name']}"
date: 2026-01-15T00:00:00+08:00
layout: "category"
---

{cat['name']}的文章归档。
""")
    # 检查子分类
    if mid in cat_parents:
        parent_mid = cat_parents[mid]
        if parent_mid in categories:
            print(f"   子分类: {cat['name']} → 父: {categories[parent_mid]['name']}")

print(f"   分类索引生成完成")

# ============ 统计 ============
print(f"\n{'='*50}")
print(f"📊 迁移统计:")
print(f"   文章: {len(posts)} 篇")
print(f"   页面: {len(pages)} 个")
print(f"   评论: {len(waline_comments)} 条")
print(f"   分类: {len(categories)} 个")
print(f"   标签: {len(tags)} 个")
print(f"   附件: {len(attachments)} 个")
print(f"\n📁 输出位置:")
print(f"   文章目录: {POSTS_DIR}")
print(f"   页面目录: {PAGES_DIR}")
print(f"   评论JSON: {waline_json_path}")
print(f"   图片目录: {IMAGES_DIR}")
print(f"   分类目录: {CONTENT_DIR}")
print(f"{'='*50}")

# 清理
cur.close()
conn.close()
print("\n🎉 迁移完成！")
