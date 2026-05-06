import re

with open(r'e:\blog\static\admin\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 找到 buildFrontmatter 函数的位置并替换
old_func_start = 'function buildFrontmatter(title, date, category, tags, slug) {'
old_func_end = '}'

start_idx = content.find(old_func_start)
if start_idx == -1:
    print('未找到 buildFrontmatter 函数')
else:
    # 找到函数结束的 }
    end_idx = content.find(old_func_end, start_idx)
    # 往前找到最后一个 }
    # 实际上需要找到函数体的结束
    # 简化：直接替换从 start_idx 到包含 `---` 和 `};` 的部分
    
    # 更可靠的方法：按行分割，找到函数起始和结束
    lines = content.split('\n')
    start_line = None
    end_line = None
    brace_count = 0
    for i, line in enumerate(lines):
        if 'function buildFrontmatter' in line:
            start_line = i
        if start_line is not None:
            brace_count += line.count('{') - line.count('}')
            if brace_count == 0 and i > start_line:
                end_line = i
                break
    
    if start_line is not None and end_line is not None:
        new_func = """function buildFrontmatter(title, date, category, tags, slug) {
  const cats = category ? category : 'jilu';
  const tagArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const tagLine = tagArr.length > 0 ? '\\ntags: [' + tagArr.map(t => '"' + t + '"').join(', ') + ']' : '';
  const slugLine = slug ? '\\nslug: "' + slug + '"' : '';
  return '---\\n' +
    'title: "' + title + '"\\n' +
    'date: ' + date + '\\n' +
    'categories: ' + cats + '\\n' +
    tagLine + slugLine + '\\n' +
    '---\\n';
}"""
        lines[start_line:end_line+1] = [new_func]
        with open(r'e:\blog\static\admin\index.html', 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print('替换成功！')
    else:
        print('未找到函数结束位置')
