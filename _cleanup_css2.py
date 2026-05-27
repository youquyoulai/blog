"""Remove unused CSS from weisaygrace theme."""
import re

def remove_blocks(css, patterns):
    """Remove CSS blocks matching any of the patterns."""
    # Match CSS blocks: .classname { ... }
    # We need to handle nested braces properly
    result = css
    for pattern in patterns:
        # Match .classname { ... } blocks
        # More robust: find all blocks and keep only unused ones
        pass
    return result

# Read style.css
with open(r'e:\blog\themes\weisaygrace\assets\css\style.css', encoding='utf-8') as f:
    style = f.read()

# Read dark.css
with open(r'e:\blog\themes\weisaygrace\assets\css\dark.css', encoding='utf-8') as f:
    dark = f.read()

# Patterns for unused CSS blocks in style.css
# These are classes that don't exist in any template
unused_style_blocks = [
    # Block patterns (selector { ... })
    (r'\.touching-[a-z\-]*\{[^}]*\}', 'touching-*'),
    (r'\.touching[a-z\-]*\{[^}]*\}', 'touching*'),
    (r'\.comment-emoji[a-z\-]*\{[^}]*\}', 'comment-emoji*'),
    (r'\.emoji-smilies[a-z\-]*\{[^}]*\}', 'emoji-smilies*'),
    (r'\.emoji-post[a-z\-]*\{[^}]*\}', 'emoji-post*'),
    (r'\.vipicon[a-z\-]*\{[^}]*\}', 'vipicon'),
    (r'\.comment-ajax-tip[a-z\-]*\{[^}]*\}', 'comment-ajax-tip*'),
    (r'\.comment-edit-link[a-z\-]*\{[^}]*\}', 'comment-edit-link'),
    (r'\.shang[a-z\-]*\{[^}]*\}', 'shang*'),
    (r'\.qrcode[a-z\-]*\{[^}]*\}', 'qrcode*'),
    (r'\.link-blogger[a-z\-]*\{[^}]*\}', 'link-blogger*'),
    (r'\.links-title[a-z\-]*\{[^}]*\}', 'links-title'),
    (r'\.links-item[a-z\-]*\{[^}]*\}', 'links-item'),
    (r'\.archives-statistics[a-z\-]*\{[^}]*\}', 'archives-statistics'),
    (r'\.archives-content[a-z\-]*\{[^}]*\}', 'archives-content'),
    (r'\.archives-info[a-z\-]*\{[^}]*\}', 'archives-info'),
    (r'\.archives-title[a-z\-]*\{[^}]*\}', 'archives-title'),
    (r'\.archives-counts[a-z\-]*\{[^}]*\}', 'archives-counts'),
    (r'\.car-container[a-z\-]*\{[^}]*\}', 'car-container'),
    (r'\.car-collapse[a-z\-]*\{[^}]*\}', 'car-collapse'),
    (r'\.car-yearmonth[a-z\-]*\{[^}]*\}', 'car-yearmonth'),
    (r'\.car-list[a-z\-]*\{[^}]*\}', 'car-list'),
    (r'\.car-plus[a-z\-]*\{[^}]*\}', 'car-plus'),
    (r'\.car-minus[a-z\-]*\{[^}]*\}', 'car-minus'),
    (r'\.cy-yeartitle[a-z\-]*\{[^}]*\}', 'cy-yeartitle'),
    (r'\.cy-archive-count[a-z\-]*\{[^}]*\}', 'cy-archive-count'),
    (r'\.car-days[a-z\-]*\{[^}]*\}', 'car-days'),
    (r'\.timeline-archive[a-z\-]*\{[^}]*\}', 'timeline-archive'),
    (r'\.tl-archive[a-z\-]*\{[^}]*\}', 'tl-archive*'),
    (r'\.tl-archive-ul[a-z\-]*\{[^}]*\}', 'tl-archive-ul'),
    (r'\.tl-archive-box[a-z\-]*\{[^}]*\}', 'tl-archive-box'),
    (r'\.tl-archive-year[a-z\-]*\{[^}]*\}', 'tl-archive-year'),
    (r'\.tl-archive-img[a-z\-]*\{[^}]*\}', 'tl-archive-img'),
    (r'\.tl-archive-date[a-z\-]*\{[^}]*\}', 'tl-archive-date'),
    (r'\.tl-archive-title[a-z\-]*\{[^}]*\}', 'tl-archive-title'),
    (r'\.tl-archive-count[a-z\-]*\{[^}]*\}', 'tl-archive-count'),
    (r'\.tl-archive-commentcount[a-z\-]*\{[^}]*\}', 'tl-archive-commentcount'),
    (r'\.article-index-widget[a-z\-]*\{[^}]*\}', 'article-index-widget'),
    (r'\.article-related[a-z\-]*\{[^}]*\}', 'article-related*'),
    (r'\.related-list[a-z\-]*\{[^}]*\}', 'related-list*'),
    (r'\.related-img[a-z\-]*\{[^}]*\}', 'related-img*'),
    (r'\.related-date[a-z\-]*\{[^}]*\}', 'related-date'),
    (r'\.related-cc[a-z\-]*\{[^}]*\}', 'related-cc'),
    (r'\.toggle-related-btn[a-z\-]*\{[^}]*\}', 'toggle-related-btn'),
    (r'\.fixed-index[a-z\-]*\{[^}]*\}', 'fixed-index'),
    (r'\.roll-toggle[a-z\-]*\{[^}]*\}', 'roll-toggle*'),
    (r'\.roll-top[a-z\-]*\{[^}]*\}', 'roll-top*'),
    (r'\.sunmoon[a-z\-]*\{[^}]*\}', 'sunmoon'),
    (r'\.sunicon[a-z\-]*\{[^}]*\}', 'sunicon'),
    (r'\.moonicon[a-z\-]*\{[^}]*\}', 'moonicon'),
    (r'\.rollicon[a-z\-]*\{[^}]*\}', 'rollicon'),
    (r'\.top-bar[a-z\-]*\{[^}]*\}', 'top-bar*'),
    (r'\.top-page[a-z\-]*\{[^}]*\}', 'top-page*'),
    (r'\.top-comment[a-z\-]*\{[^}]*\}', 'top-comment*'),
    (r'\.about-author[a-z\-]*\{[^}]*\}', 'about-author*'),
    (r'\.author-avatar[a-z\-]*\{[^}]*\}', 'author-avatar*'),
    (r'\.author-name[a-z\-]*\{[^}]*\}', 'author-name'),
    (r'\.author-description[a-z\-]*\{[^}]*\}', 'author-description'),
    (r'\.author-cover[a-z\-]*\{[^}]*\}', 'author-cover'),
    (r'\.stat-number[a-z\-]*\{[^}]*\}', 'stat-number'),
    (r'\.stat-label[a-z\-]*\{[^}]*\}', 'stat-label'),
    (r'\.reader-wall[a-z\-]*\{[^}]*\}', 'reader-wall*'),
    (r'\.reader-wall-list[a-z\-]*\{[^}]*\}', 'reader-wall-list'),
    (r'\.widget-links[a-z\-]*\{[^}]*\}', 'widget-links'),
    (r'\.right-side[a-z\-]*\{[^}]*\}', 'right-side*'),
    (r'\.article-phone[a-z\-]*\{[^}]*\}', 'article-phone*'),
    (r'\.headermenu[a-z\-]*\{[^}]*\}', 'headermenu*'),
    (r'\.menuside[a-z\-]*\{[^}]*\}', 'menuside*'),
    (r'\.no-posts[a-z\-]*\{[^}]*\}', 'no-posts'),
    (r'\.hearticon[a-z\-]*\{[^}]*\}', 'hearticon'),
    (r'\.article-mostactive[a-z\-]*\{[^}]*\}', 'article-mostactive'),
    (r'\.pj-reply[a-z\-]*\{[^}]*\}', 'pj-reply'),
    # mm-* mobile menu (removed from templates)
    (r'\.mm-[a-z][a-z\-]*\{[^}]*\}', 'mm-* mobile menu'),
    # Mobile menu related
    (r'#menu-overlay[a-z\-]*\{[^}]*\}', 'menu-overlay'),
    # comment touching
    (r'\.touching-comments-button[a-z\-]*\{[^}]*\}', 'touching-comments-button'),
    (r'\.touching-comments-chosen[a-z\-]*\{[^}]*\}', 'touching-comments-chosen'),
    # @keyframes waveFlow
    (r'@keyframes waveFlow[a-zA-Z0-9\s\-\.,;:]+\}', '@keyframes waveFlow'),
    # .wave:hover
    (r'\.wave:hover[^{]*\{[^}]*\}', '.wave:hover'),
]

