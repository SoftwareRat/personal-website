// Navigation scroll effect
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".main-nav");
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");
  const themeToggle = document.querySelector(".theme-toggle");
  const html = document.documentElement;

  // Theme Toggle functionality
  const getPreferredTheme = () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const setTheme = (theme) => {
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  // Initialize theme
  setTheme(getPreferredTheme());

  // Handle theme toggle click
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = html.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      setTheme(newTheme);
    });
  }

  // Handle system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    });

  // Scroll handler
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  });

  // Mobile menu handler
  if (hamburger) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      navLinks.classList.toggle("active");
    });
  }

  // Smooth scroll for navigation links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        // Close mobile menu if open
        if (navLinks) {
          navLinks.classList.remove("active");
          hamburger.classList.remove("active");
        }
      }
    });
  });

  // Intersection Observer for fade-in animations
  const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: "0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all project cards and content sections
  document.querySelectorAll(".project-card, .content section").forEach((el) => {
    el.classList.add("fade-in");
    observer.observe(el);
  });

  // Initialize share buttons if they exist
  const shareButtons = document.querySelectorAll(".share-button");
  if (shareButtons.length > 0) {
    initShareButtons();
  }

  // Back to top button functionality
  const backToTop = document.getElementById("back-to-top");

  const toggleBackToTop = () => {
    if (window.scrollY > 300) {
      backToTop.classList.add("visible");
    } else {
      backToTop.classList.remove("visible");
    }
  };

  window.addEventListener("scroll", toggleBackToTop);

  backToTop?.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
});

// Share buttons
function initShareButtons() {
  const shareButtons = document.querySelectorAll(".share-button");

  shareButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(
        button.href,
        "share-window",
        "height=450, width=550, top=" +
          (window.innerHeight / 2 - 225) +
          ", left=" +
          (window.innerWidth / 2 - 275)
      );
    });
  });
}

// Handle transitions after page load
window.addEventListener("load", () => {
  document.body.classList.add("loaded");
});
