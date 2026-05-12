import os, re

tags = set()
for root, dirs, files in os.walk('content/posts'):
    for f in files:
        if f.endswith('.md'):
            path = os.path.join(root, f)
            try:
                with open(path, encoding='utf-8') as fp:
                    content = fp.read()
                    m = re.search(r'^tags:\s*\[(.+?)\]', content, re.M)
                    if m:
                        for t in re.findall(r'"([^"]+)"', m.group(1)):
                            tags.add(t)
            except:
                pass

for t in sorted(tags):
    print(t)
