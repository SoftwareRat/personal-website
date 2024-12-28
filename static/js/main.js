// Navigation scroll effect
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.main-nav');
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    // Scroll handler
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // Mobile menu handler
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Close mobile menu if open
                navLinks.classList.remove('active');
            }
        });
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        root: null,
        threshold: 0.1,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all project cards and content sections
    document.querySelectorAll('.project-card, .content section').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
});

// Add CSS classes for animations
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }

    .fade-in.visible {
        opacity: 1;
        transform: translateY(0);
    }

    .hamburger {
        display: none;
        width: 30px;
        height: 20px;
        position: relative;
        margin: 10px;
    }

    @media (max-width: 768px) {
        .hamburger {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .hamburger span {
            display: block;
            height: 2px;
            width: 100%;
            background-color: var(--text-color);
            transition: all 0.3s ease;
        }

        .hamburger.active span:nth-child(1) {
            transform: translateY(9px) rotate(45deg);
        }

        .hamburger.active span:nth-child(2) {
            opacity: 0;
        }

        .hamburger.active span:nth-child(3) {
            transform: translateY(-9px) rotate(-45deg);
        }
    }
`;
document.head.appendChild(style); 