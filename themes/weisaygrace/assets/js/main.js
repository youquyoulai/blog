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
    var darkModeToggle = document.getElementById('dark-mode-toggle');
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

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function () {
             // 关闭侧边栏抽屉
            closeMenu();    // 关闭汉堡菜单
            toggleDarkMode();
        });
    }
    if (darkModeToggleMobile) {
        darkModeToggleMobile.addEventListener('click', function () {
             // 关闭侧边栏抽屉
            closeMenu();    // 关闭汉堡菜单
            toggleDarkMode();
        });
    }
})();
