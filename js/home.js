// Ale Floors — home page only: color sample board and project gallery lightbox.
(() => {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    // ========================================
    // COLOR SAMPLE BOARD
    // Each chip is a toggle button; the chosen one is shown large on the left.
    // ========================================
    function initSampleBoard() {
        const chips = $$('.swatch');
        const img = $('#samplePreviewImg');
        const solid = $('#samplePreviewSolid');
        const name = $('#samplePreviewName');
        const group = $('#samplePreviewGroup');
        if (!chips.length || !img) return;

        const select = (chip) => {
            chips.forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
            name.textContent = chip.dataset.name;
            group.textContent = chip.dataset.group;

            if (chip.dataset.color) {
                solid.style.setProperty('--solid', chip.dataset.color);
                solid.hidden = false;
                img.hidden = true;
                return;
            }
            solid.hidden = true;
            img.hidden = false;
            if (img.getAttribute('src') === chip.dataset.src) return;
            // fade out, swap, fade back in once the new image has loaded
            img.classList.add('is-loading');
            const next = new Image();
            next.onload = next.onerror = () => {
                img.src = chip.dataset.src;
                img.alt = chip.dataset.name + ' ' + chip.dataset.group.toLowerCase() + ' sample';
                if (next.naturalWidth) {
                    img.width = next.naturalWidth;
                    img.height = next.naturalHeight;
                }
                img.classList.remove('is-loading');
            };
            next.src = chip.dataset.src;
        };

        chips.forEach((chip) => chip.addEventListener('click', () => select(chip)));
    }

    // ========================================
    // GALLERY LIGHTBOX (<dialog>): arrows, Esc, swipe; focus returns to the photo.
    // ========================================
    function initLightbox() {
        const dialog = $('#lightbox');
        const items = $$('#gallery .g-item');
        if (!dialog || !items.length || typeof dialog.showModal !== 'function') return;

        const img = $('.lightbox-img', dialog);
        const caption = $('.lightbox-caption', dialog);
        const count = $('.lightbox-count', dialog);
        let index = 0;
        let opener = null;

        const show = (i) => {
            index = (i + items.length) % items.length;
            const source = $('img', items[index]);
            img.style.opacity = '0';
            const full = new Image();
            full.onload = full.onerror = () => {
                img.src = source.getAttribute('src');   // the full-size file, not the 600px copy
                img.alt = source.alt;
                img.classList.toggle('is-small', full.naturalWidth > 0 && full.naturalWidth < 500);
                img.style.opacity = '1';
            };
            full.src = source.getAttribute('src');
            caption.textContent = source.alt;
            count.textContent = (index + 1) + ' / ' + items.length;
        };

        items.forEach((item, i) => {
            item.setAttribute('aria-label', 'Open photo: ' + $('img', item).alt);
            item.addEventListener('click', () => {
                opener = item;
                show(i);
                dialog.showModal();
            });
        });

        $('.lightbox-close', dialog).addEventListener('click', () => dialog.close());
        $('.lightbox-prev', dialog).addEventListener('click', () => show(index - 1));
        $('.lightbox-next', dialog).addEventListener('click', () => show(index + 1));
        dialog.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') show(index - 1);
            if (event.key === 'ArrowRight') show(index + 1);
        });
        // click on the dark area (not on the photo or a button) closes
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog || event.target.classList.contains('lightbox-figure')) dialog.close();
        });
        dialog.addEventListener('close', () => {
            if (opener) opener.focus();
        });

        // swipe left/right on touch screens
        let startX = null;
        dialog.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
        dialog.addEventListener('touchend', (event) => {
            if (startX === null) return;
            const dx = event.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
            startX = null;
        });
    }

    // ========================================
    // SMOOTH SCROLL: Lenis eases the page scroll; GSAP's ticker is the one animation loop
    // (Lenis and the 3D scene in js/hero-3d.js both run on it). Off with reduced motion.
    // ========================================
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
    let lenis = null;

    function initSmoothScroll() {
        if (reduceMotion || !window.Lenis || !window.gsap || !window.ScrollTrigger) return;
        window.gsap.registerPlugin(window.ScrollTrigger);
        lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.2 });
        lenis.on('scroll', window.ScrollTrigger.update);
        window.gsap.ticker.add((time) => lenis.raf(time * 1000));
        window.gsap.ticker.lagSmoothing(0);
        window.aleLenis = lenis;
    }

    // scroll to a page position: eased with Lenis, native otherwise
    function scrollToY(top, onDone) {
        if (lenis) {
            lenis.scrollTo(top, { duration: 1.3, easing: easeOutQuint, onComplete: onDone });
            return;
        }
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
        if (onDone) window.setTimeout(onDone, reduceMotion ? 0 : 700);
    }

    // ========================================
    // SHOWROOM HERO: turns scrolling through the tall hero into progress (0..1),
    // picks the active room, swaps captions and (without 3D) the still images.
    // Room changes happen at the same points as the camera stops in js/hero-3d.js.
    // ========================================
    function initShowroom() {
        const hero = $('#showroom');
        if (!hero) return;
        const panels = $$('.room-panel', hero);
        const stills = $$('.hero-still', hero);
        const navItems = $$('.room-nav-item', hero);
        const ROOM_AT = [0, 0.24, 0.68];          // progress where each room starts
        const SCROLL_TO = [0, 0.5, 0.97];         // where the room-nav buttons take you
        // the camera holds still at 0..0.1, 0.42..0.58 and 0.9..1 (js/hero-3d.js curveAt);
        // stopping in between glides on to the next stop in the direction you were going
        const HOLDS = [[0, 0.1], [0.42, 0.58], [0.9, 1]];
        const STOPS = [0.05, 0.5, 0.96];
        let room = -1;
        let ticking = false;

        const progress = () => {
            const range = hero.offsetHeight - window.innerHeight;
            if (range <= 0) return 0;
            return Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / range));
        };

        // stills for rooms 2-3 are only downloaded when the 3D scene is not running
        const loadStill = (i) => {
            const pic = stills[i];
            if (!pic || document.documentElement.classList.contains('has-3d')) return;
            $$('[data-srcset]', pic).forEach((source) => { source.srcset = source.dataset.srcset; source.removeAttribute('data-srcset'); });
            const img = $('img[data-src]', pic);
            if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
        };

        const setRoom = (next) => {
            if (next === room) return;
            room = next;
            if (typeof closeCards === 'function') closeCards();
            panels.forEach((panel) => {
                const active = Number(panel.dataset.room) === room;
                panel.classList.toggle('is-active', active);
                panel.inert = !active;       // hidden captions can't take keyboard focus
            });
            stills.forEach((pic, i) => pic.classList.toggle('is-active', i === room));
            navItems.forEach((item, i) => {
                item.classList.toggle('is-active', i === room);
                item.classList.toggle('is-past', i < room);
                item.setAttribute('aria-current', i === room ? 'true' : 'false');
            });
        };

        // hotspot cards: one open at a time; Esc, a click elsewhere or a room change closes it
        const spots = $$('.hotspot', hero);
        const closeCards = () => spots.forEach((spot) => {
            spot.setAttribute('aria-expanded', 'false');
            $('#' + spot.getAttribute('aria-controls')).hidden = true;
        });
        spots.forEach((spot) => spot.addEventListener('click', (event) => {
            event.stopPropagation();
            const open = spot.getAttribute('aria-expanded') !== 'true';
            closeCards();
            spot.setAttribute('aria-expanded', String(open));
            $('#' + spot.getAttribute('aria-controls')).hidden = !open;
        }));
        document.addEventListener('click', (event) => { if (!event.target.closest('.spot-card')) closeCards(); });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCards(); });

        // live flake color: tells js/hero-3d.js which palette to paint on the garage floor
        const chips = $$('.flake-chip', hero);
        chips.forEach((chip) => chip.addEventListener('click', () => {
            chips.forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
            $('#flakeName').textContent = chip.dataset.flake;
            window.dispatchEvent(new CustomEvent('ale:flake', { detail: chip.dataset.flake }));
        }));

        const heroTop = () => hero.getBoundingClientRect().top + window.scrollY;
        const topFor = (p) => heroTop() + (hero.offsetHeight - window.innerHeight) * p;

        const update = () => {
            ticking = false;
            const p = progress();
            setRoom(p >= ROOM_AT[2] ? 2 : p >= ROOM_AT[1] ? 1 : 0);
            // the active room's bar fills from its start to the next room's start
            const end = room < 2 ? ROOM_AT[room + 1] : 1;
            const fill = Math.min(1, Math.max(0, (p - ROOM_AT[room]) / (end - ROOM_AT[room])));
            if (navItems[room]) navItems[room].style.setProperty('--fill', fill.toFixed(3));
            hero.classList.toggle('is-last-room', p >= 0.9);
            if (p > 0.12) loadStill(1);       // a little ahead, so the image is ready
            if (p > 0.55) loadStill(2);
        };

        // with Lenis, ScrollTrigger reports the hero's progress; without it, plain scroll events
        if (lenis) {
            window.ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: update, onRefresh: update });
        } else {
            window.addEventListener('scroll', () => {
                if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
            }, { passive: true });
        }
        window.addEventListener('resize', update);

        // soft snap: when scrolling stops between two rooms, glide to the next room in that direction.
        // Never fights the visitor: any new scroll input cancels it (Lenis), and it only acts inside the hero.
        if (lenis) {
            let lastDir = 1;
            let idle = 0;
            let snapping = false;
            lenis.on('scroll', ({ direction }) => {
                if (direction) lastDir = direction;
                window.clearTimeout(idle);
                if (snapping) return;
                idle = window.setTimeout(() => {
                    const p = progress();
                    if (p <= 0.02 || p >= 0.98) return;
                    if (HOLDS.some(([a, b]) => p >= a && p <= b)) return;
                    const next = lastDir > 0 ? STOPS.find((s) => s > p) : [...STOPS].reverse().find((s) => s < p);
                    if (next === undefined) return;
                    snapping = true;
                    scrollToY(topFor(next), () => { snapping = false; });
                }, 220);
            });
        }

        navItems.forEach((item, i) => {
            item.addEventListener('click', () => scrollToY(topFor(SCROLL_TO[i])));
        });

        // arrow: next room; after the last room it leaves the tour
        const next = $('.tour-next', hero);
        const after = $('#after-tour');
        const leaveTour = () => scrollToY(heroTop() + hero.offsetHeight, () => after && after.focus({ preventScroll: true }));
        if (next) next.addEventListener('click', () => {
            const p = progress();
            const stop = STOPS.find((s) => s > p + 0.02);
            if (stop === undefined) leaveTour();
            else scrollToY(topFor(stop));
        });
        const skip = $('.tour-skip', hero);
        if (skip) skip.addEventListener('click', (event) => {
            event.preventDefault();
            leaveTour();
        });

        update();
    }

    initSmoothScroll();
    initSampleBoard();
    initLightbox();
    initShowroom();
})();
