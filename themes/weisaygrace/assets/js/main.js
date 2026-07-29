/**
 * Weisay Grace Theme - Main JavaScript
 */
(function () {
    'use strict';

    var hamburger = document.getElementById('hamburger');
    var menu = document.getElementById('menu');
    var menuOverlay = document.getElementById('menu-overlay');
    var backToTopBtn = document.getElementById('back-to-top');
    var reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    function prefersReducedMotion() {
        return reduceMotionQuery && reduceMotionQuery.matches;
    }

    function getFocusableItems() {
        if (!menu) return [];
        return Array.prototype.slice.call(menu.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter(function (item) {
                return !item.disabled && item.getClientRects().length > 0;
            });
    }

    function openMenu() {
        if (menu) menu.classList.add('open');
        if (menuOverlay) menuOverlay.classList.add('open');
        if (menu) menu.setAttribute('aria-hidden', 'false');
        if (menuOverlay) menuOverlay.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('mm-left', 'mm-opened');
        document.body.style.overflow = 'hidden';
        if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
        var focusableItems = getFocusableItems();
        if (focusableItems.length) focusableItems[0].focus();
    }

    function closeMenu(restoreFocus) {
        var wasOpen = menu && menu.classList.contains('open');
        if (menu) menu.classList.remove('open');
        if (menuOverlay) menuOverlay.classList.remove('open');
        if (menu) menu.setAttribute('aria-hidden', 'true');
        if (menuOverlay) menuOverlay.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('mm-left', 'mm-opened');
        document.body.style.overflow = '';
        if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
        if (restoreFocus && wasOpen && hamburger) hamburger.focus();
    }

    function trapMenuFocus(e) {
        if (!menu || !menu.classList.contains('open')) return;
        if (e.key === 'Escape') {
            closeMenu(true);
            return;
        }
        if (e.key !== 'Tab') return;

        var focusableItems = getFocusableItems();
        if (!focusableItems.length) return;

        var firstItem = focusableItems[0];
        var lastItem = focusableItems[focusableItems.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) {
            e.preventDefault();
            lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
            e.preventDefault();
            firstItem.focus();
        }
    }

    function initMobileMenu() {
        if (hamburger && menu) {
            hamburger.addEventListener('click', function (e) {
                e.preventDefault();
                menu.classList.contains('open') ? closeMenu() : openMenu();
            });
        }
        if (menuOverlay) menuOverlay.addEventListener('click', function () {
            closeMenu(true);
        });
        if (menu) {
            menu.querySelectorAll('a').forEach(function (link) {
                link.addEventListener('click', function () {
                    closeMenu(false);
                });
            });
        }
        document.addEventListener('keydown', trapMenuFocus);
        window.addEventListener('resize', function () {
            if (window.innerWidth > 991) closeMenu();
        });
    }

    function initSmoothAnchors() {
        document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                var href = this.getAttribute('href');
                if (!href || href === '#') return;
                var target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
                }
            });
        });
    }

    function initLazyImages() {
        document.querySelectorAll('.article-content img:not([loading])').forEach(function (img) {
            img.loading = 'lazy';
            img.decoding = 'async';
        });
    }

    function initBackToTop() {
        if (!backToTopBtn) return;
        window.addEventListener('scroll', function () {
            backToTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
        });
        backToTopBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        });
    }

    initMobileMenu();
    initSmoothAnchors();
    initLazyImages();
    initBackToTop();
})();
