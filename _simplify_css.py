#!/usr/bin/env python3
"""简化 CSS 中冗长的选择器"""
import re

css_path = r'e:\blog\themes\weisaygrace\assets\css\style.css'
with open(css_path, encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f'原始大小: {original_size} bytes')

# 简化1: .main .article .article-content -> .article-content
content = re.sub(r'\.main \.article \.article-content', '.article-content', content)

# 简化2: Waline 移动端评论嵌套
content = content.replace(
    '.comment-list li.comment ul.children ul.children ul.children ul.children ul.children',
    '.comment-list .children-deep'
)
content = content.replace(
    '.comment-list li.comment ul.children ul.children ul.children ul.children',
    '.comment-list .children-deep'
)
content = content.replace(
    '.comment-list li.comment ul.children ul.children ul.children',
    '.comment-list .children-deep'
)
content = re.sub(r'\.children-deep', '.children', content)

# 简化3: .main .article .article-content h1:before/after -> .article h1::before/after
for tag in ['h1','h2','h3','h4','h5','h6']:
    for pseudo in ['before', 'after']:
        old = f'.main .article .article-content {tag}:{pseudo}'
        new = f'.article {tag}::{pseudo}'
        content = content.replace(old, new)

# 简化4: .main .article .article-content p -> .article-content p
for tag in ['p', 'table', 'blockquote', 'ol', 'ul', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'input', 'label', 'img']:
    content = content.replace(f'.main .article .article-content {tag}', f'.article-content {tag}')
content = content.replace('.main .article .article-content table th', '.article-content th')
content = content.replace('.main .article .article-content table td', '.article-content td')

# 清理空行
content = re.sub(r'\n{3,}', '\n\n', content)
content = content.strip() + '\n'

new_size = len(content)
saved = original_size - new_size
print(f'简化后大小: {new_size} bytes')
print(f'节省: {saved} bytes ({saved/original_size*100:.1f}%)')

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('已写入文件')
