import sys

# Read waline.js
with open('E:/blog/static/js/waline/waline.js', 'rb') as f:
    data = f.read()

count = data.count(b'unpkg.com/@waline')
if count > 0:
    data = data.replace(b'unpkg.com/@waline', b'cdn.jsdelivr.net/npm/@waline')
    with open('E:/blog/static/js/waline/waline.js', 'wb') as f:
        f.write(data)
    print(f'waline.js: replaced {count} occurrences')
else:
    print('waline.js: no unpkg.com found')

# Read waline.css
try:
    with open('E:/blog/static/js/waline/waline.css', 'rb') as f:
        data = f.read()
    count = data.count(b'unpkg.com')
    if count > 0:
        data = data.replace(b'unpkg.com', b'cdn.jsdelivr.net/npm')
        with open('E:/blog/static/js/waline/waline.css', 'wb') as f:
            f.write(data)
        print(f'waline.css: replaced {count} occurrences')
    else:
        print('waline.css: no unpkg.com found')
except FileNotFoundError:
    print('waline.css: file not found')
