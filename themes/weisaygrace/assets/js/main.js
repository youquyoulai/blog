/**
 * Weisay Grace Theme - Main JavaScript
 * Native JavaScript implementation
 */

(function () {
    'use strict';

    // Mobile Menu Toggle (Hamburger Menu)
    var hamburger = document.getElementById('hamburger');
    var menu = document.getElementById('menu');
    var menuOverlay = document.getElementById('menu-overlay');
    function openMenu() {
        if (menu) menu.classList.add('open');
        if (menuOverlay) menuOverlay.classList.add('open');
        document.documentElement.classList.add('mm-left', 'mm-opened');
        document.body.style.overflow = 'hidden';
        if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
        if (menu) menu.classList.remove('open');
        if (menuOverlay) menuOverlay.classList.remove('open');
        document.documentElement.classList.remove('mm-left', 'mm-opened');
        document.body.style.overflow = '';
        if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    }
    if (hamburger && menu) {
        hamburger.addEventListener('click', function (e) {
            e.preventDefault();
            menu.classList.contains('open') ? closeMenu() : openMenu();
        });
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMenu);
    }
    // Close menu when clicking links inside
    if (menu) {
        menu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });
    }

    // Image Lightbox
    function createLightbox(imgSrc, imgAlt) {
        var overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';

        var imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'position:relative;max-width:90%;max-height:90vh;';

        var bigImg = document.createElement('img');
        bigImg.src = imgSrc;
        bigImg.alt = imgAlt || '';
        bigImg.style.cssText = 'max-width:100%;max-height:90vh;object-fit:contain;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';

        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.setAttribute('aria-label', '关闭灯箱');
        closeBtn.style.cssText = 'position:absolute;top:-10px;right:-10px;width:40px;height:40px;border-radius:50%;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#fff;border:none;';

        imgContainer.appendChild(bigImg);
        imgContainer.appendChild(closeBtn);
        overlay.appendChild(imgContainer);
        document.body.appendChild(overlay);

        var closeLightbox = function() {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            document.removeEventListener('keydown', escHandler);
        };

        var escHandler = function (e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                closeLightbox();
            }
        };
        document.addEventListener('keydown', escHandler);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                closeLightbox();
            }
        });

        closeBtn.addEventListener('click', closeLightbox);

        imgContainer.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    function initImageLightbox(container) {
        if (!container) return;
        
        container.addEventListener('click', function (e) {
            var img = e.target.closest('img');
            if (!img) return;
            
            if (img.closest('.feed-image-link')) return;
            if (img.closest('.lightbox-overlay')) return;
            
            e.preventDefault();
            createLightbox(img.src, img.alt || '');
        });
    }

    var postContent = document.querySelector('.post-content');
    if (postContent) initImageLightbox(postContent);
    var articleContent = document.querySelector('.article-content');
    if (articleContent) initImageLightbox(articleContent);

    // Smooth Scroll for Anchors
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var href = this.getAttribute('href');
            if (href === '#' || href === '') return;
            var target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Reset Menu State on Resize
    window.addEventListener('resize', function () {
        if (window.innerWidth > 991) {
            closeMenu();
            
        }
    });

    // Dark Mode Toggle
    var darkModeToggleMobile = document.getElementById('dark-mode-toggle-mobile');
    var htmlElement = document.documentElement;

    // Check saved dark mode preference
    var savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlElement.classList.add('dark');
    }

    function toggleDarkMode() {
        htmlElement.classList.toggle('dark');
        var theme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
    }

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
            if (e.matches) {
                htmlElement.classList.add('dark');
            } else {
                htmlElement.classList.remove('dark');
            }
        }
    });

    if (darkModeToggleMobile) {
        darkModeToggleMobile.addEventListener('click', function () {
             // 关闭侧边栏抽屉
            closeMenu();    // 关闭汉堡菜单
            toggleDarkMode();
        });
    }
// Image Lazy Loading
document.querySelectorAll('.article-content img:not([loading])').forEach(function(img){
    img.loading='lazy';
    img.decoding='async';
});

// Dark Mode Toggle Icon Switch
function updateDarkModeIcon() {
    var toggleBtn = document.getElementById('dark-mode-toggle-mobile');
    if (!toggleBtn) return;
    
    var isDark = document.documentElement.classList.contains('dark');
    var icon = isDark ? 
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' :
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    
    toggleBtn.innerHTML = icon;
}

// Update icon on page load
updateDarkModeIcon();

// Listen for dark mode changes
var darkModeObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class') {
            updateDarkModeIcon();
        }
    });
});

darkModeObserver.observe(document.documentElement, { attributes: true });

})();
