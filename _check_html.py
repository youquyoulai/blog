content = open(r'e:\blog\public\archives\li-xiang-bao-kan-ting.html\index.html', encoding='utf-8').read()
idx = content.find('meta-category')
if idx >= 0:
    print(content[idx:idx+300])
else:
    print('meta-category not found')
    # 搜索 jilu
    idx2 = content.find('jilu')
    if idx2 >= 0:
        print('Found jilu at:', idx2)
        print(content[idx2-50:idx2+100])
    else:
        # 搜索 记录
        idx3 = content.find('记录')
        if idx3 >= 0:
            print('Found 记录 at:', idx3)
            print(content[idx3-100:idx3+200])
