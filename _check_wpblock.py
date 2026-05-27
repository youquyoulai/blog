import re, os

c = open(r'e:\blog\themes\weisaygrace\assets\css\style.css', encoding='utf-8').read()

# Extract all wp-block class names used in CSS
wp_block_classes = set(re.findall(r'\.wp-block-([a-z0-9-]+)', c))
print(f'CSS .wp-block-* classes ({len(wp_block_classes)}):')
for cls in sorted(wp_block_classes):
    print(f'  .wp-block-{cls}')

# Search all content files
content_dir = r'e:\blog\content\posts'
used = set()
for fname in os.listdir(content_dir):
    if fname.endswith('.md'):
        try:
            text = open(os.path.join(content_dir, fname), encoding='utf-8', errors='ignore').read()
            for cls in wp_block_classes:
                if f'wp-block-{cls}' in text or f'<!-- wp:{cls}' in text or f'class="wp-block-{cls}' in text:
                    used.add(cls)
        except:
            pass

print(f'\nActually used in content ({len(used)}):')
for cls in sorted(used):
    print(f'  .wp-block-{cls}')
print(f'\nPotentially unused ({len(wp_block_classes - used)}):')
for cls in sorted(wp_block_classes - used):
    print(f'  .wp-block-{cls}')
