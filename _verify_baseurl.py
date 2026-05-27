import os, re

for root, dirs, files in os.walk('public'):
    for f in files:
        if not f.endswith('.html'):
            continue
        path = os.path.join(root, f)
        with open(path, encoding='utf-8') as fp:
            content = fp.read()
        links = re.findall(r'href="(https?://[^"]+)"', content)
        if links:
            rel = os.path.relpath(path, 'public')
            print(f'{rel}: {links[:2]}')
            break
    else:
        continue
    break
