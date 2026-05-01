/**
 * Typecho-Five-Theme - Main JavaScript
 * Version: 1.6.2 (Lightbox optimized)
 */

(function () {
    'use strict';

    // 返回顶部（节流）
    var backToTop = document.getElementById('backToTop');
    if (backToTop) {
        var scrollTicking = false;
        window.addEventListener('scroll', function () {
            if (!scrollTicking) {
                scrollTicking = true;
                requestAnimationFrame(function () {
                    backToTop.classList.toggle('show', window.scrollY > 300);
                    scrollTicking = false;
                });
            }
        });
        backToTop.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 移动端菜单
    var toggleBtn = document.getElementById('mobileMenuToggle');
    var navMenu = document.getElementById('headerNav');
    if (toggleBtn && navMenu) {
        toggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var isOpen = navMenu.classList.toggle('open');
            toggleBtn.setAttribute('aria-expanded', isOpen);
        });
    }

    // 移动端下拉菜单
    var dropdownItems = document.querySelectorAll('.header-nav .has-dropdown > a');
    dropdownItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                this.parentNode.classList.toggle('open');
            }
        });
    });

    // 侧边栏滑出
    var sidebarToggle = document.getElementById('sidebarToggle');
    var sidebarPanel = document.getElementById('sidebarPanel');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var sidebarClose = document.getElementById('sidebarPanelClose');

    function openSidebar() {
        if (sidebarPanel) sidebarPanel.classList.add('open');
        if (sidebarOverlay) sidebarPanel.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
        // 侧边栏打开后加载微语
        loadMemos();
    }
    function closeSidebar() {
        if (sidebarPanel) sidebarPanel.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
        document.body.style.overflow = '';
        if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function () {
            sidebarPanel.classList.contains('open') ? closeSidebar() : openSidebar();
        });
    }
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);

    if (sidebarPanel) {
        sidebarPanel.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeSidebar);
        });
    }

    // ---------- 图片灯箱（增强版，带关闭按钮）----------
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
        closeBtn.style.cssText = 'position:absolute;top:-10px;right:-10px;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.7);color:#fff;font-size:24px;border:2px solid rgba(255,255,255,0.5);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.2s, border-color 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        closeBtn.addEventListener('mouseenter', function() {
            this.style.background = '#2c5faa';
            this.style.borderColor = '#fff';
        });
        closeBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(0,0,0,0.7)';
            this.style.borderColor = 'rgba(255,255,255,0.5)';
        });

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
    var pageContent = document.querySelector('.page-content');
    if (pageContent) initImageLightbox(pageContent);

    // ---------- 暗色模式切换 ----------
    var themeToggle = document.getElementById('themeToggle');
    var iconSun = document.querySelector('.icon-sun');
    var iconMoon = document.querySelector('.icon-moon');

    function getTheme() {
        var stored = localStorage.getItem('theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (iconSun) iconSun.style.display = theme === 'dark' ? 'none' : '';
        if (iconMoon) iconMoon.style.display = theme === 'dark' ? '' : 'none';
        localStorage.setItem('theme', theme);
    }

    applyTheme(getTheme());

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme');
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    // 平滑滚动锚点
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

    // ---------- 微语模块 ----------
    var _memosLoaded = false;
    var MEMOS_LIMIT = 1;

    function formatMemoTime(timeStr) {
        var ts = Number(timeStr);
        if (ts > 0 && ts < 10000000000) { ts = ts * 1000; }
        var date = new Date(ts || timeStr);
        var now = new Date();
        var diff = now - date;
        var minutes = Math.floor(diff / 60000);
        var hours = Math.floor(diff / 3600000);
        var days = Math.floor(diff / 86400000);
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return minutes + ' 分钟前';
        if (hours < 24) return hours + ' 小时前';
        if (days < 30) return days + ' 天前';
        return date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    }

    function renderMemos(container, memos) {
        if (!memos || memos.length === 0) {
            container.innerHTML = '<div class="memos-empty">暂无微语</div>';
            return;
        }
        var html = '<div class="memos-list">';
        memos.slice(0, MEMOS_LIMIT).forEach(function (memo) {
            var content = memo.content || '';
            content = content.replace(/!\[.*?\]\(.*?\)/g, '');
            content = content.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/`(.*?)`/g, '<code>$1</code>');
            content = content.replace(/\n/g, '<br>');

            var timeDisplay = formatMemoTime(memo.createdTs);
            html += '<div class="memo-item">';
            html += '<div class="memo-content">' + content + '</div>';
            if (timeDisplay) { html += '<div class="memo-time">' + timeDisplay + '</div>'; }
            html += '</div>';
        });
        html += '</div>';
        html += '<a href="https://memos.pgoj.top" class="memos-more" target="_blank" rel="noopener">查看更多 →</a>';
        container.innerHTML = html;
    }

    function loadMemos() {
        var container = document.getElementById('memos-container');
        if (!container || _memosLoaded) return;
        _memosLoaded = true;

        container.innerHTML = '<div class="memos-loading">加载中...</div>';
        var MEMOS_API = 'https://memos.pgoj.top/api/v1/memo';

        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); }, 8000);

        fetch(MEMOS_API + '?limit=' + MEMOS_LIMIT + '&creatorUsername=%E5%B9%B3%E5%93%A5', { signal: controller.signal })
            .then(function (res) {
                clearTimeout(timeout);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (json) {
                var data = json.data || json;
                renderMemos(container, data);
            })
            .catch(function (e) {
                clearTimeout(timeout);
                container.innerHTML = '<div class="memos-empty">加载失败</div>';
            });
    }

    // 桌面端侧边栏可见，直接加载；移动端等打开时加载
    var memosContainer = document.getElementById('memos-container');
    if (memosContainer && window.innerWidth > 768) {
        loadMemos();
    }
    // 移动端在 openSidebar() 中调用 loadMemos()

    // 窗口大小变化时重置菜单状态
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) {
            if (navMenu) navMenu.classList.remove('open');
            closeSidebar();
            document.querySelectorAll('.header-nav .has-dropdown.open').forEach(function (el) {
                el.classList.remove('open');
            });
        }
    });
})();