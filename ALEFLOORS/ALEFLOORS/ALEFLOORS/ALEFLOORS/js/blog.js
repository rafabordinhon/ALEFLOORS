// ========================================
// BLOG FUNCTIONALITY
// ========================================

// Pagination functionality
const paginationButtons = document.querySelectorAll('.page-btn');
const blogPosts = document.querySelectorAll('.blog-post');
const postsPerPage = 6;
let currentPage = 1;

function showPage(page, shouldScroll = true) {
    const start = (page - 1) * postsPerPage;
    const end = start + postsPerPage;
    
    blogPosts.forEach((post, index) => {
        if (index >= start && index < end) {
            post.style.display = 'block';
            post.style.animation = 'fadeIn 0.5s ease';
        } else {
            post.style.display = 'none';
        }
    });
    
    // Update active button
    paginationButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === String(page)) {
            btn.classList.add('active');
        }
    });
    
    // Scroll to top of blog section only when explicitly requested
    if (shouldScroll) {
        document.querySelector('.blog-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Add click events to pagination buttons
paginationButtons.forEach(button => {
    button.addEventListener('click', () => {
        const buttonText = button.textContent.trim();
        
        if (buttonText === 'Next →') {
            const totalPages = Math.ceil(blogPosts.length / postsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                showPage(currentPage);
            }
        } else if (buttonText === '← Previous') {
            if (currentPage > 1) {
                currentPage--;
                showPage(currentPage);
            }
        } else {
            currentPage = parseInt(buttonText);
            showPage(currentPage);
        }
    });
});

// Initialize first page without scrolling
if (blogPosts.length > 0) {
    showPage(1, false);
}

// Header feature items filter functionality
const headerFeatureItems = document.querySelectorAll('.header-feature-item[data-filter]');

headerFeatureItems.forEach(item => {
    item.addEventListener('click', () => {
        const filter = item.getAttribute('data-filter');
        
        // Remove active class from all items
        headerFeatureItems.forEach(i => i.classList.remove('active'));
        
        // Add active class to clicked item
        item.classList.add('active');
        
        // Filter posts
        blogPosts.forEach(post => {
            const postCategory = post.querySelector('.post-category').textContent.trim();
            
            if (filter === 'all') {
                post.style.display = 'block';
                post.style.animation = 'fadeIn 0.5s ease';
            } else if (postCategory === filter) {
                post.style.display = 'block';
                post.style.animation = 'fadeIn 0.5s ease';
            } else {
                post.style.display = 'none';
            }
        });
        
        // Reset to page 1 after filtering
        currentPage = 1;
        
        // Scroll to blog posts section
        document.querySelector('.blog-posts').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
        });
    });
});

// Add fade-in animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);
