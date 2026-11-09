// Ale Floors — shared script, loaded on every page.
// Every feature checks that its elements exist, so a page without
// (for example) testimonials or a back-to-top button never throws.
(() => {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The inline script in <head> adds html.js; CSS hides animated elements only
    // when that class is present, so content stays visible if JavaScript fails.

    // ========================================
    // ANALYTICS (Google Analytics 4)
    // Turned on by setting GA_ID in tools/build.py, which writes
    // data-ga-id="G-XXXXXXX" on the <html> tag of every page.
    // ========================================
    function track(eventName, params = {}) {
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params);
        }
    }
    window.aleTrack = track;

    function initAnalytics() {
        const id = document.documentElement.dataset.gaId;
        if (id) {
            const tag = document.createElement('script');
            tag.async = true;
            tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
            document.head.appendChild(tag);
            window.dataLayer = window.dataLayer || [];
            window.gtag = function gtag() { window.dataLayer.push(arguments); };
            window.gtag('js', new Date());
            window.gtag('config', id);
        }

        // Count clicks on the main contact channels
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href');
            if (href.startsWith('tel:')) track('click_call');
            else if (href.includes('wa.me/')) track('click_whatsapp');
            else if (href.startsWith('mailto:')) track('click_email');
        });
    }

    // ========================================
    // MOBILE MENU
    // While open, the rest of the page is inert so keyboard focus stays in the menu.
    // ========================================
    function initNav() {
        const hamburger = $('#hamburger');
        const menu = $('#navMenu');
        const header = $('#navbar');
        if (!hamburger || !menu) return;
        const isNew = header && header.classList.contains('site-header');
        const outside = ['main', 'footer', '.mobile-actions', '.whatsapp-float', '.back-to-top', '.nav-cta']
            .map((selector) => $(selector)).filter(Boolean);

        const setOpen = (open) => {
            hamburger.classList.toggle('active', open);
            menu.classList.toggle('active', open);
            hamburger.setAttribute('aria-expanded', String(open));
            hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            document.body.style.overflow = open ? 'hidden' : '';
            if (header) header.classList.toggle('menu-open', open);
            outside.forEach((el) => { el.inert = open; });
            if (open) {
                // wait a frame so the menu is visible before moving focus into it
                window.requestAnimationFrame(() => {
                    const first = menu.querySelector('a');
                    if (first) first.focus();
                });
            }
        };

        hamburger.addEventListener('click', () => setOpen(!menu.classList.contains('active')));
        menu.addEventListener('click', (event) => {
            if (event.target.closest('a')) setOpen(false);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && menu.classList.contains('active')) {
                setOpen(false);
                hamburger.focus();
            }
        });
        // Close the menu if the screen grows to desktop size while it is open
        window.matchMedia(isNew ? '(min-width: 1024px)' : '(min-width: 769px)').addEventListener('change', (event) => {
            if (event.matches) setOpen(false);
        });
    }

    // ========================================
    // NAVBAR SHADOW + BACK TO TOP (one scroll listener)
    // ========================================
    function initScrollState() {
        const navbar = $('#navbar');
        const backToTop = $('#backToTop');
        // new design: while the header sits over a dark band ([data-header-dark] or the
        // footer) it uses dark glass instead of light glass
        const isNew = navbar && navbar.classList.contains('site-header');
        const darkBands = isNew ? $$('[data-header-dark], .site-footer') : [];
        let ticking = false;

        const update = () => {
            const y = window.scrollY;
            if (darkBands.length) {
                const middle = navbar.offsetHeight / 2;
                navbar.classList.toggle('over-dark', darkBands.some((band) => {
                    const rect = band.getBoundingClientRect();
                    return rect.top <= middle && rect.bottom >= middle;
                }));
            }
            if (navbar) navbar.classList.toggle('scrolled', y > (navbar.classList.contains('site-header') ? 24 : 100));
            if (backToTop) backToTop.classList.toggle('visible', y > 600);
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(update);
            }
        }, { passive: true });
        update();

        if (backToTop) {
            backToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            });
        }
    }

    // ========================================
    // SCROLL ANIMATIONS ([data-aos], optional data-aos-delay in ms)
    // ========================================
    function initScrollAnimations() {
        const elements = $$('[data-aos]');
        if (!elements.length) return;

        if (reduceMotion || !('IntersectionObserver' in window)) {
            elements.forEach((el) => el.classList.add('aos-animate'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const delay = parseInt(entry.target.dataset.aosDelay, 10);
                if (delay) entry.target.style.transitionDelay = delay + 'ms';
                entry.target.classList.add('aos-animate');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        elements.forEach((el) => observer.observe(el));
    }

    // ========================================
    // REVEAL ON SCROLL (new design): [data-reveal] fades in with a light blur.
    // Optional data-reveal-delay (ms). Children of [data-reveal-group] stagger.
    // ========================================
    function initReveal() {
        const elements = $$('[data-reveal]');
        if (!elements.length) return;
        $$('[data-reveal-group]').forEach((group) => {
            $$('[data-reveal]', group).forEach((el, i) => {
                if (!el.dataset.revealDelay) el.dataset.revealDelay = String(Math.min(i, 6) * 60);
            });
        });
        if (reduceMotion || !('IntersectionObserver' in window)) {
            elements.forEach((el) => el.classList.add('is-visible'));
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const delay = parseInt(entry.target.dataset.revealDelay, 10);
                if (delay) entry.target.style.transitionDelay = delay + 'ms';
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        elements.forEach((el) => observer.observe(el));
    }

    // ========================================
    // WORD-BY-WORD TITLE (new design): the text of [data-split] is split into
    // words that fade up one after another. Screen readers get the full text
    // from a visually hidden copy, so nothing is read word by word.
    // ========================================
    function initSplitWords() {
        if (reduceMotion) return;
        $$('[data-split]').forEach((title) => {
            const base = parseInt(title.dataset.splitDelay, 10) || 0;
            const readable = document.createElement('span');
            readable.className = 'sr-only';
            readable.textContent = title.textContent.replace(/\s+/g, ' ').trim();
            let index = 0;
            const walk = (node) => {
                Array.from(node.childNodes).forEach((child) => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        const frag = document.createDocumentFragment();
                        child.textContent.split(/(\s+)/).forEach((part) => {
                            if (!part) return;
                            if (/^\s+$/.test(part)) {
                                frag.appendChild(document.createTextNode(' '));
                                return;
                            }
                            const word = document.createElement('span');
                            word.className = 'word';
                            word.setAttribute('aria-hidden', 'true');
                            word.style.transitionDelay = (base + index * 70) + 'ms';
                            word.textContent = part;
                            index += 1;
                            frag.appendChild(word);
                        });
                        child.replaceWith(frag);
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        child.setAttribute('aria-hidden', 'true');
                        walk(child);
                    }
                });
            };
            walk(title);
            title.prepend(readable);
            title.classList.add('is-split');
            // two frames: let the browser paint the hidden words before revealing them
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => title.classList.add('is-visible')));
        });
    }

    // ========================================
    // COUNTERS (new design): [data-count="1533"] counts up once when visible.
    // The final text is already in the HTML, so it is correct without JS.
    // ========================================
    function initCounters() {
        const numbers = $$('[data-count]');
        if (!numbers.length || reduceMotion || !('IntersectionObserver' in window)) return;
        const run = (el) => {
            const target = parseInt(el.dataset.count, 10);
            const finalText = el.textContent;
            if (!target) return;
            const start = performance.now();
            const duration = 1400;
            const step = (now) => {
                const t = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                el.textContent = Math.round(target * eased).toLocaleString('en-US');
                if (t < 1) window.requestAnimationFrame(step);
                else el.textContent = finalText;
            };
            window.requestAnimationFrame(step);
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                run(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.6 });
        numbers.forEach((el) => observer.observe(el));
    }

    // ========================================
    // TESTIMONIALS
    // ========================================
    function initTestimonials() {
        const items = $$('.testimonial-item');
        if (items.length < 2) return;

        const slider = $('.testimonials-slider');
        let index = Math.max(0, items.findIndex((item) => item.classList.contains('active')));
        let timer = null;

        const show = (next) => {
            index = (next + items.length) % items.length;
            items.forEach((item, i) => {
                item.classList.toggle('active', i === index);
                item.setAttribute('aria-hidden', String(i !== index));
            });
        };
        const stop = () => {
            window.clearInterval(timer);
            timer = null;
        };
        const start = () => {
            if (!reduceMotion && !timer) timer = window.setInterval(() => show(index + 1), 7000);
        };

        const prev = $('.testimonial-prev');
        const next = $('.testimonial-next');
        if (prev) prev.addEventListener('click', () => { stop(); show(index - 1); });
        if (next) next.addEventListener('click', () => { stop(); show(index + 1); });

        // Pause while the visitor is reading or using the controls
        if (slider) {
            slider.addEventListener('mouseenter', stop);
            slider.addEventListener('mouseleave', start);
            slider.addEventListener('focusin', stop);
        }
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

        show(index);
        start();
    }

    // ========================================
    // BEFORE / AFTER SLIDER
    // Uses a transparent range input, so mouse, touch and keyboard all work.
    // ========================================
    function initBeforeAfter() {
        $$('.ba-slider').forEach((slider) => {
            const range = $('.ba-range', slider);
            if (!range) return;
            const update = () => slider.style.setProperty('--pos', range.value + '%');
            range.addEventListener('input', update);
            update();
        });
    }

    // ========================================
    // STATS COUNTER (home page)
    // ========================================
    function initStatsCounter() {
        const section = $('.stats');
        const numbers = $$('.stats .stat-number');
        if (!section || !numbers.length || reduceMotion || !('IntersectionObserver' in window)) return;

        const animate = (el) => {
            const finalText = el.textContent.trim();
            const target = parseInt(finalText, 10);
            if (!target) return;
            const suffix = finalText.replace(/^[\d,]+/, '');
            const duration = 1800;
            const startTime = performance.now();
            const step = (now) => {
                const progress = Math.min((now - startTime) / duration, 1);
                el.textContent = Math.floor(target * progress) + suffix;
                if (progress < 1) window.requestAnimationFrame(step);
                else el.textContent = finalText;
            };
            window.requestAnimationFrame(step);
        };

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                numbers.forEach(animate);
                observer.disconnect();
            }
        }, { threshold: 0.5 });
        observer.observe(section);
    }

    // ========================================
    // FINISHED SERVICES CAROUSEL (services page)
    // ========================================
    function initFinishedServicesCarousel() {
        const track = $('#fsTrack');
        if (!track) return;

        const items = $$('.fs-item', track);
        const prevBtn = $('.fs-arrow-prev');
        const nextBtn = $('.fs-arrow-next');
        const dotsContainer = $('#fsDots');
        const gap = 20;
        let currentIndex = 0;

        const visibleCount = () => {
            if (window.innerWidth <= 480) return 1;
            if (window.innerWidth <= 900) return 2;
            return 3;
        };
        const maxIndex = () => Math.max(0, items.length - visibleCount());

        function render(animate) {
            const vis = visibleCount();
            const itemWidth = (track.parentElement.offsetWidth - gap * (vis - 1)) / vis;

            track.style.transition = animate && !reduceMotion ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
            items.forEach((item) => { item.style.width = itemWidth + 'px'; });
            track.style.transform = 'translateX(-' + currentIndex * (itemWidth + gap) + 'px)';

            if (dotsContainer) {
                const dots = $$('.fs-dot', dotsContainer);
                if (dots.length !== maxIndex() + 1) {
                    dotsContainer.innerHTML = '';
                    for (let i = 0; i <= maxIndex(); i++) {
                        const dot = document.createElement('button');
                        dot.type = 'button';
                        dot.className = 'fs-dot';
                        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                        dot.addEventListener('click', () => { currentIndex = i; render(true); });
                        dotsContainer.appendChild(dot);
                    }
                }
                $$('.fs-dot', dotsContainer).forEach((dot, i) => {
                    dot.classList.toggle('active', i === currentIndex);
                    dot.setAttribute('aria-current', i === currentIndex ? 'true' : 'false');
                });
            }

            if (prevBtn) prevBtn.disabled = currentIndex === 0;
            if (nextBtn) nextBtn.disabled = currentIndex >= maxIndex();
        }

        const go = (delta) => {
            currentIndex = Math.min(Math.max(currentIndex + delta, 0), maxIndex());
            render(true);
        };
        if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => go(1));

        // Swipe on touch screens
        let touchStartX = null;
        track.addEventListener('touchstart', (event) => { touchStartX = event.touches[0].clientX; }, { passive: true });
        track.addEventListener('touchend', (event) => {
            if (touchStartX === null) return;
            const dx = event.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            touchStartX = null;
        });

        let resizeTimer;
        window.addEventListener('resize', () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                currentIndex = Math.min(currentIndex, maxIndex());
                render(false);
            }, 100);
        });

        render(false);
    }

    initAnalytics();
    initNav();
    initScrollState();
    initScrollAnimations();
    initReveal();
    initSplitWords();
    initCounters();
    initTestimonials();
    initBeforeAfter();
    initStatsCounter();
    initFinishedServicesCarousel();
})();