def remove_css_blocks(text, patterns):
    """Remove CSS blocks matching patterns. Handle nested braces."""
    original_len = len(text)
    removed_total = 0

    for pattern, name in patterns:
        # Match block start: .selector {
        # We need to find the matching closing }
        regex = re.compile(r'(?:' + pattern + r')\s*\{(?:[^{}]|{[^}]*})*\}', re.DOTALL)
        while True:
            match = regex.search(text)
            if not match:
                break
            removed_total += match.end() - match.start()
            text = text[:match.start()] + text[match.end():]

    return text, removed_total

def remove_css_blocks_v2(text, patterns):
    """More robust CSS block removal - handle nested braces up to 1 level."""
    original_len = len(text)
    removed_total = 0
    new_lines = []
    in_block = False
    block_depth = 0
    block_start = 0
    block_selector = ""
    current_selector = ""

    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not in_block:
            # Check if this line starts a block
            # Look for .classname { or @keyframes { or similar
            # Skip if matches any unused pattern
            matched = False
            matched_name = ""
            for pattern, name in patterns:
                if re.match(r'^' + pattern.replace(r'\.', '.').replace(r'\[', '[').replace(r'\]', ']').replace(r'\*', '.*') + r'\s*\{', line):
                    matched = True
                    matched_name = name
                    break

            if matched:
                # Skip this entire block
                in_block = True
                block_depth = 1
                block_start = i
                # Count { and } on this line
                count_open = line.count('{')
                count_close = line.count('}')
                block_depth += count_open - count_close
                # If depth goes to 0, block ends on same line
                while block_depth > 0:
                    i += 1
                    if i >= len(lines):
                        break
                    l = lines[i]
                    block_depth += l.count('{') - l.count('}')
                removed_total += sum(len(lines[j]) + 1 for j in range(block_start, i))
                continue
            else:
                new_lines.append(lines[i])
        else:
            # Skip lines until block ends
            block_depth += line.count('{') - line.count('}')
            if block_depth <= 0:
                in_block = False
        i += 1

    return '\n'.join(new_lines), removed_total

