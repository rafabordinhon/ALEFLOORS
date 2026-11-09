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

    initSampleBoard();
    initLightbox();
})();
