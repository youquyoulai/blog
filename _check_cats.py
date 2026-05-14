import os

posts_dir = r'e:\blog\content\posts'
bad = []
for f in os.listdir(posts_dir):
    if not f.endswith('.md'):
        continue
    try:
        content = open(os.path.join(posts_dir, f), encoding='utf-8').read()
    except:
        continue
    for keyword in ['categories: [记录]', 'categories: 记录', 'categories: [观感]', 'categories: 观感', 'categories: [微博]', 'categories: 微博', 'categories: [微语]', 'categories: 微语']:
        if keyword in content:
            bad.append((f, keyword))
            break

print(f'找到 {len(bad)} 篇文章 categories 是中文：')
for f, kw in bad:
    print(f'  {f}  ({kw})')
