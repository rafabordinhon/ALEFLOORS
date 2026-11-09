// Blog listing: category filter + pagination working together.
// Each post card has data-category; each filter button has data-filter.
// The current filter and page are kept in the URL (#maintenance/2), so the
// back button returns to the same place.
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

        const hash = (filter === 'all' ? '' : slug(filter)) + (page > 1 ? '/' + page : '');
        if (hash || window.location.hash) history.replaceState(null, '', hash ? '#' + hash : window.location.pathname);

        if (scroll) list.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    function slug(text) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    function readHash() {
        const [cat, num] = window.location.hash.slice(1).split('/');
        const match = filters.find((button) => button.dataset.filter !== 'all' && slug(button.dataset.filter) === cat);
        filter = match ? match.dataset.filter : 'all';
        page = parseInt(num, 10) || parseInt(cat, 10) || 1;
    }

    filters.forEach((button) => {
        button.addEventListener('click', () => {
            filter = button.dataset.filter;
            page = 1;
            render(true);
        });
    });

    // Links like blog.html#maintenance (and the back button) update the list
    window.addEventListener('hashchange', () => {
        readHash();
        render(false);
    });

    readHash();
    render(false);
})();
