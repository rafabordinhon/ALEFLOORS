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
        const SCROLL_TO = [0, 0.52, 0.97];        // where the room-nav buttons take you
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

        const update = () => {
            ticking = false;
            const p = progress();
            setRoom(p >= ROOM_AT[2] ? 2 : p >= ROOM_AT[1] ? 1 : 0);
            if (p > 0.12) loadStill(1);       // a little ahead, so the image is ready
            if (p > 0.55) loadStill(2);
        };

        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
        }, { passive: true });
        window.addEventListener('resize', update);

        navItems.forEach((item, i) => {
            item.addEventListener('click', () => {
                const range = hero.offsetHeight - window.innerHeight;
                const top = hero.getBoundingClientRect().top + window.scrollY + range * SCROLL_TO[i];
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
            });
        });

        update();
    }

    initSampleBoard();
    initLightbox();
    initShowroom();
})();
