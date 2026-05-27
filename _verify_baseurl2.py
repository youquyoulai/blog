import os, re

for root, dirs, files in os.walk('public/archives'):
    for f in files:
        if not f.endswith('.html'):
            continue
        path = os.path.join(root, f)
        with open(path, encoding='utf-8') as fp:
            content = fp.read()
        links = re.findall(r'href="(https?://[^"]+)"', content)
        internal = [l for l in links if 'waline' not in l]
        rel = os.path.relpath(path, 'public')
        print(rel + ': ' + str(internal[:3] if internal else '(all local or waline)'))
        break
    break
