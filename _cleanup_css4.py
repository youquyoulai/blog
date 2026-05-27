"""Remove unused CSS from weisaygrace theme - proper parser."""
import re

with open(r'e:\blog\themes\weisaygrace\assets\css\style.css', encoding='utf-8') as f:
    style = f.read()

with open(r'e:\blog\themes\weisaygrace\assets\css\dark.css', encoding='utf-8') as f:
    dark = f.read()

# Unused class/id prefixes
unused_prefixes = {
    '.touching-', '.touching',  # touching comments
    '.comment-emoji', '.emoji-smilies', '.emoji-post', '.hearticon',
    '.shang',  # 打赏
    '.qrcode',  # 二维码
    '.vipicon',
    '.comment-ajax-tip', '.comment-ajax-tip-error',
    '.comment-edit-link', '.comment-edit',
    '.link-blogger', '.links-title', '.links-item',
    '.archives-statistics', '.archives-content', '.archives-info',
    '.archives-title', '.archives-counts', '.archives-count',
    '.car-',  # calendar archive
    '.timeline-archive',
    '.tl-archive', '.tl-archive-ul', '.tl-archive-box', '.tl-archive-year',
    '.tl-archive-img', '.tl-archive-date', '.tl-archive-title',
    '.tl-archive-count', '.tl-archive-commentcount',
    '.article-index-widget',
    '.article-related', '.related-', '.toggle-related-btn',
    '.fixed-index',
    '.roll-toggle', '.roll-top', '.sunmoon', '.sunicon', '.moonicon', '.rollicon',
    '.top-bar', '.top-page', '.top-comment',
    '.about-author', '.author-cover',
    '.reader-wall', '.reader-wall-list',
    '.widget-links',
    '.right-side',
    '.article-phone',
    '.headermenu', '.menuside',
    '.no-posts',
    '.touching-comments-',
    '.article-mostactive',
    '.pj-reply',
    '.com-level',
    '.mm-',  # mobile menu
    '#menu-overlay',
    '.icon-right',
}

def selector_is_unused(sel):
    """Check if a selector contains any unused class/id."""
    # Extract all class and id names from selector
    parts = re.findall(r'[.#][\w-]+', sel)
    for p in parts:
        for prefix in unused_prefixes:
            if prefix.startswith('.'):
                if p == prefix or p.startswith(prefix):
                    return True
            elif prefix.startswith('#'):
                if p == prefix:
                    return True
    return False

def remove_unused_blocks(css):
    """Remove CSS blocks where ALL selectors are unused."""
    result = []
    i = 0
    n = len(css)
    removed_total = 0

    while i < n:
        # Skip whitespace
        ws_start = i
        while i < n and css[i] in ' \t\n\r':
            i += 1
        result.append(css[ws_start:i])

        if i >= n:
            break

        # Extract selector(s)
        sel_start = i
        depth = 0
        while i < n:
            if css[i] == '{':
                if depth == 0:
                    break
                depth += 1
            elif css[i] == '}':
                if depth == 0:
                    # Unmatched }
                    break
                depth -= 1
            i += 1

        selector_part = css[sel_start:i].strip()

        if i >= n or css[i] != '{':
            result.append(css[sel_start:])
            break

        # Parse selector block
        i += 1  # skip {
        depth = 1
        block_start = i
        while i < n and depth > 0:
            if css[i] == '{':
                depth += 1
            elif css[i] == '}':
                depth -= 1
            i += 1
        block_content = css[block_start:i-1]

        # Split by comma to handle multi-selector
        selectors = [s.strip() for s in selector_part.split(',')]
        all_unused = all(selector_is_unused(s) for s in selectors if s.strip())

        # Also check for @keyframes
        is_keyframes = selector_part.startswith('@keyframes')
        # Also check for @media
        is_media = selector_part.startswith('@media')

        if all_unused and not is_media:
            removed_total += len(selector_part) + len(block_content) + 2
        else:
            result.append(selector_part)
            result.append('{')
            result.append(block_content)
            result.append('}')

    return ''.join(result), removed_total

# Special: also check for @keyframes waveFlow and .wave:hover
# These are single selectors so they won't be caught by multi-selector logic

style_new, style_removed = remove_unused_blocks(style)
print(f"style.css: removed ~{style_removed} bytes ({style_removed/1024:.1f} KB)")
print(f"style.css: {len(style)} -> {len(style_new)} bytes (net saved {(len(style)-len(style_new))/1024:.1f} KB)")

# Also remove @keyframes waveFlow
kw_match = re.search(r'@keyframes\s+waveFlow\s*\{(?:[^{}]|{[^}]*})*\}', style_new)
if kw_match:
    print(f"  Also removing @keyframes waveFlow ({len(kw_match.group())} bytes)")
    style_new = style_new[:kw_match.start()] + style_new[kw_match.end():]
    style_removed += len(kw_match.group())

# Also remove .wave:hover
wave_match = re.search(r'\.wave:hover[^{]*\{[^}]*\}', style_new)
if wave_match:
    print(f"  Also removing .wave:hover ({len(wave_match.group())} bytes)")
    style_new = style_new[:wave_match.start()] + style_new[wave_match.end():]
    style_removed += len(wave_match.group())

# Process dark.css
dark_new, dark_removed = remove_unused_blocks(dark)
print(f"\ndark.css: removed ~{dark_removed} bytes ({dark_removed/1024:.1f} KB)")
print(f"dark.css: {len(dark)} -> {len(dark_new)} bytes (net saved {(len(dark)-len(dark_new))/1024:.1f} KB)")

# Save
with open(r'e:\blog\themes\weisaygrace\assets\css\style.css.new', 'w', encoding='utf-8') as f:
    f.write(style_new)
with open(r'e:\blog\themes\weisaygrace\assets\css\dark.css.new', 'w', encoding='utf-8') as f:
    f.write(dark_new)

print(f"\nTotal: style saved {len(style)-len(style_new)} bytes, dark saved {len(dark)-len(dark_new)} bytes")
