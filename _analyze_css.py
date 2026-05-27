import re

with open(r'e:\blog\themes\weisaygrace\assets\css\style.css', encoding='utf-8') as f:
    css = f.read()

# Classes used in templates (confirmed by grep)
used_classes = {
    'article-author', 'article-author-item', 'article-author-avatar', 'article-author-info',
    'article-404', '404-emoji', 'article',
    # single.html page layout
    'header', 'header-navigation', 'container', 'main', 'sidebar', 'footer',
    'nav-sitename', 'main-nav', 'sidebar-toggle-btn', 'website', 'blogdescription',
    'article-navigation', 'nav-item', 'nav-item-content', 'nav-item-label', 'nav-item-title',
    'nav-item-empty', 'nav-item-image', 'nav-prev', 'nav-next',
    # post cards
    'post-card', 'card-item', 'post-title', 'post-thumbnail', 'card-category', 'card-comments',
    'post-meta', 'fn', 'views', 'post-content', 'card-2', 'card-3', 'card-4',
    # pagination
    'pagination', 'prev', 'next', 'dots', 'current', 'fenye',
    # article
    'article-title', 'article-info', 'article-infomation', 'article-content',
    'posticon', 'article-tag', 'article-tag-item', 'article-tag-count', 'topicicon',
    'article-navigation', 'nav-item',
    # sidebar
    'widget', 'widget-title', 'widget-tags', 'tag-link-count',
    # comment
    'comment-list', 'comment', 'children', 'thread-alt', 'comment-body',
    'comment-avatar', 'comment-box', 'comment-name', 'floor', 'comment-content',
    'comment-approved', 'comment-info', 'ip-location', 'reply', 'comment-edit-link',
    'post-author', 'comment-respond', 'comment-reply-title', 'must-log-in', 'comment-form',
    'comment-notes', 'comment-author', 'required', 'comment-change', 'comment-frame',
    'comment-author-avatar', 'comment-post', 'comment-author-info', 'comment-input',
    'comment-tips', 'form-submit',
    # common
    'skip-link', 'nav-sitename', 'iconfont', 'posticon', 'topicicon', 'expandicon', 'righticon',
    'clear', 'newicon', 'alignleft', 'alignright', 'aligncenter', 'alignnone',
    'wp-caption', 'wp-block-image', 'wp-block-gallery', 'wp-block-search', 'wp-block-heading',
    'wp-block-categories', 'wp-block-archives', 'wp-block-latest-comments', 'wp-block-tag-cloud',
    'wp-block-table', 'wp-block-code', 'wp-block-calendar', 'wp-block-details', 'wp-block-verse',
    'wp-block-buttons',
    # page-tag
    'page-tag', 'tag-index', 'tag-list', 'tag-cloud', 'tag-cloud-item', 'tag-cloud-count',
    # search
    'search-box', 'search-box-item',
    # wave
    'wave',
    # thumbnail
    'thumbnail',
    # breadcrumb
    'crumb', 'expand',
    # read-more
    'read-more', 'read-more-icon',
    # archive
    'archive-count',
    # post
    'post', 'type-page', 'sticky-title', 'edit', 'topicon', 'article-subtitle', 'article-stat',
    # sidebar widget specific
    'tabnav', 'tab-content', 'active', 'index-ul',
    'widget-comment', 'widget-comment-top', 'widget-comment-commentator', 'widget-comment-date',
    'widget-comment-content', 'searchform', 'search', 'search-input', 'search-submit',
    # others from template
    'sidebar', 'main-aside', 'main-all',
}

