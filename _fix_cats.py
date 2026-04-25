import os, glob
count = 0
for f in glob.glob('content/posts/*.md'):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    new = content.replace("categories: ['散言']", "categories: ['guangan']").replace("categories: ['片语']", "categories: ['weibo']")
    if new != content:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.write(new)
        count += 1
print(f'Modified {count} files')
