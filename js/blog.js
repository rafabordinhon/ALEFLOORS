// Blog listing: category filter + pagination working together.
// Each post card has data-category; each filter button has data-filter.
(() => {
    'use strict';

    const posts = Array.from(document.querySelectorAll('.blog-post'));
    const pager = document.querySelector('.pagination');
    const filters = Array.from(document.querySelectorAll('[data-filter]'));
    const list = document.querySelector('.blog-posts');
    if (!posts.length || !pager || !list) return;

    const PER_PAGE = 6;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let filter = 'all';
    let page = 1;

    function makeButton(label, targetPage, options = {}) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'page-btn' + (options.current ? ' active' : '');
        button.textContent = label;
        if (options.ariaLabel) button.setAttribute('aria-label', options.ariaLabel);
        if (options.current) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', () => {
            page = targetPage;
            render(true);
        });
        return button;
    }

    function render(scroll) {
        const matching = posts.filter((post) => filter === 'all' || post.dataset.category === filter);
        const totalPages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
        page = Math.min(Math.max(page, 1), totalPages);

        const start = (page - 1) * PER_PAGE;
        const visible = new Set(matching.slice(start, start + PER_PAGE));
        posts.forEach((post) => { post.hidden = !visible.has(post); });

        pager.innerHTML = '';
        if (totalPages > 1) {
            if (page > 1) pager.appendChild(makeButton('← Previous', page - 1));
            for (let i = 1; i <= totalPages; i++) {
                pager.appendChild(makeButton(String(i), i, { current: i === page, ariaLabel: 'Page ' + i }));
            }
            if (page < totalPages) pager.appendChild(makeButton('Next →', page + 1));
        }

        filters.forEach((button) => {
            const active = button.dataset.filter === filter;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });

        if (scroll) list.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    filters.forEach((button) => {
        button.addEventListener('click', () => {
            filter = button.dataset.filter;
            page = 1;
            render(true);
        });
    });

    render(false);
})();
