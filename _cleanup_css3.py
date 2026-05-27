"""Remove unused CSS from weisaygrace theme - handles minified single-line CSS."""
import re

# Read files
with open(r'e:\blog\themes\weisaygrace\assets\css\style.css', encoding='utf-8') as f:
    style = f.read()

with open(r'e:\blog\themes\weisaygrace\assets\css\dark.css', encoding='utf-8') as f:
    dark = f.read()

# Classes used in templates (confirmed by grep)
used = {
    'article-author', 'article-author-item', 'article-author-avatar', 'article-author-info',
    'article-404', '404-emoji',
}

# Unused class prefix patterns (matching at CSS block start)
# Format: (pattern, description)
unused_patterns = [
    # === touching comments (Waline alternative) ===
    (r'\.touching-', 'touching-*'),
    (r'\.comment-emoji', 'comment-emoji'),
    (r'\.emoji-smilies', 'emoji-smilies'),
    (r'\.emoji-post', 'emoji-post'),
    (r'\.hearticon', 'hearticon'),
    # === shang (打赏/赞赏) ===
    (r'\.shang', 'shang*'),
    # === qrcode ===
    (r'\.qrcode', 'qrcode*'),
    # === vip ===
    (r'\.vipicon', 'vipicon'),
    # === comment ajax tip ===
    (r'\.comment-ajax-tip', 'comment-ajax-tip'),
    # === link blogger ===
    (r'\.link-blogger', 'link-blogger'),
    (r'\.links-title', 'links-title'),
    (r'\.links-item', 'links-item'),
    # === archives ===
    (r'\.archives-statistics', 'archives-statistics'),
    (r'\.archives-content', 'archives-content'),
    (r'\.archives-info', 'archives-info'),
    (r'\.archives-title', 'archives-title'),
    (r'\.archives-counts', 'archives-counts'),
    (r'\.archives-count', 'archives-count'),
    # === car calendar archive ===
    (r'\.car-', 'car-*'),
    # === timeline archive ===
    (r'\.timeline-archive', 'timeline-archive'),
    (r'\.tl-archive', 'tl-archive*'),
    # === article index widget ===
    (r'\.article-index-widget', 'article-index-widget'),
    # === article related ===
    (r'\.article-related', 'article-related'),
    (r'\.related-', 'related-*'),
    (r'\.toggle-related-btn', 'toggle-related-btn'),
    # === fixed index ===
    (r'\.fixed-index', 'fixed-index'),
    # === roll toggle/top ===
    (r'\.roll-toggle', 'roll-toggle'),
    (r'\.roll-top', 'roll-top'),
    (r'\.sunmoon', 'sunmoon'),
    (r'\.sunicon', 'sunicon'),
    (r'\.moonicon', 'moonicon'),
    (r'\.rollicon', 'rollicon'),
    # === top bar/page ===
    (r'\.top-bar', 'top-bar'),
    (r'\.top-page', 'top-page'),
    (r'\.top-comment', 'top-comment'),
    # === about author ===
    (r'\.about-author', 'about-author'),
    (r'\.author-cover', 'author-cover'),
    # === reader wall ===
    (r'\.reader-wall', 'reader-wall'),
    # === widget links ===
    (r'\.widget-links', 'widget-links'),
    # === right side ===
    (r'\.right-side', 'right-side'),
    # === article phone ===
    (r'\.article-phone', 'article-phone'),
    # === headermenu ===
    (r'\.headermenu', 'headermenu'),
    # === menuside ===
    (r'\.menuside', 'menuside'),
    # === no posts ===
    (r'\.no-posts', 'no-posts'),
    # === comment touching ===
    (r'\.touching-comments-', 'touching-comments-*'),
    # === article mostactive ===
    (r'\.article-mostactive', 'article-mostactive'),
    # === pj-reply ===
    (r'\.pj-reply', 'pj-reply'),
    # === com-level ===
    (r'\.com-level', 'com-level'),
    # === mm-* mobile menu (removed from templates) ===
    (r'\.mm-', 'mm-*'),
    # === menu overlay ===
    (r'#menu-overlay', 'menu-overlay'),
    # === headermenu icon ===
    (r'\.icon-right', 'icon-right'),
]

