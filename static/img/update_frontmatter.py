import os, re

content_dir = r"E:\blog\content\posts"

# 需要更新的映射（thumbs jpg -> webp）
mapping = {
    "/img/thumbs/tu01.jpg": "/img/webp/tu01.webp",
    "/img/thumbs/tu02.jpg": "/img/webp/tu02.webp",
    "/img/thumbs/tu03.jpg": "/img/webp/tu03.webp",
    "/img/thumbs/tu04.jpg": "/img/webp/tu04.webp",
    "/img/thumbs/tu05.jpg": "/img/webp/tu05.webp",
    "/img/thumbs/tu06.jpg": "/img/webp/tu06.webp",
    "/img/thumbs/tu07.jpg": "/img/webp/tu07.webp",
    "/img/thumbs/tu08.jpg": "/img/webp/tu08.webp",
    "/img/thumbs/tu09.jpg": "/img/webp/tu09.webp",
    "/img/thumbs/tu10.jpg": "/img/webp/tu10.webp",
    "/img/thumbs/tu11.jpg": "/img/webp/tu11.webp",
    "/img/thumbs/tu12.jpg": "/img/webp/tu12.webp",
    "/img/thumbs/tu13.jpg": "/img/webp/tu13.webp",
}

changed_files = []

for fname in os.listdir(content_dir):
    if not fname.endswith(".md"):
        continue
    fpath = os.path.join(content_dir, fname)
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
    
    new_content = content
    for old, new in mapping.items():
        new_content = new_content.replace(old, new)
    
    if new_content != content:
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(new_content)
        changed_files.append(fname)

print(f"共更新 {len(changed_files)} 篇文章:")
for f in changed_files:
    print(f"  - {f}")
