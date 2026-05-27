import re, os

posts_dir = r'e:\blog\content\posts'
files = []
for f in os.listdir(posts_dir):
    if f.endswith('.md'):
        files.append(f)
files.sort()

# page2 = index 7-13 (each page shows 7 posts)
target_files = files[7:14]

for fname in target_files:
    path = os.path.join(posts_dir, fname)
    with open(path, encoding='utf-8') as f:
        content = f.read()

    m = re.search(r'^description:\s*(.+?)\s*$', content, re.MULTILINE)
    desc = m.group(1).strip() if m else '(无description)'

    t = re.search(r'^title:\s*(.+?)\s*$', content, re.MULTILINE)
    title = t.group(1).strip() if t else 'unknown'

    # 判断description是否含HTML标签或图片
    has_img = '<img' in desc or '<' in desc
    char_count = len(desc.replace('<','').replace('>','').replace(' ',''))

    print(f'=== {title} ===')
    print(f'文件: {fname}')
    print(f'description: {desc[:100]}')
    print(f'含HTML标签: {has_img}, 纯文字长度: {char_count}')
    print()