def is_unused_selector(selector):
    """Check if a CSS selector is unused."""
    # Build a combined pattern
    for prefix, name in unused_patterns:
        # Remove dots and ^ for simple prefix match
        clean_prefix = prefix.lstrip('#.')
        if selector.startswith(clean_prefix) or selector.lstrip('#.').startswith(clean_prefix):
            return True
        # Also check if selector contains the pattern as a whole word
        for s in selector.split(','):
            s = s.strip().lstrip('#.')
            if s.startswith(clean_prefix):
                return True
    return False

def remove_blocks_minified(css):
    """Remove unused CSS blocks from minified (single-line) CSS."""
    result = []
    i = 0
    n = len(css)
    total_removed = 0

    while i < n:
        # Skip whitespace
        while i < n and css[i] in ' \t\n\r':
            result.append(css[i])
            i += 1

        if i >= n:
            break

        # Read selector(s) - everything until {
        sel_start = i
        while i < n and css[i] != '{':
            i += 1
        selector_part = css[sel_start:i].strip()
        selectors = [s.strip() for s in selector_part.split(',')]

        if i >= n:
            result.append(css[sel_start:i])
            break

        # Skip {
        i += 1
        depth = 1
        block_start = i

        while i < n and depth > 0:
            if css[i] == '{':
                depth += 1
            elif css[i] == '}':
                depth -= 1
            i += 1

        block_content = css[block_start:i-1]  # exclude closing }

        # Check if ALL selectors in this block are unused
        all_unused = all(is_unused_selector(s) for s in selectors if s)

        if all_unused and selectors:
            total_removed += len(selector_part) + len(block_content) + 2
        else:
            result.append(selector_part)
            result.append('{')
            result.append(block_content)
            result.append('}')

    return ''.join(result), total_removed

# Process style.css
style_new, style_removed = remove_blocks_minified(style)
print(f"style.css: removed ~{style_removed} bytes ({style_removed/1024:.1f} KB)")
print(f"style.css: {len(style)} -> {len(style_new)} bytes (net saved {(len(style)-len(style_new))/1024:.1f} KB)")

# Also remove @keyframes waveFlow from style.css
# Pattern: @keyframes waveFlow{...}
kw_pattern = r'@keyframes\s+waveFlow\s*\{(?:[^{}]|{[^}]*})*\}'
kw_match = list(re.finditer(kw_pattern, style_new))
if kw_match:
    for m in kw_match:
        print(f"  Found @keyframes waveFlow at {m.start()}: removing {len(m.group())} bytes")
    style_new = re.sub(kw_pattern, '', style_new)
    style_removed += sum(len(m.group()) for m in kw_match)

# Also remove .wave:hover block
wave_pattern = r'\.wave:hover[^{]*\{[^}]*\}'
wave_match = list(re.finditer(wave_pattern, style_new))
if wave_match:
    for m in wave_match:
        print(f"  Found .wave:hover at {m.start()}: removing {len(m.group())} bytes")
    style_new = re.sub(wave_pattern, '', style_new)
    style_removed += sum(len(m.group()) for m in wave_match)

# Remove .righticon block (.righticon:before etc - but keep .righticon as it's used in templates)
# Actually .righticon IS used in templates, let me check...

# Process dark.css
dark_new, dark_removed = remove_blocks_minified(dark)
print(f"\ndark.css: removed ~{dark_removed} bytes ({dark_removed/1024:.1f} KB)")
print(f"dark.css: {len(dark)} -> {len(dark_new)} bytes (net saved {(len(dark)-len(dark_new))/1024:.1f} KB)")

# Save for review
with open(r'e:\blog\themes\weisaygrace\assets\css\style.css.new', 'w', encoding='utf-8') as f:
    f.write(style_new)
with open(r'e:\blog\themes\weisaygrace\assets\css\dark.css.new', 'w', encoding='utf-8') as f:
    f.write(dark_new)

print(f"\nTotal savings: style={len(style)-len(style_new)} bytes, dark={len(dark)-len(dark_new)} bytes")
print(f"Saved .new files for review")
