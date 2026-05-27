#!/usr/bin/env python3
"""清理 weisaygrace 主题中未使用的 CSS 规则"""
import re

css_path = r'e:\blog\themes\weisaygrace\assets\css\style.css'
with open(css_path, encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f'原始大小: {original_size} bytes')

# 定义要清理的模式: (pattern, description)
# pattern 可以是正则（包含 CSS 选择器的行）或简单字符串
patterns_to_remove = []

# 1. .vip* VIP 等级样式 (Waline 没有 VIP 概念)
# 匹配 .vip1 到 .vip12 的完整规则块
patterns_to_remove.append((r'\.vip\d[^{]*\{[^}]+\}', '.vip* VIP样式'))

# 2. .com-level 相关（VIP 计数器样式）
patterns_to_remove.append((r'\.com-level[^{]*\{[^}]+\}', '.com-level样式'))

# 3. .article-mostactive（只在 mobile 隐藏，没有实际元素）
patterns_to_remove.append((r'\.article-mostactive[^{]*\{[^}]+\}', '.article-mostactive样式'))

# 4. .article-404（只在 404 页面用，很少量）
patterns_to_remove.append((r'\.article-404[^{]*\{[^}]+\}', '.article-404样式'))

# 5. .pj-reply (WordPress 评论插件样式)
patterns_to_remove.append((r'\.pj-reply[^{]*\{[^}]+\}', '.pj-reply样式'))

removed_count = {}
for pattern, desc in patterns_to_remove:
    count = len(re.findall(pattern, content))
    new_content = re.sub(pattern, '', content)
    if len(new_content) < len(content):
        removed_count[desc] = count
        content = new_content

# 清理空行和多余的空白
content = re.sub(r'\n{3,}', '\n\n', content)
content = content.strip() + '\n'

new_size = len(content)
saved = original_size - new_size
print(f'清理后大小: {new_size} bytes')
print(f'节省: {saved} bytes ({saved/original_size*100:.1f}%)')
print('\n清理的规则:')
for desc, count in removed_count.items():
    print(f'  {desc}: {count}处')

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('\n已写入文件')