# Actually, let me use a simpler approach - find blocks by matching braces
def strip_blocks(text, patterns):
    """Strip CSS blocks that match any pattern."""
    removed = 0
    result = []
    i = 0
    n = len(text)

    while i < n:
        # Skip whitespace
        ws_start = i
        while i < n and text[i] in ' \t\n\r':
            i += 1
        ws = text[ws_start:i]
        result.append(ws)

        if i >= n:
            break

        # Read selector (everything until {)
        sel_start = i
        while i < n and text[i] != '{':
            i += 1
        selector = text[sel_start:i].strip()

        if i >= n:
            result.append(text[sel_start:i])
            break

        # Now in block - find matching }
        i += 1  # skip {
        depth = 1
        block_start = i
        while i < n and depth > 0:
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
            i += 1
        block_content = text[block_start:i-1]  # exclude the }

        # Check if selector matches any unused pattern
        matched = False
        for pattern, name in patterns:
            try:
                if re.match(r'^' + pattern + r'\s*$', selector):
                    matched = True
                    removed += len(selector) + len(block_content) + 2  # +2 for {}
                    break
            except re.error:
                pass

        if not matched:
            result.append(selector)
            result.append('{')
            result.append(block_content)
            result.append('}')

    return ''.join(result), removed

style_new, style_removed = strip_blocks(style, unused_style_blocks)
print(f"style.css: removed ~{style_removed} bytes ({(style_removed)/1024:.1f} KB)")
print(f"style.css: {len(style)} -> {len(style_new)} bytes (saved {(len(style)-len(style_new))/1024:.1f} KB)")

# Now dark.css - patterns that match .dark .selector {
dark_patterns = []
for pattern, name in unused_style_blocks:
    # Add .dark\b prefix
    dark_patterns.append((r'dark\s+' + pattern.lstrip(r'\.'), name))

dark_new, dark_removed = strip_blocks(dark, dark_patterns)
print(f"dark.css: removed ~{dark_removed} bytes ({(dark_removed)/1024:.1f} KB)")
print(f"dark.css: {len(dark)} -> {len(dark_new)} bytes (saved {(len(dark)-len(dark_new))/1024:.1f} KB)")

# Also remove unused dark mode tokens (Prism syntax highlighting tokens)
# These are .dark .token.xxx { ... } blocks
token_pattern = r'dark\s+\.token\.[a-z\-]+'
token_matches = list(re.finditer(token_pattern, dark))
print(f"\nPrism token blocks in dark.css: {len(token_matches)}")

# Save results for inspection
with open(r'e:\blog\themes\weisaygrace\assets\css\style.css.new', 'w', encoding='utf-8') as f:
    f.write(style_new)
with open(r'e:\blog\themes\weisaygrace\assets\css\dark.css.new', 'w', encoding='utf-8') as f:
    f.write(dark_new)

print(f"\nSaved .new files for review")
print(f"Total estimated savings: ~{(len(style)-len(style_new)) + (len(dark)-len(dark_new))} bytes")