# Known unused CSS class patterns (from grep - no template uses these)
unused_patterns = [
    # touching comments (Waline alternative - not used)
    r'\.touching-[^{]*\{[^}]*\}',
    # shang (打赏/赞赏)
    r'\.shang[^{]*\{[^}]*\}',
    # qrcode
    r'\.qrcode[^{]*\{[^}]*\}',
    r'\.qrcode-[^{]*\{[^}]*\}',
    # emoji / smilies
    r'\.emoji[^{]*\{[^}]*\}',
    r'\.emoji-smilies[^{]*\{[^}]*\}',
    r'\.emoji-post[^{]*\{[^}]*\}',
    r'\.comment-emoji[^{]*\{[^}]*\}',
    # vipicon (VIP comments)
    r'\.vipicon[^{]*\{[^}]*\}',
    # comment-ajax-tip
    r'\.comment-ajax-tip[^{]*\{[^}]*\}',
    r'\.comment-ajax-tip-error[^{]*\{[^}]*\}',
    # comment-edit
    r'\.comment-edit[^{]*\{[^}]*\}',
    # link-blogger
    r'\.link-blogger[^{]*\{[^}]*\}',
    r'\.links-title[^{]*\{[^}]*\}',
    r'\.links-item[^{]*\{[^}]*\}',
    # archives
    r'\.archives-statistics[^{]*\{[^}]*\}',
    r'\.archives-content[^{]*\{[^}]*\}',
    r'\.archives-info[^{]*\{[^}]*\}',
    r'\.archives-title[^{]*\{[^}]*\}',
    r'\.archives-counts[^{]*\{[^}]*\}',
    # car- (calendar archive)
    r'\.car-[^{]*\{[^}]*\}',
    r'\.car-list[^{]*\{[^}]*\}',
    r'\.car-plus[^{]*\{[^}]*\}',
    r'\.car-minus[^{]*\{[^}]*\}',
    r'\.cy-yeartitle[^{]*\{[^}]*\}',
    r'\.cy-archive-count[^{]*\{[^}]*\}',
    r'\.car-days[^{]*\{[^}]*\}',
    # timeline archive
    r'\.timeline-archive[^{]*\{[^}]*\}',
    r'\.tl-archive[^{]*\{[^}]*\}',
    r'\.tl-archive-ul[^{]*\{[^}]*\}',
    r'\.tl-archive-box[^{]*\{[^}]*\}',
    r'\.tl-archive-year[^{]*\{[^}]*\}',
    r'\.tl-archive-img[^{]*\{[^}]*\}',
    r'\.tl-archive-date[^{]*\{[^}]*\}',
    r'\.tl-archive-title[^{]*\{[^}]*\}',
    r'\.tl-archive-count[^{]*\{[^}]*\}',
    r'\.tl-archive-commentcount[^{]*\{[^}]*\}',
    # article-index-widget
    r'\.article-index-widget[^{]*\{[^}]*\}',
    # article-related
    r'\.article-related[^{]*\{[^}]*\}',
    r'\.related-list[^{]*\{[^}]*\}',
    r'\.related-img[^{]*\{[^}]*\}',
    r'\.related-date[^{]*\{[^}]*\}',
    r'\.related-cc[^{]*\{[^}]*\}',
    r'\.toggle-related-btn[^{]*\{[^}]*\}',
    # fixed-index
    r'\.fixed-index[^{]*\{[^}]*\}',
    # roll-toggle / roll-top
    r'\.roll-toggle[^{]*\{[^}]*\}',
    r'\.roll-top[^{]*\{[^}]*\}',
    r'\.sunmoon[^{]*\{[^}]*\}',
    r'\.sunicon[^{]*\{[^}]*\}',
    r'\.moonicon[^{]*\{[^}]*\}',
    r'\.rollicon[^{]*\{[^}]*\}',
    # top-bar / top-page
    r'\.top-bar[^{]*\{[^}]*\}',
    r'\.top-page[^{]*\{[^}]*\}',
    r'\.top-comment[^{]*\{[^}]*\}',
    # about-author
    r'\.about-author[^{]*\{[^}]*\}',
    r'\.author-avatar[^{]*\{[^}]*\}',
    r'\.author-name[^{]*\{[^}]*\}',
    r'\.author-description[^{]*\{[^}]*\}',
    r'\.author-cover[^{]*\{[^}]*\}',
    r'\.stat-number[^{]*\{[^}]*\}',
    r'\.stat-label[^{]*\{[^}]*\}',
    r'\.article-author[^{]*\{[^}]*\}',
    # reader-wall
    r'\.reader-wall[^{]*\{[^}]*\}',
    r'\.reader-wall-list[^{]*\{[^}]*\}',
    # widget-links
    r'\.widget-links[^{]*\{[^}]*\}',
    # waving-emoji / no-posts
    r'\.no-posts[^{]*\{[^}]*\}',
    # right-side
    r'\.right-side[^{]*\{[^}]*\}',
    # sidebar-mobile
    r'\.sidebar-mobile[^{]*\{[^}]*\}',
    # headermenu
    r'\.headermenu[^{]*\{[^}]*\}',
    # mm-menu / mm-* (mobile menu - removed)
    r'\.mm-[a-z][^{]*\{[^}]*\}',
    r'\.mm-menu[^{]*\{[^}]*\}',
    # comment-touching-comments-chosen
    r'\.touching-comments[^{]*\{[^}]*\}',
    r'\.touching-comments-button[^{]*\{[^}]*\}',
    r'\.touching-comments-chosen[^{]*\{[^}]*\}',
    r'\.hearticon[^{]*\{[^}]*\}',
    # article-phone
    r'\.article-phone[^{]*\{[^}]*\}',
    # wp-admin
    r'\.mm-wp-admin[^{]*\{[^}]*\}',
    r'\.mm-listview[^{]*\{[^}]*\}',
    r'\.mm-panel[^{]*\{[^}]*\}',
    r'\.mm-panels[^{]*\{[^}]*\}',
    r'\.mm-navbar[^{]*\{[^}]*\}',
    r'\.mm-btn[^{]*\{[^}]*\}',
    r'\.mm-arrow[^{]*\{[^}]*\}',
    r'\.mm-next[^{]*\{[^}]*\}',
    r'\.mm-search[^{]*\{[^}]*\}',
    r'\.mm-selected[^{]*\{[^}]*\}',
    r'\.mm-divider[^{]*\{[^}]*\}',
    r'\.mm-title[^{]*\{[^}]*\}',
    r'\.mm-counter[^{]*\{[^}]*\}',
    # article mostactive
    r'\.article-mostactive[^{]*\{[^}]*\}',
    # pj-reply
    r'\.pj-reply[^{]*\{[^}]*\}',
    # com-level
    r'\.com-level[^{]*\{[^}]*\}',
    # wave animation
    r'@keyframes waveFlow[^{]*\{[^}]*\}',
    # wave hover
    r'\.wave:hover[^{]*\{[^}]*\}',
]

