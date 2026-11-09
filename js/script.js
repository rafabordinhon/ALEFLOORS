// ========================================
// NAVIGATION
// ========================================
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

// Mobile Menu Toggle
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
});

// Close menu when clicking on a link
navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
        // Only close menu, don't prevent navigation
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
        // Let the link work normally
    });
});

// Navbar Scroll Effect
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// ========================================
// BACK TO TOP BUTTON
// ========================================
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ========================================
// TESTIMONIALS SLIDER
// ========================================
const testimonials = document.querySelectorAll('.testimonial-item');
const prevBtn = document.querySelector('.testimonial-prev');
const nextBtn = document.querySelector('.testimonial-next');
let currentTestimonial = 0;

function showTestimonial(index) {
    testimonials.forEach((testimonial, i) => {
        testimonial.classList.remove('active');
        if (i === index) {
            testimonial.classList.add('active');
        }
    });
}

function nextTestimonial() {
    currentTestimonial = (currentTestimonial + 1) % testimonials.length;
    showTestimonial(currentTestimonial);
}

function prevTestimonial() {
    currentTestimonial = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
    showTestimonial(currentTestimonial);
}

if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', prevTestimonial);
    nextBtn.addEventListener('click', nextTestimonial);
    
    // Auto-rotate testimonials every 5 seconds
    setInterval(nextTestimonial, 5000);
}

// ========================================
// SCROLL ANIMATIONS
// ========================================
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
            }
        });
    }, observerOptions);

    // Observe all elements with data-aos attribute
    document.querySelectorAll('[data-aos]').forEach(el => {
        observer.observe(el);
    });
}

// ========================================
// BEFORE/AFTER SLIDER
// ========================================
function initBeforeAfterSlider() {
    const baItems = document.querySelectorAll('.ba-item');
    
    baItems.forEach(item => {
        const slider = item.querySelector('.ba-slider');
        const before = item.querySelector('.ba-before');
        
        if (slider && before) {
            slider.addEventListener('mousemove', (e) => {
                const rect = slider.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = (x / rect.width) * 100;
                
                before.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
            });
            
            slider.addEventListener('mouseleave', () => {
                before.style.clipPath = 'inset(0 50% 0 0)';
            });
        }
    });
}

// ========================================
// STATS COUNTER ANIMATION
// ========================================
function animateCounter(element, target) {
    const duration = 2000; // 2 seconds
    const start = 0;
    const increment = target / (duration / 16); // 60fps
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target + '+';
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current) + '+';
        }
    }, 16);
}

function initStatsCounter() {
    const stats = document.querySelectorAll('.stat-number');
    const statsSection = document.querySelector('.stats');
    
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    stats.forEach(stat => {
                        const target = parseInt(stat.textContent);
                        animateCounter(stat, target);
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(statsSection);
    }
}

// ========================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href !== '') {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// ========================================
// ACTIVE NAV LINK ON SCROLL
// ========================================
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', updateActiveNavLink);

// ========================================
// LAZY LOADING IMAGES
// ========================================
function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// ========================================
// FORM VALIDATION (for contact page)
// ========================================
function initFormValidation() {
    const form = document.querySelector('.contact-form');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = form.querySelector('[name="name"]');
            const email = form.querySelector('[name="email"]');
            const phone = form.querySelector('[name="phone"]');
            const message = form.querySelector('[name="message"]');
            
            let isValid = true;
            
            // Clear previous errors
            form.querySelectorAll('.error').forEach(error => error.remove());
            
            // Validate name
            if (!name.value.trim()) {
                showError(name, 'Name is required');
                isValid = false;
            }
            
            // Validate email
            if (!email.value.trim()) {
                showError(email, 'Email is required');
                isValid = false;
            } else if (!isValidEmail(email.value)) {
                showError(email, 'Please enter a valid email');
                isValid = false;
            }
            
            // Validate phone
            if (!phone.value.trim()) {
                showError(phone, 'Phone is required');
                isValid = false;
            }
            
            // Validate message
            if (!message.value.trim()) {
                showError(message, 'Message is required');
                isValid = false;
            }
            
            if (isValid) {
                // Submit form or send data
                showSuccessMessage();
                form.reset();
            }
        });
    }
}

