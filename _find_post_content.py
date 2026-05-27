with open(r'e:\blog\themes\weisaygrace\assets\css\style.css', encoding='utf-8') as f:
    content = f.read()
idx = content.find('.post-content')
if idx >= 0:
    print('Found at index:', idx)
    end = content.find('}', idx)
    print(content[idx:end+1])
else:
    print('not found')

# Also check .post-content p
idx2 = content.find('.post-content p')
if idx2 >= 0:
    end2 = content.find('}', idx2)
    print(content[idx2:end2+1])
else:
    print('no .post-content p')

# And .main .post
idx3 = content.find('.main .post')
if idx3 >= 0:
    end3 = content.find('}', idx3)
    print(content[idx3:end3+1])
else:
    print('no .main .post')
