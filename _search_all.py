@echo off
cd /d e:\blog
"C:\Users\youqu\.workbuddy\binaries\python\versions\3.13.12\python.exe" -c "
import os, re
for root, dirs, files in os.walk('.'):
    # skip public, resources, .git
    dirs[:] = [d for d in dirs if d not in ('public','resources','.git','.workbuddy')]
    for f in files:
        if not f.endswith('.md'):
            continue
        path = os.path.join(root, f)
        try:
            with open(path, encoding='utf-8') as fp:
                content = fp.read()
            # check for tags with Chinese
            if re.search(r'tags:\s*\[.*[\u4e00-\u9fff]', content, re.M):
                m = re.search(r'^tags:\s*\[(.+?)\]', content, re.M)
                if m:
                    print(f'FOUND CHINESE: {path}: {m.group(0)[:80]}')
        except Exception as e:
            pass
print('SEARCH COMPLETE')
"
