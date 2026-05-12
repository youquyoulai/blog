#!/usr/bin/env python3
"""检查所有文章中的中文标签"""
import os, re

for root, dirs, files in os.walk('content/posts'):
    for f in files:
        if not f.endswith('.md'):
            continue
        path = os.path.join(root, f)
        with open(path, encoding='utf-8') as fp:
            content = fp.read()
        m = re.search(r'^tags:\s*\[(.+?)\]', content, re.M)
        if not m:
            continue
        raw = m.group(1)
        tags = re.findall(r'["\']([^"\']+)["\']', raw)
        for t in tags:
            # 检查是否包含中文
            if re.search(r'[\u4e00-\u9fff]', t):
                print(f'{path}: tags = [{raw}]')
                break