function showError(input, message) {
    const error = document.createElement('div');
    error.className = 'error';
    error.style.color = '#e94560';
    error.style.fontSize = '14px';
    error.style.marginTop = '5px';
    error.textContent = message;
    input.parentElement.appendChild(error);
    input.style.borderColor = '#e94560';
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showSuccessMessage() {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.5s ease;
    `;
    successDiv.textContent = 'Thank you! Your message has been sent successfully.';
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.5s ease';
        setTimeout(() => successDiv.remove(), 500);
    }, 3000);
}

// ========================================
// PAGE LOAD ANIMATIONS
// ========================================
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// ========================================
// INITIALIZE ALL FUNCTIONS
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    initBeforeAfterSlider();
    initStatsCounter();
    initLazyLoading();
    initFormValidation();
    initFinishedServicesCarousel();
    
    // Add loading animation
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

// ========================================
// PERFORMANCE OPTIMIZATION
// ========================================
// Debounce function for scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to scroll-heavy functions
window.addEventListener('scroll', debounce(() => {
    updateActiveNavLink();
}, 100));

// ========================================
// FINISHED SERVICES CAROUSEL
// ========================================
function initFinishedServicesCarousel() {
    const track = document.getElementById('fsTrack');
    if (!track) return;

    const items = track.querySelectorAll('.fs-item');
    const totalItems = items.length;
    const gap = 20;
    let currentIndex = 0;

    function getVisibleCount() {
        if (window.innerWidth <= 480) return 1;
        if (window.innerWidth <= 900) return 2;
        return 3;
    }

    function getItemWidth() {
        const containerWidth = track.parentElement.offsetWidth;
        const vis = getVisibleCount();
        return (containerWidth - gap * (vis - 1)) / vis;
    }

    function updateCarousel(animate) {
        const vis = getVisibleCount();
        const itemW = getItemWidth();
        const step = itemW + gap;

        if (animate === false) {
            track.style.transition = 'none';
        } else {
            track.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        }

        items.forEach(item => {
            item.style.width = itemW + 'px';
        });

        track.style.transform = 'translateX(-' + (currentIndex * step) + 'px)';

        if (animate === false) {
            // Force reflow then restore transition
            track.offsetHeight;
            track.style.transition = '';
        }

        // Rebuild dots
        const dotsContainer = document.getElementById('fsDots');
        if (dotsContainer) {
            const maxIndex = totalItems - vis;
            const existing = dotsContainer.querySelectorAll('.fs-dot');
            if (existing.length !== maxIndex + 1) {
                dotsContainer.innerHTML = '';
                for (let i = 0; i <= maxIndex; i++) {
                    const dot = document.createElement('button');
                    dot.className = 'fs-dot' + (i === currentIndex ? ' active' : '');
                    dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                    dot.addEventListener('click', () => {
                        currentIndex = i;
                        updateCarousel(true);
                    });
                    dotsContainer.appendChild(dot);
                }
            } else {
                existing.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
            }
        }

        const prevBtn = document.querySelector('.fs-arrow-prev');
        const nextBtn = document.querySelector('.fs-arrow-next');
        if (prevBtn) prevBtn.disabled = currentIndex === 0;
        if (nextBtn) nextBtn.disabled = currentIndex >= totalItems - vis;
    }

    document.querySelector('.fs-arrow-prev')?.addEventListener('click', () => {
        if (currentIndex > 0) { currentIndex--; updateCarousel(true); }
    });

    document.querySelector('.fs-arrow-next')?.addEventListener('click', () => {
        const vis = getVisibleCount();
        if (currentIndex < totalItems - vis) { currentIndex++; updateCarousel(true); }
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const vis = getVisibleCount();
            const maxIndex = totalItems - vis;
            if (currentIndex > maxIndex) currentIndex = maxIndex;
            updateCarousel(false);
        }, 100);
    });

    updateCarousel(false);
}

// ========================================
// PREVENT LAYOUT SHIFT
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Set minimum heights for dynamic content
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        if (section.offsetHeight < 100) {
            section.style.minHeight = '400px';
        }
    });
});