total_removed = 0
for pattern in unused_patterns:
    matches = re.findall(pattern, css, re.DOTALL)
    for m in matches:
        total_removed += len(m)

print(f"Estimated removable CSS: ~{total_removed} bytes ({total_removed/1024:.1f} KB)")

# Also count dark.css unused parts
with open(r'e:\blog\themes\weisaygrace\assets\css\dark.css', encoding='utf-8') as f:
    dark = f.read()

# Dark mode follows same patterns
unused_dark = [
    r'\.dark \.touching-[^{]*\{[^}]*\}',
    r'\.dark \.shang[^{]*\{[^}]*\}',
    r'\.dark \.qrcode[^{]*\{[^}]*\}',
    r'\.dark \.emoji[^{]*\{[^}]*\}',
    r'\.dark \.vip1[^{]*\{[^}]*\}',
    r'\.dark \.vip2[^{]*\{[^}]*\}',
    r'\.dark \.vip3[^{]*\{[^}]*\}',
    r'\.dark \.vip4[^{]*\{[^}]*\}',
    r'\.dark \.vip5[^{]*\{[^}]*\}',
    r'\.dark \.vip6[^{]*\{[^}]*\}',
    r'\.dark \.vip7[^{]*\{[^}]*\}',
    r'\.dark \.vip8[^{]*\{[^}]*\}',
    r'\.dark \.vip9[^{]*\{[^}]*\}',
    r'\.dark \.vip10[^{]*\{[^}]*\}',
    r'\.dark \.vip11[^{]*\{[^}]*\}',
    r'\.dark \.vip12[^{]*\{[^}]*\}',
    r'\.dark \.comment-ajax-tip[^{]*\{[^}]*\}',
    r'\.dark \.link-blogger[^{]*\{[^}]*\}',
    r'\.dark \.archives[^{]*\{[^}]*\}',
    r'\.dark \.car-[^{]*\{[^}]*\}',
    r'\.dark \.timeline-archive[^{]*\{[^}]*\}',
    r'\.dark \.tl-archive[^{]*\{[^}]*\}',
    r'\.dark \.article-index-widget[^{]*\{[^}]*\}',
    r'\.dark \.article-related[^{]*\{[^}]*\}',
    r'\.dark \.fixed-index[^{]*\{[^}]*\}',
    r'\.dark \.roll-toggle[^{]*\{[^}]*\}',
    r'\.dark \.top-page[^{]*\{[^}]*\}',
    r'\.dark \.top-comment[^{]*\{[^}]*\}',
    r'\.dark \.about-author[^{]*\{[^}]*\}',
    r'\.dark \.reader-wall[^{]*\{[^}]*\}',
    r'\.dark \.widget-links[^{]*\{[^}]*\}',
    r'\.dark \.touching-header[^{]*\{[^}]*\}',
    r'\.dark \.touching-waterfall[^{]*\{[^}]*\}',
    r'\.dark \.touching-list[^{]*\{[^}]*\}',
    r'\.dark \.touching-columns[^{]*\{[^}]*\}',
    r'\.dark \.comment-emoji[^{]*\{[^}]*\}',
    r'\.dark \.article-mostactive[^{]*\{[^}]*\}',
    r'\.dark \.pj-reply[^{]*\{[^}]*\}',
    # dark token styles (Prism syntax highlighting for code blocks - not used)
    r'\.dark \.token\.[a-z-]+[^{]*\{[^}]*\}',
    r'\.dark div\.code-toolbar[^{]*\{[^}]*\}',
    r'\.dark div\.code-toolbar[^{]*\{[^}]*\}',
    r'\.dark pre\[class\*="language-\"\]\.line-numbers[^{]*\{[^}]*\}',
]

dark_removed = 0
for pattern in unused_dark:
    matches = re.findall(pattern, dark, re.DOTALL)
    for m in matches:
        dark_removed += len(m)

print(f"Estimated removable dark.css: ~{dark_removed} bytes ({dark_removed/1024:.1f} KB)")
print(f"Total potential reduction: ~{total_removed + dark_removed} bytes ({(total_removed+dark_removed)/1024:.1f} KB)")
